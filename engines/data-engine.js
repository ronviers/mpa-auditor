/**
 * DATA ENGINE  (M7 proper — real CSV ingestion + declaration-first gaps)
 *
 * Ingests empirical data and publishes it as a contract-05 DataUpload.
 * Two paths:
 *
 *   - Mock fixtures (`source: 'mock_fixture'`) — fetch a pre-shaped
 *     contract-05 JSON fixture. Carried forward from MDS / M-Inversion
 *     proper; the FIXTURE_URLS map is now reachable from the UI fixture
 *     selector (slice-hardening backlog).
 *
 *   - Real CSV (`source: 'csv'`) — PapaParse the uploaded text, build a
 *     contract-05 DataUpload from the researcher's declarations, compute
 *     per-column coverage_range, and run the declaration-first
 *     gap-detection pass (foundational-answers.md §Q9) BEFORE the fit.
 *
 * Declaration-first gap-detection (§Q9). After parse, before DATA_READY:
 * detectGaps() walks the declared substrate-class, the column metadata and
 * the observable coverage and returns a typed gap list. Blocking gaps
 * (no license, no τ/C/χ mapping) hold DATA_READY back and surface as
 * prompts; advisory gaps (unclassified substrate, computed-not-declared
 * validity range, no uncertainty) ride through — DATA_READY fires and the
 * gaps surface as caveats the researcher can still refine. Every upfront
 * declaration and every answered gap appends to `declaration_trail` — the
 * audit-trail-of-the-audit.
 *
 * Scoping (§11): the auditor stays pure-static. No LLM, no network beyond
 * fetching committed fixtures. The researcher declares; the engine records.
 *
 * Subscribes to: FILE_DROPPED (internal), DECLARATION_PROVIDED (internal)
 * Publishes:     DATA_READY (contract 05), DECLARATION_GAPS (internal),
 *                SELECTION_CHANGED (contract 08), ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'data_engine_v1';
const MODULE_VERSION = '0.7.0';

// Known synthetic fixtures. `default` is the renderer-exercising fixture
// (not framework-consistent — its diagonal χ vs aging C(τ) honestly
// audits to topological_miss, D7). `consistent` is the slice-hardening #7
// framework-consistent fixture. A FILE_DROPPED payload selects by key.
const FIXTURE_URLS = {
  default:    './fixtures/fake-empirical.json',
  consistent: './fixtures/fake-empirical-consistent.json',
};

// Canonical gFDR triple. The Audit Engine resolves columns by
// physical_quantity; the Inversion Engine reads data rows by these exact
// keys — so a CSV upload is normalised to canonical column names, with the
// original CSV header preserved in `description` + `preprocessing_log`.
const CANONICAL = {
  tau: { name: 'tau', physical_quantity: 'delay_time',  default_units: 'seconds' },
  C:   { name: 'C',   physical_quantity: 'correlation', default_units: 'dimensionless' },
  chi: { name: 'chi', physical_quantity: 'response',    default_units: 'dimensionless' },
};

// In-flight CSV upload awaiting gap resolution. Keyed by upload_id so a
// DECLARATION_PROVIDED answer finds the dataset it belongs to.
const pending = new Map();
// Parsed-CSV cache, keyed by upload_id — lets a column re-map rebuild the
// upload without re-uploading. Kept off the upload object so it never
// leaks into the published contract-05 payload.
const csvCache = new Map();

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text || '');
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function reportError(error_code, message) {
  bus.publish('ERROR_REPORT', {
    error_id: uuid(),
    module_id: MODULE_ID,
    timestamp: new Date().toISOString(),
    severity: 'error',
    error_code,
    message,
    graceful_fallback: {
      render_directive: 'render_error_panel',
      user_facing_text: 'Empirical dataset could not be loaded.'
    },
    user_actionable: false
  });
}

/* ---------- contract-05 light validation ---------- */

// Contract 05 makes provenance.license mandatory and forbids columns
// without explicit units. A hand-rolled light pass — not full JSON Schema.
function validate(upload) {
  const errors = [];
  if (!upload.provenance || !upload.provenance.license) {
    errors.push('provenance.license is mandatory and missing');
  }
  if (!Array.isArray(upload.columns) || upload.columns.length === 0) {
    errors.push('columns array is empty');
  } else {
    upload.columns.forEach(col => {
      if (!col.units) errors.push(`column "${col.name}" has no declared units`);
    });
  }
  if (!Array.isArray(upload.data) || upload.data.length === 0) {
    errors.push('data array is empty');
  }
  return errors;
}

/* ---------- per-column metadata (§Q1) ---------- */

// coverage_range is always computed from the rows (single source of truth:
// the data). validity_range is declared; defaults to coverage_range with
// range_source: 'computed' so the default is visible, not silent.
function columnMetadata(values, declaredValidity) {
  const finite = values.filter(Number.isFinite);
  const coverage = finite.length
    ? [Math.min(...finite), Math.max(...finite)]
    : [null, null];
  const declared = Array.isArray(declaredValidity)
    && declaredValidity.length === 2
    && declaredValidity.every(Number.isFinite);
  return {
    coverage_range: coverage,
    validity_range: declared ? [...declaredValidity] : coverage,
    range_source: declared ? 'declared' : 'computed',
    n_samples: finite.length,
  };
}

/* ---------- declaration trail ---------- */

function clearPending(id) {
  pending.delete(id);
  csvCache.delete(id);
}

function trailEntry(field, value, opts = {}) {
  return {
    timestamp: new Date().toISOString(),
    field,
    value,
    source: 'researcher_declared',
    ...opts,
  };
}

/* ---------- CSV → contract-05 DataUpload ---------- */

// Build a contract-05 DataUpload from a PapaParse result + the
// researcher's declarations. The (τ, C, χ) triple is normalised to
// canonical column names; the rename is logged in preprocessing_log
// (reversible) so "no silent transformations" holds.
function buildUploadFromCSV({ rows, fields }, declarations, originalHash) {
  const d = declarations || {};
  const map = d.column_map || {};            // { tau: 'csvCol', C: 'csvCol', chi: 'csvCol' }
  const validity = d.validity_ranges || {};  // { tau: [a,b], ... }
  const trail = [];

  const columns = [];
  const data = [];
  const preprocessing_log = [];

  // Normalise the mapped triple to canonical names.
  const mappedKeys = ['tau', 'C', 'chi'].filter(k => map[k] && fields.includes(map[k]));
  mappedKeys.forEach(k => {
    const orig = map[k];
    const spec = CANONICAL[k];
    const values = rows.map(r => Number(r[orig]));
    const units = k === 'tau' ? (d.tau_units || spec.default_units) : spec.default_units;
    columns.push({
      name: spec.name,
      units,
      description: `${spec.physical_quantity} (from CSV column "${orig}")`,
      physical_quantity: spec.physical_quantity,
      uncertainty_column: null,
      ...columnMetadata(values, validity[k]),
    });
    if (orig !== spec.name) {
      preprocessing_log.push({
        operation: 'column_rename',
        parameters: { from: orig, to: spec.name },
        rationale: `mapped to the canonical gFDR ${spec.physical_quantity} column per researcher declaration`,
        reversible: true,
      });
    }
    trail.push(trailEntry(`column_map.${k}`, orig, { kind: 'column_mapping' }));
  });

  rows.forEach(r => {
    const row = {};
    mappedKeys.forEach(k => { row[CANONICAL[k].name] = Number(r[map[k]]); });
    data.push(row);
  });

  // Provenance — researcher-declared. citation_text + license are
  // mandatory (contract 05); the gap-detection pass flags them if absent.
  const prov = d.provenance || {};
  const provenance = {
    citation_text: prov.citation_text || '',
    authors: Array.isArray(prov.authors) ? prov.authors
      : (prov.authors ? String(prov.authors).split(',').map(s => s.trim()).filter(Boolean) : []),
    publication_title: prov.publication_title || null,
    publication_venue: prov.publication_venue || null,
    publication_year: prov.publication_year || null,
    doi: prov.doi || null,
    url: prov.url || null,
    license: prov.license || '',
    bibtex: prov.bibtex || null,
  };
  ['citation_text', 'license', 'doi'].forEach(f => {
    if (prov[f]) trail.push(trailEntry(`provenance.${f}`, prov[f], { kind: 'provenance' }));
  });

  const substrate_class = d.substrate_class || 'unclassified';
  trail.push(trailEntry('substrate_class', substrate_class, { kind: 'classification' }));

  const upload = {
    upload_id: uuid(),
    timestamp: new Date().toISOString(),
    substrate_class,
    provenance,
    columns,
    data,
    n_rows: data.length,
    sample_rate_hz: null,
    uncertainty_methodology: d.uncertainty_methodology || { type: 'not_reported', description: 'not declared on upload' },
    preprocessing_log,
    original_hash: originalHash,
    validated: false,
    validation_warnings: [],
    validation_errors: [],
    annotations: [],
    // --- contract-05 extensions, per foundational-answers.md ---
    // (§Q3+Q5) user-contributed tier — same audit math as curated, fenced
    // at status level. (§Q9) declaration_trail — every declaration the
    // researcher made, timestamped.
    tier: 'user',
    validation: { status: 'user_unvalidated' },
    declaration_trail: trail,
    source_filename: d.filename || null,
  };
  return upload;
}

/* ---------- gap-detection pass (§Q9) ---------- */

// Walk a provisional upload and return the typed gaps that stand between
// it and a clean audit. Blocking gaps hold DATA_READY back; advisory gaps
// ride through as caveats. Kept deliberately thin — a typed list, not a
// wizard (next-session-handoff §4 "watch").
function detectGaps(upload, fields = []) {
  const gaps = [];

  if (!upload.provenance?.citation_text) {
    gaps.push({
      id: uuid(), kind: 'missing_provenance', severity: 'blocking',
      field: 'provenance.citation_text',
      context: 'Attribution is load-bearing — every dataset must carry a human-readable citation.',
      options: [{ id: 'declare', label: 'Declare citation text', input: 'text' }],
    });
  }
  if (!upload.provenance?.license) {
    gaps.push({
      id: uuid(), kind: 'missing_provenance', severity: 'blocking',
      field: 'provenance.license',
      context: 'License is mandatory (contract 05). If unknown, say so — declare "unknown".',
      options: [{ id: 'declare', label: 'Declare license', input: 'text' }],
    });
  }

  const has = q => upload.columns.some(c => c.physical_quantity === q);
  if (!has('delay_time') || !has('correlation') || !has('response')) {
    gaps.push({
      id: uuid(), kind: 'unmapped_observable', severity: 'blocking',
      field: 'column_map',
      context: 'The gFDR audit needs the (τ, C, χ) triple. Map your CSV columns to delay time, correlation and response.',
      options: [{ id: 'remap', label: 'Re-map columns', input: 'column_map', fields }],
    });
  }

  // Advisory — the upload audits, but the researcher should see these.
  if (!upload.substrate_class || upload.substrate_class === 'unclassified') {
    gaps.push({
      id: uuid(), kind: 'unknown_class', severity: 'advisory',
      field: 'substrate_class',
      context: 'No substrate-class declared. The audit runs unclassified — slot-aware universality checks stay deferred until a class is declared.',
      options: [
        { id: 'proceed', label: 'Proceed unclassified' },
        { id: 'declare', label: 'Declare substrate-class', input: 'text' },
      ],
    });
  }
  upload.columns.forEach(c => {
    if (c.range_source === 'computed') {
      gaps.push({
        id: uuid(), kind: 'missing_validity_range', severity: 'advisory',
        field: `column:${c.name}`,
        context: `Column "${c.name}" has no declared validity_range — defaulted to its computed coverage [${c.coverage_range.join(', ')}]. The audit will not silence outside instrument-valid bounds unless you declare them.`,
        options: [
          { id: 'accept', label: 'Accept computed coverage as validity range' },
          { id: 'declare', label: 'Declare validity range', input: 'range' },
        ],
      });
    }
  });
  if (upload.uncertainty_methodology?.type === 'not_reported') {
    gaps.push({
      id: uuid(), kind: 'missing_uncertainty', severity: 'advisory',
      field: 'uncertainty_methodology',
      context: 'No uncertainty methodology declared. σ-distance in the audit will read "—". This is honest — never faked — but you may declare it.',
      options: [
        { id: 'accept', label: 'Proceed — no uncertainty reported' },
      ],
    });
  }
  return gaps;
}

/* ---------- finalise: validate + publish DATA_READY ---------- */

function finalise(upload) {
  const errors = validate(upload);
  upload.validated = errors.length === 0;
  upload.validation_errors = errors;
  if (errors.length > 0) {
    reportError('schema_validation_failed', `dataset failed validation: ${errors.join('; ')}`);
    return;
  }

  bus.publish('DATA_READY', upload);

  // Producer side of the cross-pane coupling: announce the substrate so
  // the Inversion Engine fits and the engines enter audit mode.
  bus.publish('SELECTION_CHANGED', {
    selection_id: uuid(),
    timestamp: new Date().toISOString(),
    source_module: MODULE_ID,
    selection_type: 'substrate',
    selected_substrate: {
      substrate_id: upload.upload_id,
      substrate_class: upload.substrate_class || 'unknown',
      parameters: {}
    }
  });
  console.log(`[${MODULE_ID}] DATA_READY — ${upload.n_rows} rows, tier="${upload.tier}", substrate_class="${upload.substrate_class}"`);
}

// A provisional CSV upload: detect gaps, hold back on blocking ones,
// otherwise finalise. Advisory gaps are still published so the gap-prompt
// can surface them as refinable caveats.
function processProvisional(upload) {
  const fields = csvCache.get(upload.upload_id)?.parse?.fields || [];
  const gaps = detectGaps(upload, fields);
  const blocking = gaps.filter(g => g.severity === 'blocking');
  pending.set(upload.upload_id, upload);

  bus.publish('DECLARATION_GAPS', {
    upload_id: upload.upload_id,
    filename: upload.source_filename,
    gaps,
    blocked: blocking.length > 0,
  });

  if (blocking.length === 0) {
    finalise(upload);
    // Keep the upload pending only while advisory gaps remain answerable.
    if (gaps.length === 0) clearPending(upload.upload_id);
  } else {
    console.log(`[${MODULE_ID}] ${blocking.length} blocking gap(s) — DATA_READY held until declared`);
  }
}

/* ---------- declaration answers ---------- */

// A researcher answered a gap. Merge the declaration into the pending
// upload, append to the trail, and re-run the gap pass.
function handleDeclarationProvided(payload) {
  const upload = pending.get(payload?.upload_id);
  if (!upload) {
    console.warn(`[${MODULE_ID}] DECLARATION_PROVIDED for unknown upload ${payload?.upload_id}`);
    return;
  }
  const { gap_kind, field, option_id, value } = payload;

  if (gap_kind === 'missing_provenance' && field?.startsWith('provenance.')) {
    const key = field.split('.')[1];
    upload.provenance[key] = value;
  } else if (gap_kind === 'unknown_class' && option_id === 'declare') {
    upload.substrate_class = value || 'unclassified';
  } else if (gap_kind === 'missing_validity_range' && option_id === 'declare') {
    const col = upload.columns.find(c => `column:${c.name}` === field);
    if (col && Array.isArray(value) && value.length === 2) {
      col.validity_range = [...value];
      col.range_source = 'declared';
    }
  } else if (gap_kind === 'unmapped_observable' && option_id === 'remap') {
    // A re-map is a structural change — rebuild from the cached parse.
    const cached = csvCache.get(upload.upload_id);
    if (cached) {
      const rebuilt = buildUploadFromCSV(cached.parse,
        { ...cached.declarations, column_map: value }, upload.original_hash);
      rebuilt.declaration_trail = upload.declaration_trail.concat(rebuilt.declaration_trail);
      csvCache.delete(upload.upload_id);
      pending.delete(upload.upload_id);
      csvCache.set(rebuilt.upload_id, cached);
      processProvisional(rebuilt);
      return;
    }
  }
  // option_id 'accept' / 'proceed' declare nothing new — they just record
  // that the researcher saw the gap and chose the default.

  upload.declaration_trail.push(trailEntry(field, value ?? option_id, {
    kind: gap_kind, gap_id: payload.gap_id, option: option_id,
  }));

  // Re-run the gap pass with the new declaration folded in.
  const fields = csvCache.get(upload.upload_id)?.parse?.fields || [];
  const gaps = detectGaps(upload, fields);
  const blocking = gaps.filter(g => g.severity === 'blocking');
  bus.publish('DECLARATION_GAPS', {
    upload_id: upload.upload_id,
    filename: upload.source_filename,
    gaps,
    blocked: blocking.length > 0,
  });
  if (blocking.length === 0) {
    finalise(upload);
    if (gaps.length === 0) clearPending(upload.upload_id);
  }
}

/* ---------- CSV ingestion path ---------- */

async function loadCSV(payload) {
  const { text, filename, declarations } = payload;
  if (!window.Papa) {
    reportError('papaparse_unavailable', 'PapaParse CDN script has not loaded — cannot parse CSV.');
    return;
  }
  let parsed;
  try {
    parsed = window.Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
  } catch (err) {
    reportError('csv_parse_failed', `CSV parse failed: ${err.message}`);
    return;
  }
  if (!parsed.meta?.fields?.length || !Array.isArray(parsed.data) || parsed.data.length === 0) {
    reportError('csv_parse_empty', 'CSV parsed to zero usable rows or columns.');
    return;
  }
  const parseResult = { rows: parsed.data, fields: parsed.meta.fields };
  const originalHash = await sha256Hex(text);
  const decl = { ...(declarations || {}), filename };
  const upload = buildUploadFromCSV(parseResult, decl, originalHash);
  // Cache the parse so a column re-map can rebuild without re-uploading.
  csvCache.set(upload.upload_id, { parse: parseResult, declarations: decl });
  if (parsed.errors?.length) {
    upload.validation_warnings.push(`PapaParse reported ${parsed.errors.length} row issue(s) — non-fatal`);
  }
  processProvisional(upload);
}

/* ---------- mock fixture path ---------- */

// Stamp a fixture with the same forward-compat fields a CSV upload carries
// so Window 2 renders consistently across both. Fixtures are a dev tier —
// not 'curated' (no real provenance) and not 'user' (not an upload).
function enrichFixture(upload) {
  (upload.columns || []).forEach(col => {
    const values = (upload.data || []).map(r => Number(r[col.name]));
    Object.assign(col, columnMetadata(values, col.validity_range));
  });
  upload.tier = 'fixture';
  upload.validation = { status: 'fixture', notes: 'synthetic test fixture — not for citation' };
  upload.declaration_trail = [
    trailEntry('source', upload.source_filename || 'committed fixture', { kind: 'fixture', source: 'fixture' }),
  ];
  return upload;
}

async function loadMockFixture(payload) {
  const fixtureKey = payload?.fixture && FIXTURE_URLS[payload.fixture] ? payload.fixture : 'default';
  const fixtureUrl = FIXTURE_URLS[fixtureKey];
  let upload;
  try {
    const res = await fetch(fixtureUrl);
    if (!res.ok) throw new Error(`fixture fetch failed: ${res.status}`);
    upload = await res.json();
  } catch (err) {
    reportError('mock_fixture_load_failed', `mock fixture load failed: ${err.message}`);
    console.error(`[${MODULE_ID}] mock load failed:`, err);
    return;
  }
  upload.source_filename = fixtureUrl;
  enrichFixture(upload);
  finalise(upload);
  console.log(`[${MODULE_ID}] mock dataset loaded (${fixtureKey})`);
}

/* ---------- routing ---------- */

function handleFileDropped(payload) {
  if (payload?.source === 'csv') {
    loadCSV(payload);
  } else {
    // 'mock_fixture' (or anything legacy) routes to the fixture path.
    loadMockFixture(payload);
  }
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'data_source',
    version: MODULE_VERSION,
    capabilities: ['csv_ingestion', 'mock_fixture_load', 'schema_validation', 'provenance_handling', 'gap_detection'],
    subscribes_to: ['FILE_DROPPED', 'DECLARATION_PROVIDED'],
    publishes: ['DATA_READY', 'DECLARATION_GAPS', 'SELECTION_CHANGED', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 7
  });
  bus.subscribe('FILE_DROPPED', handleFileDropped);
  bus.subscribe('DECLARATION_PROVIDED', handleDeclarationProvided);
  console.log(`[${MODULE_ID}] active (M7 proper — CSV ingestion + declaration-first gaps)`);
}

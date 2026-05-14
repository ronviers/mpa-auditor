/**
 * AUDIT ENGINE — four-category classifier + audit domain + slot-aware
 * readings (M8 proper)
 *
 * Compares a PredictedLocus (contract 02) against a DataUpload
 * (contract 05) and emits an AuditDelta (contract 03) — the honest gap.
 * Holds the latest of each; audits whenever it has both.
 *
 * Classification pipeline (first matching branch wins):
 *   1. incompatible_units  — empirical columns lack the dimensionless
 *      (τ, C, χ) triple the gFDR comparison needs. Guardrail.
 *   2. posit_grade_pending — the prediction depends on an unverified
 *      posit (PredictedLocus.posit_grade.status === 'posit_grade').
 *   3. out_of_scope        — even the framework's closest locus is far
 *      from the data (locus MSE above the scope threshold).
 *   4. topological_miss    — predicted and empirical gFDR shape-classes
 *      disagree (suppressed / aging / diagonal).
 *   5. numerical_miss      — shapes agree but the load-bearing FDR
 *      invariant is off by more than tolerance.
 *   6. match               — shape and invariant both agree.
 *
 * --- audit domain (M8 proper, foundational-answers.md §Q4) ---
 * The audit lives in the intersection of the empirical validity_range
 * (the τ-column metadata from M7 proper §Q1) and the substrate-class
 * gamut. Rows outside it are silenced, not extrapolated: `audit_domain`
 * names the τ-window the audit covers; `silenced_regions` names what was
 * dropped and why (`below_validity` / `above_coverage` — data-side; the
 * `out_of_gamut_substrate_class` reason waits on Q6's per-class gamut and
 * is not fabricated here). Shape, slope and MSE are all computed on the
 * in-domain rows — so the framework is not penalised for disagreement
 * outside the instrument-valid window. For data whose validity_range
 * defaults to its coverage (M7's honest default), the audit domain is the
 * full coverage and nothing is silenced — the fixture path is unchanged.
 *
 * --- spark gap (M8 proper) ---
 * The emitted delta carries `spark_gap`: the predicted locus sampled at
 * the empirical τ alongside the empirical locus, plus the silenced flags
 * — everything the Window 3 spark-gap displayer needs to draw the gap.
 *
 * --- slot-aware readings (M8 proper, §Q6) ---
 * The fit scored against the gFDR-locus slot. `slot_context` echoes the
 * Inversion Engine's fit_provenance (substrate_class_id, observable_used,
 * fitted_params); `slot_reading` is the §Q6 slot-aware sentence for the
 * status. No new classification logic — a sharper rendering of the same
 * enum.
 *
 * --- tier + declaration trail echo (M8 proper, §Q3+Q5 / §Q9) ---
 * `tier` and `declaration_trail` echo from DataUpload onto AuditDelta so
 * the audit record is self-contained: a downstream consumer can read
 * exactly which class assumptions came from the researcher.
 *
 * Named limitation (docs/rfc-s-integration-notes.md): the topology and
 * out-of-scope tests are still leading-order. M8 proper sharpened the
 * out-of-scope test by scoping MSE to the audit domain; the topology
 * shape-class test (LS slope thresholds + regime cross-check) is
 * unchanged — a full replacement needs cdv1's gFDR shape catalogue and
 * is its own session.
 *
 * Subscribes to: PREDICTION_READY (contract 02), DATA_READY (contract 05)
 * Publishes:     AUDIT_DELTA (contract 03), ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';
import { interpLocus } from '../math/gfdr-model.js';

const MODULE_ID = 'audit_engine_v1';
const MODULE_VERSION = '0.8.1';
const FRAMEWORK_VERSION = 'v9.1';
// Vendored mpa-solver version — a fixed constant, tracks
// vendor/mpa-solver/README.md (changes only when the WASM is re-vendored).
const SOLVER_VERSION = '2.0.0';

const TOLERANCE = 0.05;             // FDR-slope agreement tolerance

// Out-of-scope (out-of-gamut) threshold — locus MSE above which even the
// framework's closest locus is "too far" from the data. RFC-S §2 says the
// gamut boundary is *substrate-specific*, not global (rfc-s-integration-
// notes.md D3). Until driver profiles carry it (RFC-S §4 `gamut`), this
// per-substrate-class map is the stand-in; DEFAULT applies to anything
// unlisted. Add a class here when its gamut is characterised.
const DEFAULT_OUT_OF_SCOPE_MSE = 0.05;
const SCOPE_THRESHOLD_BY_CLASS = {
  fixture_substrate: 0.05,          // synthetic fixture — same as default, named explicitly
};
function scopeThreshold(substrateClass) {
  return SCOPE_THRESHOLD_BY_CLASS[substrateClass] ?? DEFAULT_OUT_OF_SCOPE_MSE;
}

let lastPrediction = null;
let lastData = null;
// Correlation tracking (rfc-s-integration-notes.md D-discipline): index
// data by upload_id so a fitted prediction pairs with the dataset it was
// fitted to — by id, not "latest seen" — once multiple datasets are in
// flight (M-Corpus). Hand-dialed predictions still fall back to lastData.
const dataById = new Map();

// M6: the locus_source / fit_provenance markers ride inside *_state
// (contract 02 additionalProperties).
function locusState(p) {
  return p?.continuous_state || p?.discrete_state || {};
}

// Pair a prediction with the dataset it belongs to. A fitted prediction
// carries fit_provenance.data_id (echoed by the engines from the Inversion
// Engine's STATE_REQUEST); pair by that id when the dataset is known.
function resolveData(prediction) {
  const dataId = locusState(prediction)?.fit_provenance?.data_id;
  if (dataId && dataById.has(dataId)) return dataById.get(dataId);
  return lastData;
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- empirical extraction ---------- */

// Pull the dimensionless (τ, C, χ) triple. Returns { rows } or { reason }
// when the units guardrail trips.
function extractEmpirical(data) {
  const cols = data.columns || [];
  const find = q => cols.find(c => c.physical_quantity === q || c.name === q);
  const tauCol = find('delay_time') || cols.find(c => c.name === 'tau');
  const cCol = find('correlation') || cols.find(c => c.name === 'C');
  const chiCol = find('response') || cols.find(c => c.name === 'chi');
  if (!tauCol || !cCol || !chiCol) {
    return { reason: 'empirical data has no (tau, C, chi) column triple' };
  }
  // χ and C must be dimensionless — silent unit comparison is forbidden.
  const dimless = u => /dimensionless|^$|—|unitless/i.test(u || '');
  if (!dimless(cCol.units) || !dimless(chiCol.units)) {
    return { reason: `C / χ columns must be dimensionless (got "${cCol.units}" / "${chiCol.units}")` };
  }
  const rows = (data.data || [])
    .map(r => ({ tau: Number(r[tauCol.name]), C: Number(r[cCol.name]), chi: Number(r[chiCol.name]) }))
    .filter(r => Number.isFinite(r.tau) && Number.isFinite(r.C) && Number.isFinite(r.chi));
  return { rows, tauCol };
}

/* ---------- audit domain (§Q4) ---------- */

// The τ-window the audit covers: the intersection of the empirical
// validity_range (M7 §Q1 column metadata) with the coverage of the data.
// `out_of_gamut_substrate_class` is the third §Q4 reason — it waits on
// Q6's per-class gamut and is deliberately not fabricated here.
function computeAuditDomain(rows, tauCol) {
  const taus = rows.map(r => r.tau);
  const covLo = Math.min(...taus), covHi = Math.max(...taus);
  const coverage = Array.isArray(tauCol?.coverage_range) ? tauCol.coverage_range : [covLo, covHi];
  const validity = Array.isArray(tauCol?.validity_range) ? tauCol.validity_range : coverage;
  // §Q4's silenced-region enum is `below_validity` / `above_coverage`
  // (data-side) — it does not silence above validity_range, so the audit
  // domain's upper edge is the data coverage, not validity[1]. The lower
  // edge is the validity floor (instrument resolution).
  const domLo = Math.max(coverage[0] ?? covLo, validity[0] ?? covLo);
  const domHi = coverage[1] ?? covHi;

  const inDomain = [];
  const silencedTaus = { below_validity: [], above_coverage: [] };
  rows.forEach(r => {
    if (r.tau < validity[0]) silencedTaus.below_validity.push(r.tau);
    else if (r.tau > coverage[1]) silencedTaus.above_coverage.push(r.tau);
    else inDomain.push(r);
  });

  const silenced_regions = [];
  if (silencedTaus.below_validity.length) {
    silenced_regions.push({
      tau: [Math.min(...silencedTaus.below_validity), Math.max(...silencedTaus.below_validity)],
      reason: 'below_validity'
    });
  }
  if (silencedTaus.above_coverage.length) {
    silenced_regions.push({
      tau: [Math.min(...silencedTaus.above_coverage), Math.max(...silencedTaus.above_coverage)],
      reason: 'above_coverage'
    });
  }

  return {
    inDomain,
    audit_domain: {
      tau: [domLo, domHi],
      reason: 'intersection of empirical validity_range and substrate-class coverage'
    },
    silenced_regions,
  };
}

/* ---------- shape + numerics ---------- */

// Slope of χ on ΔC by least squares — the FDR-slope invariant
// (X_r ≈ 1 diagonal, X_c ≈ 0 suppressed, α_s in between for aging).
function fdrSlope(dC, chi) {
  const n = dC.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += dC[i]; sy += chi[i]; sxx += dC[i] * dC[i]; sxy += dC[i] * chi[i]; }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  return (n * sxy - sx * sy) / denom;
}

function shapeClass(slope) {
  if (slope == null) return 'unknown';
  if (slope >= 0.7) return 'diagonal';     // r-regime / equilibrium FDR
  if (slope <= 0.2) return 'suppressed';   // c-regime
  return 'aging';                          // s-regime
}

// Predicted shape from the engine's regime label (independent cross-check
// against the slope-derived class).
function predictedShapeFromRegime(regime) {
  if (regime === 'deep_c' || regime === 'c_near_s') return 'suppressed';
  if (regime === 's_critical') return 'aging';
  if (regime === 'r_near_s' || regime === 'deep_r') return 'diagonal';
  if (regime === 'k_frust') return 'frustrated';
  return 'unknown';
}

// Per-regime name for the load-bearing FDR invariant (cdv1 §gFDR).
function invariantName(shape) {
  if (shape === 'aging') return 'alpha_s';
  if (shape === 'diagonal') return 'X_r';
  if (shape === 'suppressed') return 'X_c';
  return 'fdr_slope';
}

function extensionForTopologyMiss(predShape, empShape) {
  if (empShape === 'aging' && predShape !== 'aging') {
    return {
      extension_axis: 'hierarchical_kernel',
      rationale: 'empirical locus shows an aging diagonal the single-mode kernel does not produce at the fitted regime',
      framework_reference: 'v9 §Extension axes, hierarchical_kernel'
    };
  }
  if (predShape === 'frustrated' || empShape === 'frustrated') {
    return {
      extension_axis: 'higher_order_frustration',
      rationale: 'transient-negative response signature implicates a k_frust loop (N≥3)',
      framework_reference: 'v9 §Extension axes, higher_order_frustration'
    };
  }
  return {
    extension_axis: 'none_known',
    rationale: 'shape classes disagree but no single extension axis is clearly implicated by this dataset',
    framework_reference: 'v9 §Extension axes'
  };
}

/* ---------- slot-aware readings (§Q6) ---------- */

// The fit scored against the gFDR-locus slot. slot_context echoes the
// Inversion Engine's fit_provenance so M-Corpus can ingest this audit as
// a slot-keyed instance record; slot_reading is the §Q6 slot-aware
// sentence for the status.
function slotContext(prediction) {
  const fp = locusState(prediction)?.fit_provenance || null;
  return {
    slot: 'gfdr-locus',
    substrate_class_id: fp?.substrate_class_id || 'unclassified',
    observable_used: fp?.observable_used || null,
    fitted_params: fp?.fitted_params || null,
  };
}

const SLOT_READING = {
  match: 'gFDR-locus slot — the leading-order posited form holds on this substrate.',
  numerical_miss: 'gFDR-locus slot — the posited value is off; a canonical-extension opportunity (substrate-thermodynamic derivation of the exact functional form).',
  topological_miss: 'gFDR-locus slot — the posited structure is wrong; a falsifier hit on this substrate.',
  posit_grade_pending: 'gFDR-locus slot — not enough observable coverage to grade the slot.',
  out_of_scope: 'gFDR-locus slot — substrate-class conditions do not hold for this instance; the slot is silent.',
  incompatible_units: 'Pre-classifier guardrail — no slot was scored.',
};

/* ---------- the audit ---------- */

async function runAudit() {
  if (!lastPrediction) return;
  const prediction = lastPrediction;
  const data = resolveData(prediction);
  if (!data) return;

  const audit_id = uuid();
  const prediction_id = prediction.response_id || 'unknown';
  const data_id = data.upload_id || 'unknown';
  const timestamp = new Date().toISOString();
  const reproducibility_hash = await sha256Hex(
    (prediction.reproducibility_hash || '') + (data.original_hash || '') + MODULE_VERSION
  );
  const provEcho = {
    citation_text: data.provenance?.citation_text || 'unknown',
    doi: data.provenance?.doi || null,
    authors: data.provenance?.authors || [],
    license: data.provenance?.license || 'unknown',
    bibtex: data.provenance?.bibtex || ''
  };

  // M8 proper — tier + declaration trail echo (§Q3+Q5 / §Q9). The audit
  // record is self-contained: a downstream consumer reads exactly which
  // class assumptions came from the researcher vs the manifest.
  //
  // version_context (§Q10) records the grading context — cdv1 / audit
  // engine / solver versions — so M-Corpus can surface staleness when
  // cdv1 evolves and offer a researcher-triggered re-audit. §Q10 named
  // this `framework_version`, but contract 03 already requires a
  // `framework_version` *string*; shipped as `version_context` to avoid
  // the collision (see foundational-answers.md §Q10 correction note). It
  // rides the now-open top-level extension surface (Q11).
  const base = {
    audit_id, prediction_id, data_id, timestamp,
    framework_version: FRAMEWORK_VERSION,
    reproducibility_hash,
    data_provenance_echo: provEcho,
    tier: data.tier || 'user',
    declaration_trail: Array.isArray(data.declaration_trail) ? data.declaration_trail : [],
    slot_context: slotContext(prediction),
    version_context: {
      cdv1: FRAMEWORK_VERSION,
      audit_engine: MODULE_VERSION,
      solver: SOLVER_VERSION,
    },
  };

  const emit = (delta) => bus.publish('AUDIT_DELTA', {
    ...base,
    slot_reading: SLOT_READING[delta.status] || '',
    ...delta
  });

  // 1. incompatible_units guardrail
  const extracted = extractEmpirical(data);
  if (extracted.reason) {
    emit({
      status: 'incompatible_units',
      confidence_score: 1.0,
      topology_match: false, numerical_match: false,
      primary_divergence: null, all_divergences: [],
      visualization_directives: { show_ghost_locus: false, show_topological_residual: false, show_hatching: true, show_dashed_band: false, annotation_text: extracted.reason },
      exportable_record: { title: 'Audit refused — incompatible units', summary: extracted.reason, permanent_url: null, audit_bibtex: '' }
    });
    return;
  }
  const allRows = extracted.rows;
  if (allRows.length < 2) {
    bus.publish('ERROR_REPORT', {
      error_id: uuid(), module_id: MODULE_ID, timestamp, severity: 'warning',
      error_code: 'audit_insufficient_data',
      message: `dataset ${data_id} has fewer than 2 usable (tau, C, chi) rows`,
      graceful_fallback: { render_directive: 'render_last_valid_state', user_facing_text: 'Not enough empirical data to audit.' },
      user_actionable: false
    });
    return;
  }

  // 2. posit_grade_pending — the prediction itself is posit-grade
  if (prediction.posit_grade?.status === 'posit_grade') {
    emit({
      status: 'posit_grade_pending',
      confidence_score: 0.8,
      topology_match: false, numerical_match: false,
      primary_divergence: null, all_divergences: [],
      visualization_directives: { show_ghost_locus: false, show_topological_residual: false, show_hatching: false, show_dashed_band: true, annotation_text: 'Prediction depends on an unverified posit — audit deferred until it is load-bearing-tested.' },
      exportable_record: { title: 'Audit deferred — posit-grade prediction', summary: 'The prediction at this operating point is posit-grade; the gap cannot be attributed to the framework yet.', permanent_url: null, audit_bibtex: '' }
    });
    return;
  }

  // Audit domain (§Q4): silence rows outside the validity ∩ coverage
  // window; shape, slope and MSE are all computed on the in-domain rows.
  const { inDomain, audit_domain, silenced_regions } = computeAuditDomain(allRows, extracted.tauCol);
  const rows = inDomain;
  if (rows.length < 2) {
    bus.publish('ERROR_REPORT', {
      error_id: uuid(), module_id: MODULE_ID, timestamp, severity: 'warning',
      error_code: 'audit_domain_too_narrow',
      message: `dataset ${data_id} has fewer than 2 rows inside the audit domain [${audit_domain.tau.join(', ')}]`,
      graceful_fallback: { render_directive: 'render_last_valid_state', user_facing_text: 'The valid τ-window holds too few points to audit.' },
      user_actionable: false
    });
    return;
  }

  // Common-footing comparison: sample the predicted locus at empirical τ.
  const predLocus = prediction.locus_points || [];
  const sampled = rows.map(r => {
    const m = interpLocus(predLocus, r.tau);
    return { tau: r.tau, C: m.C, chi: m.chi };
  });
  let mse = 0;
  for (let i = 0; i < rows.length; i++) {
    const dC = rows[i].C - sampled[i].C;
    const dChi = rows[i].chi - sampled[i].chi;
    mse += dC * dC + dChi * dChi;
  }
  mse /= rows.length;

  const empSlope = fdrSlope(rows.map(r => 1 - r.C), rows.map(r => r.chi));
  const predSlope = fdrSlope(sampled.map(s => 1 - s.C), sampled.map(s => s.chi));
  const empShape = shapeClass(empSlope);
  const predShape = shapeClass(predSlope);
  const regimeShape = predictedShapeFromRegime(prediction.regime);

  // Spark-gap payload — predicted vs empirical on the common τ support,
  // plus the silenced regions, for the Window 3 spark-gap displayer.
  const spark_gap = {
    predicted: sampled,
    empirical: rows,
    silenced_regions,
  };

  // 3. out_of_scope — the framework's closest locus is still far off.
  // MSE is scoped to the audit domain (§Q4) — the framework is not
  // penalised for disagreement outside the instrument-valid window.
  const oosThreshold = scopeThreshold(data.substrate_class);
  if (mse > oosThreshold) {
    emit({
      status: 'out_of_scope',
      confidence_score: 0.7,
      topology_match: empShape === predShape,
      numerical_match: false,
      primary_divergence: {
        quantity: 'locus_mse', predicted_val: 0, empirical_val: mse,
        empirical_uncertainty: null, tolerance: oosThreshold,
        units: 'dimensionless', sigma_off: null
      },
      all_divergences: [],
      scope_diagnosis: {
        reason: 'beyond_demand_envelope',
        explanation: `best-available framework locus is MSE=${mse.toFixed(4)} from the data over the audit domain (substrate "${data.substrate_class || 'unknown'}" gamut threshold ${oosThreshold}) — the substrate is not represented within the 2-mode kernel's demand envelope at this fit`
      },
      audit_domain, silenced_regions, spark_gap,
      visualization_directives: { show_ghost_locus: false, show_topological_residual: false, show_hatching: true, show_dashed_band: false, annotation_text: `Out of scope — locus MSE ${mse.toFixed(3)}` },
      exportable_record: { title: 'Out-of-scope audit', summary: `Empirical locus lies outside the framework's reach (MSE ${mse.toFixed(3)}).`, permanent_url: null, audit_bibtex: '' }
    });
    return;
  }

  const topology_match = (empShape === predShape) && (predShape === regimeShape);

  // 4. topological_miss — shape classes disagree
  if (!topology_match) {
    const ext = extensionForTopologyMiss(regimeShape, empShape);
    emit({
      status: 'topological_miss',
      confidence_score: 0.75,
      topology_match: false,
      numerical_match: false,
      primary_divergence: {
        quantity: 'gfdr_shape_class',
        predicted_val: null, empirical_val: null,
        empirical_uncertainty: null, tolerance: null,
        units: 'categorical', sigma_off: null
      },
      all_divergences: [],
      recommended_extension: ext,
      audit_domain, silenced_regions, spark_gap,
      visualization_directives: { show_ghost_locus: false, show_topological_residual: true, show_hatching: false, show_dashed_band: false, annotation_text: `Shape mismatch — predicted "${regimeShape}", empirical "${empShape}"` },
      exportable_record: { title: 'Topological miss', summary: `Predicted gFDR shape (${regimeShape}) does not match the empirical shape (${empShape}); see ${ext.extension_axis}.`, permanent_url: null, audit_bibtex: '' }
    });
    return;
  }

  // 5 / 6 — shapes agree; compare the load-bearing FDR-slope invariant
  const qName = invariantName(empShape);
  const slopeDiff = (predSlope != null && empSlope != null) ? Math.abs(predSlope - empSlope) : null;
  const numerical_match = slopeDiff != null && slopeDiff <= TOLERANCE;
  const unc = (data.uncertainty_methodology && data.uncertainty_methodology.type !== 'not_reported')
    ? null  // a real σ would be extracted from the uncertainty column; not modelled in the fixture
    : null;
  const primary_divergence = {
    quantity: qName,
    predicted_val: predSlope,
    empirical_val: empSlope,
    empirical_uncertainty: unc,
    tolerance: TOLERANCE,
    units: 'dimensionless',
    sigma_off: (unc && slopeDiff != null) ? slopeDiff / unc : null
  };

  if (numerical_match) {
    emit({
      status: 'match',
      confidence_score: 0.9,
      topology_match: true, numerical_match: true,
      primary_divergence, all_divergences: [primary_divergence],
      audit_domain, silenced_regions, spark_gap,
      visualization_directives: { show_ghost_locus: false, show_topological_residual: false, show_hatching: false, show_dashed_band: false, annotation_text: `Within tolerance — ${qName} ${empSlope.toFixed(3)} vs ${predSlope.toFixed(3)}` },
      exportable_record: { title: `Audit match — ${qName}`, summary: `Topology and ${qName} both agree within tolerance.`, permanent_url: null, audit_bibtex: '' }
    });
  } else {
    emit({
      status: 'numerical_miss',
      confidence_score: 0.85,
      topology_match: true, numerical_match: false,
      primary_divergence, all_divergences: [primary_divergence],
      audit_domain, silenced_regions, spark_gap,
      visualization_directives: { show_ghost_locus: true, show_topological_residual: false, show_hatching: false, show_dashed_band: false, annotation_text: `${qName} off by ${slopeDiff.toFixed(3)} — topology matches` },
      exportable_record: { title: `Numerical miss — ${qName}`, summary: `Topology matches; ${qName} numerically off by ${slopeDiff.toFixed(3)} (tolerance ${TOLERANCE}).`, permanent_url: null, audit_bibtex: '' }
    });
  }
}

function handlePredictionReady(payload) {
  if (!payload || (payload.mode !== 'continuous' && payload.mode !== 'discrete')) return;
  // M6 emits a follow-up PREDICTION_READY refining the first emission's
  // locus — either the ensemble-derived locus, or (if the ensemble
  // diverged) the analytical locus again with ensemble_error set. The
  // audit stays on the first emission until M-Inversion proper wires
  // ensemble-derived *scoring*, so ignore every follow-up refinement.
  const st = locusState(payload);
  if (st.locus_source === 'ensemble' || st.ensemble_error) return;
  lastPrediction = payload;
  runAudit();
}

function handleDataReady(payload) {
  lastData = payload;
  if (payload?.upload_id) dataById.set(payload.upload_id, payload);
  runAudit();
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'engine',
    version: MODULE_VERSION,
    framework_version_compatibility: ['v9', 'v9.1'],
    capabilities: ['miss_classification', 'extension_recommendation', 'common_footing_comparison', 'audit_domain', 'slot_aware_readings', 'sha256_audit_trail'],
    subscribes_to: ['PREDICTION_READY', 'DATA_READY'],
    publishes: ['AUDIT_DELTA', 'ERROR_REPORT'],
    computational_profile: 'medium',
    status: 'active',
    session_implemented_in: 8
  });
  bus.subscribe('PREDICTION_READY', handlePredictionReady);
  bus.subscribe('DATA_READY', handleDataReady);
  console.log(`[${MODULE_ID}] active (M8 proper — four-category classifier + audit domain + slot-aware readings)`);
}

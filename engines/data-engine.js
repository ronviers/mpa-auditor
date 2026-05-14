/**
 * DATA ENGINE
 *
 * Mock-dataset slice (M7, thin). Loads the synthetic empirical fixture
 * (`fixtures/fake-empirical.json` — already shaped to contract 05), runs
 * a light validation pass, and publishes it as DATA_READY plus a
 * SELECTION_CHANGED carrying substrate_class. The latter is the producer
 * side of the cross-pane coupling: it lets the Inversion Engine fit and
 * the character/discrete engines enter audit mode.
 *
 * Thin-slice scope: the fixture is pre-shaped to contract 05, so this is
 * fetch + validate + republish — NOT the full CSV / PapaParse ingestion
 * path. Real upload parsing is M7 proper, a later session.
 *
 * Subscribes to: FILE_DROPPED (internal)
 * Publishes:     DATA_READY (contract 05), SELECTION_CHANGED (contract 08),
 *                ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'data_engine_v1';
const MODULE_VERSION = '0.6.0';
// Known synthetic fixtures. `default` is the renderer-exercising fixture
// (not framework-consistent — its diagonal χ vs aging C(τ) honestly
// audits to topological_miss, D7). `consistent` is the slice-hardening #7
// framework-consistent fixture: a gFDR locus + phase-locking r generated
// from the framework's own forward model, so it exercises the match /
// numerical_miss audit branches. A FILE_DROPPED payload selects by key;
// a UI selector is owed to M7 proper.
const FIXTURE_URLS = {
  default:    './fixtures/fake-empirical.json',
  consistent: './fixtures/fake-empirical-consistent.json',
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
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

// Light validation pass — contract 05 makes provenance.license mandatory
// and forbids columns without explicit units.
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

  const errors = validate(upload);
  if (errors.length > 0) {
    reportError('schema_validation_failed', `mock fixture failed validation: ${errors.join('; ')}`);
    return;
  }

  const dataUpload = {
    ...upload,
    validated: true,
    validation_errors: [],
    validation_warnings: upload.validation_warnings || []
  };

  bus.publish('DATA_READY', dataUpload);

  // Producer side of the cross-pane coupling: announce the substrate so
  // the Inversion Engine fits and the engines enter audit mode on the
  // next STATE_REQUEST.
  bus.publish('SELECTION_CHANGED', {
    selection_id: uuid(),
    timestamp: new Date().toISOString(),
    source_module: MODULE_ID,
    selection_type: 'substrate',
    selected_substrate: {
      substrate_id: dataUpload.upload_id,
      substrate_class: dataUpload.substrate_class || 'unknown',
      parameters: {}
    }
  });

  console.log(`[${MODULE_ID}] mock dataset loaded (${fixtureKey}) — ${dataUpload.n_rows} rows, substrate_class="${dataUpload.substrate_class}"`);
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'data_source',
    version: MODULE_VERSION,
    capabilities: ['mock_fixture_load', 'schema_validation', 'provenance_handling'],
    subscribes_to: ['FILE_DROPPED'],
    publishes: ['DATA_READY', 'SELECTION_CHANGED', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 7
  });
  bus.subscribe('FILE_DROPPED', payload => loadMockFixture(payload));
  console.log(`[${MODULE_ID}] active (mock-dataset slice)`);
}

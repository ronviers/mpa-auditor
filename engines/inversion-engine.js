/**
 * INVERSION ENGINE  (M-Inversion — brought forward into the mock-dataset slice)
 *
 * Consumes a DataUpload (contract 05) and fits framework parameters to
 * it: a grid search over chit minimising the gFDR-locus residual against
 * the empirical C(τ)/χ(τ). Emits a parameter-populated STATE_REQUEST
 * (contract 01) — the same shape the slider produces — so the
 * character/discrete engines re-render at the fitted operating point.
 * That re-render IS the Predicted pane's self-adaptation.
 *
 * Named limitations (flagged in docs/rfc-s-integration-notes.md):
 *   - Scores against the *analytical* gFDR locus (math/gfdr-model.js),
 *     not the ensemble-derived locus. Ensemble scoring is gated on M6 —
 *     ~2 s per candidate today, infeasible for a grid search.
 *   - The analytical locus depends on chit alone, so a C(τ)/χ(τ) fit does
 *     NOT constrain γ_AB. The fit carries γ_AB through unchanged and
 *     reports it as unconstrained.
 *
 * Subscribes to: DATA_READY (contract 05),
 *                STATE_REQUEST (contract 01, to track the user's mode / γ_AB)
 * Publishes:     STATE_REQUEST (contract 01), ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';
import { locusResidual, vertexRegime } from '../math/gfdr-model.js';

const MODULE_ID = 'inversion_engine_v1';
const MODULE_VERSION = '0.1.0';
const FRAMEWORK_VERSION = 'v9.1';

const CHIT_MIN = -2, CHIT_MAX = 2, CHIT_STEPS = 161;  // 0.025 resolution
const DEFAULT_GAMMA = -0.3;

// Tracked from the user's own STATE_REQUESTs so a fit re-renders in the
// mode the user is actually viewing and carries γ_AB through unchanged.
let currentMode = 'continuous';
let currentGamma = DEFAULT_GAMMA;

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
    severity: 'warning',
    error_code,
    message,
    graceful_fallback: { render_directive: 'render_last_valid_state', user_facing_text: 'Could not fit framework parameters to this dataset.' },
    user_actionable: false
  });
}

function fitChit(empiricalRows) {
  let bestChit = 0, bestResidual = Infinity;
  for (let i = 0; i < CHIT_STEPS; i++) {
    const chit = CHIT_MIN + i * (CHIT_MAX - CHIT_MIN) / (CHIT_STEPS - 1);
    const res = locusResidual(empiricalRows, chit);
    if (res < bestResidual) { bestResidual = res; bestChit = chit; }
  }
  return { chit: bestChit, residual: bestResidual };
}

function handleDataReady(dataUpload) {
  const rows = (dataUpload.data || []).filter(r =>
    Number.isFinite(Number(r.tau)) && Number.isFinite(Number(r.C)) && Number.isFinite(Number(r.chi)));
  if (rows.length < 2) {
    reportError('inversion_insufficient_data',
      `dataset ${dataUpload.upload_id} has fewer than 2 usable (tau, C, chi) rows — cannot fit`);
    return;
  }

  const { chit, residual } = fitChit(rows);
  const regime = vertexRegime(chit);

  // Parameter-populated STATE_REQUEST — same shape the slider emits, plus
  // substrate_class and a fit_provenance marker (parameters allows
  // additionalProperties per contract 01) so downstream knows this
  // operating point came from an inversion, not a hand-dialed slider.
  bus.publish('STATE_REQUEST', {
    request_id: uuid(),
    timestamp: new Date().toISOString(),
    mode: currentMode,
    framework_version: FRAMEWORK_VERSION,
    substrate_class: dataUpload.substrate_class || 'unknown',
    parameters: {
      chit,
      gamma_AB: currentGamma,
      fit_provenance: {
        source: MODULE_ID,
        data_id: dataUpload.upload_id,
        fitted: ['chit'],
        unconstrained: ['gamma_AB'],
        locus_residual: residual,
        regime
      }
    }
  });
  console.log(`[${MODULE_ID}] fit complete — chit=${chit.toFixed(3)} (${regime}), residual=${residual.toExponential(2)}; γ_AB unconstrained by gFDR locus`);
}

function handleStateRequest(payload) {
  // Track the user's mode / γ_AB from their own requests; ignore the
  // Inversion Engine's own fit requests to avoid a feedback loop.
  if (!payload || payload.parameters?.fit_provenance) return;
  if (payload.mode === 'continuous' || payload.mode === 'discrete') currentMode = payload.mode;
  const g = Number(payload.parameters?.gamma_AB);
  if (Number.isFinite(g)) currentGamma = g;
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'engine',
    version: MODULE_VERSION,
    framework_version_compatibility: ['v9', 'v9.1'],
    capabilities: ['parameter_inversion', 'gfdr_locus_fit'],
    subscribes_to: ['DATA_READY', 'STATE_REQUEST'],
    publishes: ['STATE_REQUEST', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 7
  });
  bus.subscribe('DATA_READY', handleDataReady);
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active (mock-dataset slice)`);
}

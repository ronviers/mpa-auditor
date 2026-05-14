/**
 * INVERSION ENGINE  (M-Inversion proper + slice-hardening #6)
 *
 * Consumes a DataUpload (contract 05) and fits framework parameters to it,
 * then emits a parameter-populated STATE_REQUEST (contract 01) — the same
 * shape the slider produces — so the character/discrete engines re-render
 * at the fitted operating point. That re-render IS the Predicted pane's
 * self-adaptation.
 *
 * --- chit: ensemble-derived scoring (M-Inversion proper) ---
 * Two-stage. Stage 1 grid-searches chit over the full range against the
 * *analytical* gFDR locus (math/gfdr-model.js) — cheap, localises the
 * optimum. Stage 2 refines a small window around it, scoring each
 * candidate against the *ensemble-derived* locus (math/ensemble-locus.js,
 * coarse preset) — closing the "forward-model fidelity bounds round-trip
 * fidelity" gap (rfc-s-integration-notes.md D5).
 *
 * The cooperative kernel's ensemble diverges (M6 §7 / Q7): a candidate
 * whose coarse ensemble diverges (throws, or returns a finite-but-runaway
 * locus) is scored against the analytical locus instead — same MSE metric
 * in the same normalised (C, χ) space, so the residuals stay comparable.
 * `fit_provenance.observable_used.chit` records which path the refine
 * window actually took: 'gfdr-locus-ensemble' | '...-analytical' |
 * '...-hybrid'. The cooperative-band design decision is self-documenting
 * under audit.
 *
 * --- γ_AB: phase-locking observable (slice-hardening #6) ---
 * The gFDR locus depends on chit alone, so it cannot constrain γ_AB
 * (rfc-s-integration-notes.md D1 → RFC-S Appendix B item 4). When the
 * upload carries a phase-locking observable (`scalar_observables.
 * phase_locking_r`, riding contract-05 additionalProperties), γ_AB is
 * grid-fit against the phase-locking forward model
 * (math/phase-locking-model.js). When it does not, γ_AB carries through
 * unchanged and is reported unconstrained — exactly the D1 behaviour.
 *
 * Subscribes to: DATA_READY (contract 05),
 *                STATE_REQUEST (contract 01, to track the user's mode / γ_AB)
 * Publishes:     STATE_REQUEST (contract 01), ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';
import { locusResidual, vertexRegime } from '../math/gfdr-model.js';
import { computeEnsembleLocus, SCORING_ENSEMBLE_OPTS } from '../math/ensemble-locus.js';
import { computePhaseLockingR } from '../math/phase-locking-model.js';
import * as solver from '../math/solver-service.js';

const MODULE_ID = 'inversion_engine_v1';
const MODULE_VERSION = '0.2.0';
const FRAMEWORK_VERSION = 'v9.1';

// Stage 1 — analytical localise over the full chit range.
const CHIT_MIN = -2, CHIT_MAX = 2, CHIT_STEPS = 161;  // 0.025 resolution
// Stage 2 — ensemble refine window around the analytical optimum, at the
// native Stage-1 resolution.
const REFINE_OFFSETS = [-0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075];
// Coarse-ensemble sanity bounds: the normalised (C, χ) locus lives in
// [0, 1]; a candidate whose coarse ensemble runs away can return a finite
// but wildly out-of-range locus — treat that as divergence, not a fit.
const SANE_LO = -0.5, SANE_HI = 1.5;
// γ_AB fit grid against the phase-locking observable.
const GAMMA_FIT_MIN = -1, GAMMA_FIT_MAX = 1, GAMMA_FIT_STEPS = 41;
const DEFAULT_GAMMA = -0.3;

// Tracked from the user's own STATE_REQUESTs so a fit re-renders in the
// mode the user is actually viewing and carries γ_AB through unchanged
// when no phase-locking observable is available.
let currentMode = 'continuous';
let currentGamma = DEFAULT_GAMMA;
// Generation guard — a second DATA_READY supersedes an in-flight fit.
let fitGen = 0;

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

// chit = ln(G_0 / L), reference L = 1 (matches the engines' mapping).
function mapToSolverParams(chit, gamma) {
  const G0 = Math.exp(chit);
  return {
    G0_A: G0, G0_B: G0,
    L_A: 1.0, L_B: 1.0,
    gamma_AB: gamma,
    rho_sat: 1.0,
    D_noise: 0.0,
    seed: 0
  };
}

/* ---------- chit fit — Stage 1: analytical localise ---------- */

function fitChitAnalytical(rows) {
  let bestChit = 0, bestResidual = Infinity;
  for (let i = 0; i < CHIT_STEPS; i++) {
    const chit = CHIT_MIN + i * (CHIT_MAX - CHIT_MIN) / (CHIT_STEPS - 1);
    const res = locusResidual(rows, chit);
    if (res < bestResidual) { bestResidual = res; bestChit = chit; }
  }
  return { chit: bestChit, residual: bestResidual };
}

/* ---------- chit fit — Stage 2: ensemble refine ---------- */

// Linear-τ interpolation of an ensemble locus (uniform τ-grid) at an
// arbitrary τ. The analytical model is geometrically sampled and uses
// log-τ interpolation (gfdr-model.js interpLocus); the ensemble locus is
// linearly sampled, so linear interpolation is the matching scheme.
function interpLinear(points, tau) {
  if (tau <= points[0].tau) return { C: points[0].C, chi: points[0].chi };
  const last = points[points.length - 1];
  if (tau >= last.tau) return { C: last.C, chi: last.chi };
  for (let i = 1; i < points.length; i++) {
    if (points[i].tau >= tau) {
      const a = points[i - 1], b = points[i];
      const f = (tau - a.tau) / (b.tau - a.tau);
      return { C: a.C + f * (b.C - a.C), chi: a.chi + f * (b.chi - a.chi) };
    }
  }
  return { C: last.C, chi: last.chi };
}

// Mean squared residual of empirical rows against a pre-built ensemble
// locus — the same metric locusResidual uses against the analytical
// model, so an ensemble-scored and an analytical-scored residual are
// directly comparable.
function residualVsEnsembleLocus(rows, points) {
  let sse = 0;
  for (const row of rows) {
    const m = interpLinear(points, Number(row.tau));
    const dC = Number(row.C) - m.C;
    const dChi = Number(row.chi) - m.chi;
    sse += dC * dC + dChi * dChi;
  }
  return sse / rows.length;
}

// Score one chit candidate: ensemble-derived locus where it converges,
// analytical locus where the cooperative kernel diverges.
async function scoreChitCandidate(chit, gamma, rows) {
  try {
    const params = mapToSolverParams(chit, gamma);
    const { locus_points } = await computeEnsembleLocus(params, SCORING_ENSEMBLE_OPTS);
    const sane = locus_points.length >= 4 && locus_points.every(p =>
      Number.isFinite(p.C) && Number.isFinite(p.chi) &&
      p.C >= SANE_LO && p.C <= SANE_HI && p.chi >= SANE_LO && p.chi <= SANE_HI);
    if (!sane) throw new Error('coarse ensemble locus out of sane bounds');
    return { chit, residual: residualVsEnsembleLocus(rows, locus_points), scored: 'ensemble' };
  } catch {
    // Cooperative-band divergence (or a solver hiccup) — fall this
    // candidate back to the analytical locus. Same MSE metric, same
    // normalised (C, χ) space → comparable to the ensemble-scored ones.
    return { chit, residual: locusResidual(rows, chit), scored: 'analytical' };
  }
}

async function refineChit(centerChit, gamma, rows) {
  const candidates = [...new Set(
    REFINE_OFFSETS
      .map(o => Math.max(CHIT_MIN, Math.min(CHIT_MAX, centerChit + o)))
      .map(c => Number(c.toFixed(6)))
  )];
  console.log(`[${MODULE_ID}] ensemble refine — scoring ${candidates.length} chit candidates around ${centerChit.toFixed(3)} (γ_AB=${gamma.toFixed(2)})`);
  let nEnsemble = 0, nAnalytical = 0, best = null;
  for (const c of candidates) {
    const scored = await scoreChitCandidate(c, gamma, rows);
    if (scored.scored === 'ensemble') nEnsemble++; else nAnalytical++;
    if (!best || scored.residual < best.residual) best = scored;
  }
  const observable =
    nEnsemble > 0 && nAnalytical > 0 ? 'gfdr-locus-hybrid'
    : nEnsemble > 0 ? 'gfdr-locus-ensemble'
    : 'gfdr-locus-analytical';
  return { chit: best.chit, residual: best.residual, observable, nEnsemble, nAnalytical };
}

/* ---------- γ_AB fit — phase-locking observable (#6 / D1) ---------- */

// Grid-search γ_AB against an empirical Kuramoto order parameter r. r is
// not symmetric in sign(γ_AB) once the modes lock — in-phase lock gives
// r ∈ [~0.71, 1], anti-phase gives r ∈ [0, ~0.71] — so the full-range
// grid recovers γ_AB's sign as well as its magnitude. (Below lock, r is
// sign-symmetric; a drift-regime empirical r leaves the sign ambiguous —
// a documented limitation.)
async function fitGamma(chit, empiricalR) {
  let best = null;
  for (let i = 0; i < GAMMA_FIT_STEPS; i++) {
    const gamma = GAMMA_FIT_MIN + i * (GAMMA_FIT_MAX - GAMMA_FIT_MIN) / (GAMMA_FIT_STEPS - 1);
    let r;
    try {
      ({ r } = await computePhaseLockingR(chit, gamma));
    } catch {
      continue;  // diverged candidate — skip
    }
    if (!Number.isFinite(r)) continue;
    const residual = Math.abs(r - empiricalR);
    if (!best || residual < best.residual) best = { gamma, residual, r };
  }
  if (!best) throw new Error('no finite phase-locking candidate across the γ_AB grid');
  return best;
}

/* ---------- orchestration ---------- */

async function handleDataReady(dataUpload) {
  const myGen = ++fitGen;
  const rows = (dataUpload.data || []).filter(r =>
    Number.isFinite(Number(r.tau)) && Number.isFinite(Number(r.C)) && Number.isFinite(Number(r.chi)));
  if (rows.length < 2) {
    reportError('inversion_insufficient_data',
      `dataset ${dataUpload.upload_id} has fewer than 2 usable (tau, C, chi) rows — cannot fit`);
    return;
  }

  const solverUp = solver.getLoadState() !== 'error';

  // --- chit: analytical localise, then ensemble refine ---
  const analytical = fitChitAnalytical(rows);
  let chit = analytical.chit;
  let locus_residual = analytical.residual;
  let chitObservable = 'gfdr-locus-analytical';
  if (solverUp) {
    try {
      const refined = await refineChit(analytical.chit, currentGamma, rows);
      if (myGen !== fitGen) return;                     // superseded
      chit = refined.chit;
      locus_residual = refined.residual;
      chitObservable = refined.observable;
    } catch (err) {
      console.warn(`[${MODULE_ID}] ensemble refine failed wholesale; keeping the analytical chit fit:`, err);
    }
  } else {
    console.warn(`[${MODULE_ID}] solver unavailable — analytical-only chit fit`);
  }

  // --- γ_AB: phase-locking observable, when the upload carries one ---
  let gamma = currentGamma;
  let gammaConstrained = false;
  let gammaObservable = 'none';
  let gamma_residual = null;
  const empiricalR = Number(dataUpload.scalar_observables?.phase_locking_r);
  if (solverUp && Number.isFinite(empiricalR)) {
    try {
      const g = await fitGamma(chit, empiricalR);
      if (myGen !== fitGen) return;                     // superseded
      gamma = g.gamma;
      gammaConstrained = true;
      gammaObservable = 'phase-locking-r';
      gamma_residual = g.residual;
    } catch (err) {
      console.warn(`[${MODULE_ID}] phase-locking γ_AB fit failed; carrying γ_AB through unconstrained:`, err);
    }
  }

  if (myGen !== fitGen) return;
  const regime = vertexRegime(chit);

  // Parameter-populated STATE_REQUEST — same shape the slider emits, plus
  // substrate_class and fit_provenance (parameters allows
  // additionalProperties per contract 01). fit_provenance carries the
  // three slot-aware fields (foundational-answers §Q6) so M-Corpus can
  // ingest the fit later: fitted_params, observable_used, substrate_class_id.
  bus.publish('STATE_REQUEST', {
    request_id: uuid(),
    timestamp: new Date().toISOString(),
    mode: currentMode,
    framework_version: FRAMEWORK_VERSION,
    substrate_class: dataUpload.substrate_class || 'unknown',
    parameters: {
      chit,
      gamma_AB: gamma,
      fit_provenance: {
        source: MODULE_ID,
        data_id: dataUpload.upload_id,
        fitted_params: {
          chit: 'constrained_by_gfdr_locus',
          gamma_AB: gammaConstrained
            ? 'constrained_by_phase_locking_r'
            : 'unconstrained_by_gfdr_locus_d1'
        },
        observable_used: {
          chit: chitObservable,           // analytical | ensemble | hybrid
          gamma_AB: gammaObservable        // phase-locking-r | none
        },
        substrate_class_id: dataUpload.substrate_class || 'unclassified',
        locus_residual,
        gamma_residual,
        regime
      }
    }
  });
  console.log(
    `[${MODULE_ID}] fit complete — chit=${chit.toFixed(3)} (${regime}), ` +
    `locus_residual=${locus_residual.toExponential(2)}, chit observable=${chitObservable}; ` +
    (gammaConstrained
      ? `γ_AB=${gamma.toFixed(3)} fit against phase-locking r (residual=${gamma_residual.toExponential(2)})`
      : `γ_AB=${gamma.toFixed(3)} carried through — unconstrained by the gFDR locus (D1)`)
  );
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
    capabilities: ['parameter_inversion', 'gfdr_locus_fit', 'ensemble_locus_scoring', 'phase_locking_gamma_fit'],
    subscribes_to: ['DATA_READY', 'STATE_REQUEST'],
    publishes: ['STATE_REQUEST', 'ERROR_REPORT'],
    computational_profile: 'heavy',
    status: 'active',
    session_implemented_in: 7
  });
  bus.subscribe('DATA_READY', handleDataReady);
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active (M-Inversion proper — ensemble-derived chit scoring + phase-locking γ_AB fit)`);
}

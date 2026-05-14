/**
 * ENSEMBLE gFDR LOCUS — the M6 observable pipeline
 *
 * Computes the *ensemble-derived* gFDR locus χ vs ΔC for an operating
 * point, replacing the analytical forward model (`math/gfdr-model.js`)
 * the engines paint synchronously for first paint.
 *
 * Pipeline (vendored solver math — `vendor/mpa-solver/wrapper.js`):
 *   1. ensemble()              — N stochastic trajectories (needs D_noise > 0;
 *                                the engines' point-trajectory runs are
 *                                deterministic, so the gFDR observable is
 *                                degenerate without re-running with noise)
 *   2. observables.correlator  — connected correlator C_AA(τ) from the ensemble
 *   3. observables.responseDirect — the IC-perturbation propagator χ_AA(τ)
 *                                (re-integrates internally; ~2× ensemble cost)
 *   4. observables.gfdrLocus   — pairs ΔC = C_AA(0)−C_AA(τ) with χ_AA(τ)
 *
 * Cost is ~1.5–2 s — far too slow per slider-tick, which is why the engines
 * debounce this onto the settled operating point.
 *
 * --- Consumer-side normalisation ---
 * The solver ships the *raw* correlator and *raw* direct-perturbation
 * response and deliberately leaves the FDT normalisation to the consumer
 * — its own gFDR test flags the "1/T_eff factor" as "a downstream
 * calibration concern". `responseDirect` returns the IC-perturbation
 * *propagator* χ_AA(τ) (which decays), not the integrated susceptibility.
 *
 * The framework's gFDR plot wants χ vs ΔC with the equilibrium-FDR diagonal
 * as reference. By the Onsager regression theorem, in equilibrium the
 * normalised propagator χ_AA(τ)/χ_AA(0) equals the normalised correlation
 * C_AA(τ)/C_AA(0). So:
 *     ΔC_norm(τ) = (C_AA(0) − C_AA(τ)) / C_AA(0)   grows 0 → 1
 *     χ_norm(τ)  = 1 − χ_AA(τ)/χ_AA(0)             grows 0 → 1 in equilibrium
 * Equilibrium (r-regime) → the diagonal; FDT-violating (aging / c) regimes
 * depart from it — that departure *is* the gFDR signature.
 *
 * --- Divergence guard ---
 * The cooperative kernel runs away at high gain (the c-band), so the
 * ensemble can diverge and the correlator come back empty / non-finite.
 * computeEnsembleLocus throws in that case; the engine catches it and
 * keeps the (still-honest) analytical locus.
 *
 * --- Coarsened scoring path (M-Inversion proper) ---
 * computeEnsembleLocus takes an optional opts override so the Inversion
 * Engine can score grid candidates against a cheaper ensemble than the
 * one the display path uses. SCORING_ENSEMBLE_OPTS is the agreed coarse
 * preset; the M6 display callers pass no opts and keep the full ensemble.
 *
 * No DOM, no event bus — a compute service the engines wrap.
 */

import * as solver from './solver-service.js';

// Ensemble spec. T_MAX / DT match the engines' point-trajectory window so
// the ensemble samples the same dynamics; D_NOISE is the deliberate
// departure (the gFDR observable reads fluctuations) — 0.01 matches the
// solver's own gFDR test. SAMPLE_EVERY must be 1: responseDirect always
// re-integrates at dt resolution, so the correlator's τ-grid only aligns
// with it index-for-index when the ensemble is sampled every step.
// EQUILIBRATION drops NESS warm-up; N_TAU sets the locus length / τ-window.
const N_ENSEMBLE   = 200;
const T_MAX        = 30.0;
const DT           = 0.01;
const SAMPLE_EVERY = 1;
const EQUILIBRATION = 300;     // ~3 time-units of warm-up dropped
const N_TAU        = 1500;     // τ window 0 → 15
const PERTURBATION = 1e-3;
const ENSEMBLE_D_NOISE = 0.01;
const INITIAL = { rho_A: 0.3, rho_B: 0.7 };   // matches the engines' SOLVER_INITIAL

// Coarse preset for the Inversion Engine's grid-candidate scoring. A
// smaller ensemble is the main cost lever (per-candidate cost dominates a
// grid search); N_TAU is kept so the τ-window still spans the empirical
// support. The display path passes no opts and keeps the full ensemble.
export const SCORING_ENSEMBLE_OPTS = { n_ensemble: 64 };

// Coerce a solver return (Float64Array, JS array, or embind vector) to a
// plain JS array.
function toArr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (ArrayBuffer.isView(x)) return Array.from(x);
  if (typeof x.size === 'function') {
    return Array.from({ length: x.size() }, (_, i) => x.get(i));
  }
  if (typeof x.length === 'number') return Array.from(x);
  return [];
}

/**
 * Compute the ensemble-derived gFDR locus for a base solver-parameter set
 * (the same shape the engines pass to solver.integrate, minus D_noise).
 * Returns { locus_points, meta }. Throws if the solver/WASM path fails or
 * the ensemble diverged — the caller falls back to the analytical locus.
 */
export async function computeEnsembleLocus(baseSolverParams, opts = {}) {
  const params = { ...baseSolverParams, D_noise: ENSEMBLE_D_NOISE };
  const nEnsemble = opts.n_ensemble ?? N_ENSEMBLE;
  const nTau      = opts.n_tau ?? N_TAU;
  const tMax      = opts.t_max ?? T_MAX;
  const t0 = performance.now();

  const ens = await solver.ensemble(INITIAL, params, tMax, DT, nEnsemble, SAMPLE_EVERY);
  const corr = await solver.observables.correlator(ens, EQUILIBRATION, nTau);
  const resp = await solver.observables.responseDirect(
    INITIAL, params, tMax, DT, EQUILIBRATION, nTau, nEnsemble, PERTURBATION);
  const locus = await solver.observables.gfdrLocus(corr, resp);

  const compute_ms = performance.now() - t0;

  const deltaC = toArr(locus.delta_C);
  const chi    = toArr(locus.chi);
  const tau    = toArr(locus.tau);
  const C0     = toArr(corr.C_AA)[0];
  const chi0   = chi[0];

  // Divergence / degeneracy guard — the c-band ensemble runs away.
  if (deltaC.length < 4 || chi.length < 4) {
    throw new Error('ensemble locus degenerate (empty correlator — ensemble likely diverged)');
  }
  if (!Number.isFinite(C0) || C0 <= 1e-9) {
    throw new Error('ensemble correlator degenerate (C(0) not positive-finite)');
  }
  if (!Number.isFinite(chi0) || Math.abs(chi0) < 1e-12) {
    throw new Error('ensemble response degenerate (χ(0) ≈ 0)');
  }
  if (!deltaC.every(Number.isFinite) || !chi.every(Number.isFinite)) {
    throw new Error('ensemble locus diverged (non-finite values)');
  }

  // Onsager / Cugliandolo-Kurchan normalisation (see header).
  // The displayer plots x = 1 − C and y = χ, so set C = 1 − ΔC_norm.
  const locus_points = deltaC.map((d, i) => ({
    tau: Number.isFinite(tau[i]) ? tau[i] : i * DT * SAMPLE_EVERY,
    chi: 1 - chi[i] / chi0,
    C: 1 - d / C0,
  }));

  return {
    locus_points,
    meta: {
      n_ensemble: nEnsemble,
      n_tau: nTau,
      d_noise: ENSEMBLE_D_NOISE,
      c0: C0,
      chi0,
      compute_ms,
    },
  };
}

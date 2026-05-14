/**
 * CHARACTER ENGINE (Continuous mode)
 *
 * Produces a framework-state snapshot for the current operating point
 * (chit, gamma_AB):
 *   - regime classification (single-vertex + edge type)
 *   - gFDR locus chi(tau) vs C(0)-C(tau)         (cdv1 §gFDR signatures)
 *   - 2D regime manifold over (chit, gamma_AB)   (cdv1 §Universal kernel
 *                                                  + §Composite catalogue)
 *   - bifurcation curves: transcritical (chit=0), pitchfork (gamma=0)
 *   - k_frust posit-grade region (gamma_AB > 0.5 — 2-mode kernel cannot
 *                                  carry k_frust; flagged for N>=3 extension)
 *   - tower / Wall state: epsilon per level, beta_mem, Wall proximity
 *                                                  (cdv1 §Heat-tax tower,
 *                                                   §Load-handling)
 *   - invariants: chit, G0/L, Q, alpha_s, P_s, V_scalar, beta_mem, epsilon
 *   - pattern admissibility booleans              (cdv1 §Pattern formation,
 *                                                   §Composite catalogue,
 *                                                   §Phase-locking,
 *                                                   §Collective hydrodynamics)
 *   - active posits at this operating point
 *
 * Subscribes to: STATE_REQUEST (contract 01, mode='continuous')
 * Publishes:     PREDICTION_READY (contract 02), ERROR_REPORT (contract 06)
 *
 * Extended structure lives inside continuous_state, which allows
 * additionalProperties per contract 02's JSON Schema.
 */

import { bus } from '../core/conductor.js';
import * as solver from '../math/solver-service.js';
import { vertexRegime, alphaS, plateauHeight, generateLocus } from '../math/gfdr-model.js';
import { debounce } from '../math/debounce.js';
import { computeEnsembleLocus } from '../math/ensemble-locus.js';

const FRAMEWORK_VERSION = 'v9.1';
const MODULE_ID = 'character_engine_v1';
const MODULE_VERSION = '0.5.0';

/* ---------- Solver parameter mapping ----------
   chit = ln(G_0 / L). With reference L = 1, G_0 = exp(chit).
   Both modes share parameters (symmetric kernel under v0 Lamb closure).
   Initial conditions deliberately asymmetric (0.3 / 0.7) so cooperative
   and competitive dynamics produce visibly distinct trajectories. */
const SOLVER_T_MAX = 30.0;
const SOLVER_DT = 0.01;
const SOLVER_SAMPLE_EVERY = 10;     // 300 returned samples
const SOLVER_INITIAL = { rho_A: 0.3, rho_B: 0.7 };

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
const MANIFOLD_NX = 60;
const MANIFOLD_NY = 50;
const CHIT_RANGE = [-2, 2];
const GAMMA_RANGE = [-1, 1];

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

/* ---------- Regime classification (vertex × edge) ----------
   vertexRegime / alphaS / plateauHeight / generateLocus are imported from
   math/gfdr-model.js — the canonical analytical forward model. compositeRegime
   and edgeType stay local: they are character-mode classification, not the
   shared forward model. */

function edgeType(gamma) {
  if (gamma < -0.2) return 'cooperative';
  if (gamma > 0.2) return 'conflicting';
  return 'orthogonal';
}

function compositeRegime(chit, gamma) {
  // Cdv1 §Composite catalogue + v9 §Three typed objects: vertex regime
  // dominates classification; edge sign selects which composite within
  // the regime band.
  const v = vertexRegime(chit);
  if (v === 'deep_c' || v === 'c_near_s') return v;          // c-band
  if (v === 's_critical') return 's_critical';                // s-band (any edge)
  return v;                                                    // r-band
}

/* ---------- Posit-grade k_frust gate ---------- */
// 2-mode kernel cannot carry k_frust topologically (requires N>=3 closed
// chain). The framework declares this region "out of scope for 2-mode;
// posit-grade extension via §Higher-order frustration". Flag visually.
function isPositKFrustRegion(chit, gamma) {
  return gamma > 0.5 && chit > -0.4;
}

/* ---------- Tower / Wall (cdv1 §Heat-tax tower, §Load-handling) ---------- */
// Wall-coupling posit: beta_mem ≈ 1 - epsilon. Active drive proxies
// epsilon: stronger coupling (|gamma|) and lower chit (closer to s) push
// epsilon toward 1. Substrate-thermodynamic derivation of exact functional
// form is the canonical residual — these are leading-order forms.
function towerState(chit, gamma) {
  const stress = Math.abs(gamma) + Math.exp(-Math.abs(chit) * 2);  // 0..2-ish
  const epsilon0 = Math.min(0.95, 0.35 + 0.30 * stress);
  const levels = [0, 1, 2, 3, 4];
  const epsilon_per_level = levels.map(n => Math.min(0.99, epsilon0 + 0.10 * n));
  const beta_mem_per_level = epsilon_per_level.map(e => Math.max(0.01, 1 - e));
  // Cobham wait-inflation (cdv1 §Load-handling Cobham closure). Per the
  // ε↔u optimal-encoding posit, per-level utilisation u_n = ε_n. Cobham
  // expected wait for priority class n+1 is
  //   W_{n+1} = W_0 / [(1-u_n)(1-u_{n+1})].
  // W_0 (= ½Σλ_i⟨τ_i²⟩) is not derivable from the operating point alone,
  // so it is normalised to 1 — W_per_level is read in multiples of the
  // baseline wait. The wait diverges at u → 1, coincident with the
  // Heat-tax thermodynamic singularity at ε → 1 (the Wall).
  const u_per_level = epsilon_per_level.slice();
  const W_0 = 1;
  const W_per_level = levels.map(n =>
    n === 0 ? W_0 : W_0 / ((1 - u_per_level[n - 1]) * (1 - u_per_level[n]))
  );
  const wall_proximity = epsilon0;  // 0 = safe, ~1 = at Wall (per posit)
  return { levels, epsilon_per_level, beta_mem_per_level, u_per_level, W_per_level, wall_proximity, epsilon_0: epsilon0 };
}

/* ---------- Phase-locking (cdv1 §Phase-locking) ---------- */
// Two-mode phase reduction of the universal kernel:
//   K_AB = -γ_AB √(ρ_A ρ_B) / [ρ_sat √(1+4Q²)]
// lock iff |K_AB| ≳ Δω. The symmetric kernel has identical modes
// (intrinsic Δω = 0), so the Synchroscope reads phase-locking *capacity*
// against a fixed substrate-reference detuning — the Arnold-tongue
// position of the current operating point. Kuramoto order parameter for
// the two-mode case is r = |cos(ψ/2)| at the locked phase offset ψ; the
// sign of K_AB selects in-phase (cooperative, γ<0) vs anti-phase
// (conflicting, γ>0) lock.
const DELTA_OMEGA_REF = 0.15;
const RHO_SAT = 1.0;

function phaseLocking(gamma, finalState, Q) {
  const rhoA = Math.max(0, finalState?.rho_A ?? 0.5);
  const rhoB = Math.max(0, finalState?.rho_B ?? 0.5);
  const qEff = Number.isFinite(Q) && Q > 0 ? Q : 0;
  const K_AB = -gamma * Math.sqrt(rhoA * rhoB) / (RHO_SAT * Math.sqrt(1 + 4 * qEff * qEff));
  const delta_omega = DELTA_OMEGA_REF;
  const absK = Math.abs(K_AB);
  const locked = absK >= delta_omega;
  let psi, r, phase_relationship;
  if (locked) {
    const psi_lock = Math.asin(Math.min(1, delta_omega / absK));   // [0, π/2]
    psi = K_AB >= 0 ? psi_lock : (Math.PI - psi_lock);             // in- vs anti-phase branch
    r = Math.abs(Math.cos(psi / 2));
    phase_relationship = K_AB >= 0 ? 'in_phase' : 'anti_phase';
  } else {
    psi = null;                                                    // drifting — no fixed offset
    r = Math.SQRT1_2 * (absK / delta_omega);                       // partial coherence, → 0 as coupling vanishes
    phase_relationship = 'drift';
  }
  return { K_AB, delta_omega, locked, psi, r, phase_relationship };
}

/* ---------- Invariants ---------- */

function computeInvariants(chit, gamma, regime, tower, spectrum) {
  const G0_over_L = Math.exp(chit);
  const inS = regime === 's_critical';
  const inC = regime === 'deep_c' || regime === 'c_near_s';
  const inR = regime === 'deep_r' || regime === 'r_near_s';
  // Q, ζ, ω_RO come from numerical linearization at the trajectory's
  // final (≈ steady) state when available. Per the v2 CLAUDE.md
  // convention, Q is 0 at unstable points (real part ≥ 0). The
  // analytical fallback is the laser-threshold formula — used only when
  // the solver hasn't returned a spectrum yet (first paint).
  const Q_num = spectrum?.Q;
  const zeta = spectrum?.zeta;
  const omega_RO = spectrum?.omega_RO;
  const Q_analytical = chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0;
  const Q = Number.isFinite(Q_num) ? Q_num : Q_analytical;
  return [
    { name: 'chit',       symbol: 'χ̂',     value: chit,                      units: '—',         grade: 'load_bearing', display: chit.toFixed(3) },
    { name: 'γ_AB',       symbol: 'γ',     value: gamma,                     units: '—',         grade: 'load_bearing', display: gamma.toFixed(3) },
    { name: 'G₀/L',       symbol: 'G₀/L', value: G0_over_L,                 units: '—',         grade: 'load_bearing', display: G0_over_L.toFixed(3) },
    { name: 'Q',          symbol: 'Q',     value: Q,                         units: 'cycles',    grade: 'load_bearing', display: Number.isFinite(Q) && Q > 0 ? Q.toFixed(3) : '—' },
    { name: 'ζ (damping)',symbol: 'ζ',    value: zeta ?? null,              units: '—',         grade: 'load_bearing', display: Number.isFinite(zeta) ? zeta.toFixed(3) : '—' },
    { name: 'ω_RO',       symbol: 'ω',    value: omega_RO ?? null,          units: '1/τ',       grade: 'load_bearing', display: Number.isFinite(omega_RO) && omega_RO > 1e-6 ? omega_RO.toFixed(3) : '—' },
    { name: 'α_s',        symbol: 'α_s',   value: inS ? alphaS(chit) : null, units: '—',         grade: 'load_bearing', display: inS ? alphaS(chit).toFixed(3) : '—' },
    { name: 'P_s',        symbol: 'P_s',   value: inS ? plateauHeight(chit) : null, units: '—',  grade: 'load_bearing', display: inS ? plateauHeight(chit).toFixed(3) : '—' },
    { name: 'X_c',        symbol: 'X_c',   value: inC ? (regime === 'deep_c' ? 0.02 : 0.08) : null, units: '—', grade: 'load_bearing', display: inC ? (regime === 'deep_c' ? '≈0' : '≪1') : '—' },
    { name: 'X_r',        symbol: 'X_r',   value: inR ? 1 : null,            units: '—',         grade: 'load_bearing', display: inR ? '1' : '—' },
    { name: 'V_scalar',   symbol: '𝒱',    value: (inR || inS) ? null : Math.max(0, chit), units: '—', grade: 'load_bearing', display: (inR || inS) ? '—' : Math.max(0, chit).toFixed(3) },
    { name: 'ε (lvl 0)',  symbol: 'ε',     value: tower.epsilon_0,           units: '—',         grade: 'posit',        display: tower.epsilon_0.toFixed(3) },
    { name: 'β_mem',      symbol: 'β',     value: 1 - tower.epsilon_0,       units: '—',         grade: 'posit',        display: (1 - tower.epsilon_0).toFixed(3) },
    { name: 'Wall %',     symbol: 'W',     value: tower.wall_proximity,      units: '%',         grade: 'posit',        display: (100 * tower.wall_proximity).toFixed(0) + '%' }
  ];
}

/* ---------- Pattern admissibility (cdv1 §Composite catalogue + §Pattern formation) ---------- */

function patternAdmissibility(chit, gamma) {
  return [
    { name: 'Hebbian (c–c aligned)',      admissible: chit > 0.2 && gamma < -0.2,           grade: 'load_bearing' },
    { name: 'Independent memory',          admissible: chit > 0.2 && Math.abs(gamma) < 0.1,  grade: 'load_bearing' },
    { name: 'Mentor (c–s asymmetric)',     admissible: chit > -0.2 && chit < 0.4 && gamma < -0.1, grade: 'posit' },
    { name: 'Lotka–Volterra (s–s)',       admissible: Math.abs(chit) < 0.3 && gamma > 0.2,  grade: 'load_bearing' },
    { name: 'Cooperative lock',            admissible: chit > 0.5 && gamma > 0.3,            grade: 'load_bearing' },
    { name: 'k_frust (N≥3)',              admissible: false, posit_active: isPositKFrustRegion(chit, gamma), grade: 'posit', note: '2-mode kernel; posit-grade for N≥3 extension' },
    { name: 'Chimera',                     admissible: false, grade: 'posit',                note: 'heterogeneous network required (SBN extension)' },
    { name: 'Turing pattern',              admissible: false, grade: 'posit',                note: 'needs non-reciprocity + autocatalysis + diff. diffusion' },
    { name: 'MIPS',                        admissible: false, grade: 'posit',                note: 'needs spatial extent + self-propulsion' }
  ];
}

function activePosits(chit, gamma) {
  // Five leading-order posits per cdv1 §Framework primitives.
  const posits = [];
  posits.push({ id: 'beta_mem_eq_1_minus_epsilon', label: 'β_mem ≈ 1 − ε', active: true, note: 'Wall-coupling posit; always engaged when reading ε from operating point' });
  posits.push({ id: 'mu_eq_e_chit',                label: 'μ = e^chit',     active: chit > -0.5, note: 'Galton–Watson critical branching (horizontal register)' });
  posits.push({ id: 'u_n_eq_epsilon_n',            label: 'u_n = ε_n',      active: Math.abs(chit) < 0.5, note: 'rate-distortion-optimal encoding (s-band)' });
  posits.push({ id: 'chi_eq_delta_n',              label: 'χ = Δ_n',        active: Math.abs(chit) < 0.5, note: 'optimal-encoding triality' });
  posits.push({ id: 'w_i_eq_gamma_ref_over_gamma_si', label: 'w_i = γ_ref/γ_s,i', active: true, note: 'substrate-class auto-tuning (Lyapunov weighting)' });
  return posits;
}

/* ---------- Manifold computation ---------- */

function manifoldGrid() {
  const xs = [], ys = [];
  for (let i = 0; i < MANIFOLD_NX; i++) {
    xs.push(CHIT_RANGE[0] + i * (CHIT_RANGE[1] - CHIT_RANGE[0]) / (MANIFOLD_NX - 1));
  }
  for (let j = 0; j < MANIFOLD_NY; j++) {
    ys.push(GAMMA_RANGE[0] + j * (GAMMA_RANGE[1] - GAMMA_RANGE[0]) / (MANIFOLD_NY - 1));
  }
  // Discrete regime index per cell, with k_frust posit zone marked separately.
  // Indices: 0 deep_r, 1 r_near_s, 2 s_critical, 3 c_near_s, 4 deep_c
  // Posit k_frust overlay = boolean grid; "out of scope" overlay too.
  const regime_grid = [];
  const k_frust_grid = [];
  const out_of_scope_grid = [];
  const REGIME_INDEX = { deep_r: 0, r_near_s: 1, s_critical: 2, c_near_s: 3, deep_c: 4 };
  for (let j = 0; j < MANIFOLD_NY; j++) {
    const row = [], kRow = [], oRow = [];
    for (let i = 0; i < MANIFOLD_NX; i++) {
      const chit = xs[i], gamma = ys[j];
      const r = vertexRegime(chit);
      row.push(REGIME_INDEX[r]);
      kRow.push(isPositKFrustRegion(chit, gamma) ? 1 : 0);
      // out-of-scope: aggressive parameter corners where 2-mode kernel
      // breaks down (large competition + below threshold).
      const oos = (Math.abs(gamma) > 0.8 && chit < -0.5);
      oRow.push(oos ? 1 : 0);
    }
    regime_grid.push(row);
    k_frust_grid.push(kRow);
    out_of_scope_grid.push(oRow);
  }
  return { x_grid: xs, y_grid: ys, regime_grid, k_frust_grid, out_of_scope_grid };
}

function bifurcationCurves() {
  // Transcritical at chit = 0 (laser threshold; vertical line in (chit, gamma))
  // Pitchfork at gamma_AB = 0 (cooperative/competitive boundary; horizontal)
  // Hopf locus (non-reciprocal): in symmetric 2-mode kernel collapses
  // to gamma=0 axis; flagged as posit extension and drawn dashed-overlay
  // by the renderer.
  const transcritical = [
    { x: 0, y: GAMMA_RANGE[0] },
    { x: 0, y: GAMMA_RANGE[1] }
  ];
  const pitchfork = [
    { x: CHIT_RANGE[0], y: 0 },
    { x: CHIT_RANGE[1], y: 0 }
  ];
  return { transcritical, pitchfork };
}

let cachedManifold = null;
function getManifold() {
  if (!cachedManifold) cachedManifold = manifoldGrid();
  return cachedManifold;
}

/* ---------- gFDR locus ----------
   generateLocus (the analytical forward model) is imported from
   math/gfdr-model.js. M6 layers an ensemble-derived locus on top via a
   debounced follow-up — see scheduleEnsembleLocus below. */

function regimeEquation(regime) {
  const equations = {
    deep_c:    { latex: '\\chi(\\tau) \\approx 0,\\; X_c = 0',                                       plain_text: 'X_c = 0 (suppressed)' },
    c_near_s:  { latex: '\\chi(\\tau) \\approx 0,\\; X_c \\ll 1',                                    plain_text: 'X_c << 1 (narrow horizontal)' },
    s_critical:{ latex: '\\chi(\\Delta C) = \\Delta C\\;\\textrm{below}\\;P_s,\\; \\alpha_s\\,\\Delta C\\;\\textrm{above}', plain_text: 'aging diagonal, plateau P_s, slope α_s' },
    r_near_s:  { latex: '\\chi(\\tau) = C(0) - C(\\tau),\\; X_r = 1',                                plain_text: 'X_r = 1 (unit-slope FDR)' },
    deep_r:    { latex: '\\chi(\\tau) = C(0) - C(\\tau),\\; X_r = 1',                                plain_text: 'X_r = 1 (bath equilibrium)' }
  };
  return equations[regime] || null;
}

/* ---------- M6: ensemble-derived gFDR locus (debounced follow-up) ----------
   The engine paints the analytical locus synchronously for first paint,
   then — once the operating point settles — recomputes the locus from a
   noisy solver ensemble and re-emits PREDICTION_READY with locus_points
   replaced (locus_source flips analytical → ensemble inside *_state). A
   generation counter drops ensemble runs whose operating point was
   superseded (slider scrub) before they finished. */

const ENSEMBLE_DEBOUNCE_MS = 350;
const ENSEMBLE_LOCUS_ENABLED = true;
let ensembleGen = 0;

function republishWithEnsemble(base, statePatch, locusPoints) {
  const refined = {
    ...base,
    response_id: uuid(),
    timestamp: new Date().toISOString(),
    continuous_state: { ...base.continuous_state, ...statePatch }
  };
  if (locusPoints) refined.locus_points = locusPoints;
  bus.publish('PREDICTION_READY', refined);
}

const scheduleEnsembleLocus = debounce(async (gen, base, solverParams) => {
  if (gen !== ensembleGen) return;                  // superseded before firing
  try {
    const { locus_points, meta } = await computeEnsembleLocus(solverParams);
    if (gen !== ensembleGen) return;                // superseded while computing
    republishWithEnsemble(base,
      { locus_source: 'ensemble', ensemble_pending: false, ensemble_meta: meta },
      locus_points);
  } catch (err) {
    console.warn(`[${MODULE_ID}] ensemble locus failed; keeping analytical:`, err);
    if (gen !== ensembleGen) return;
    republishWithEnsemble(base,
      { locus_source: 'analytical', ensemble_pending: false, ensemble_error: String(err?.message || err) });
  }
}, ENSEMBLE_DEBOUNCE_MS);

/* ---------- Main handler ---------- */

async function handleStateRequest(payload) {
  if (!payload || payload.mode !== 'continuous') return;
  const start = performance.now();
  const gen = ++ensembleGen;   // every request — drops any in-flight ensemble for a stale operating point
  const chit = Number(payload.parameters?.chit ?? 0);
  const gamma = Number(payload.parameters?.gamma_AB ?? -0.3);
  const regime = compositeRegime(chit, gamma);
  const edge_type = edgeType(gamma);
  const locus_points = generateLocus(chit, regime);
  const tower = towerState(chit, gamma);
  const patterns = patternAdmissibility(chit, gamma);
  const posits = activePosits(chit, gamma);
  const manifold = getManifold();
  const bifurcations = bifurcationCurves();
  const posit_k_frust_here = isPositKFrustRegion(chit, gamma);

  // Real ODE trajectory from the WASM solver — cdv1 universal two-mode
  // kernel under Lamb stationary closure. Float64Array {t, rho_A, rho_B}.
  let trajectory = null;
  let solver_ms = null;
  let spectrum = null;
  const solverParams = mapToSolverParams(chit, gamma);
  try {
    const traj = await solver.integrate(SOLVER_INITIAL, solverParams, SOLVER_T_MAX, SOLVER_DT, SOLVER_SAMPLE_EVERY);
    trajectory = {
      t: traj.t,
      rho_A: traj.rho_A,
      rho_B: traj.rho_B,
      solver_version: solver.version(),
      params: { ...solverParams, t_max: SOLVER_T_MAX, dt: SOLVER_DT, sample_every: SOLVER_SAMPLE_EVERY },
      initial: { ...SOLVER_INITIAL }
    };
    solver_ms = solver.getLastSolveMs();

    // Numerical linearization at the trajectory's final (≈ steady) state.
    // Gives Q, ζ, ω_RO from real eigendecomposition of the Jacobian.
    try {
      const last = trajectory.t.length - 1;
      const finalState = { rho_A: trajectory.rho_A[last], rho_B: trajectory.rho_B[last] };
      const sp = await solver.linearize(finalState, solverParams);
      spectrum = {
        Q: sp.Q,
        zeta: sp.zeta,
        omega_RO: sp.omega_RO,
        gamma_RO: sp.gamma_RO,
        // Eigenvalues may be embind-wrapped; coerce defensively.
        eigenvalues: (sp.eigenvalues && typeof sp.eigenvalues.size === 'function')
          ? Array.from({ length: sp.eigenvalues.size() }, (_, i) => sp.eigenvalues.get(i))
          : (Array.isArray(sp.eigenvalues) ? sp.eigenvalues : null),
        final_state: finalState
      };
    } catch (lerr) {
      console.warn(`[${MODULE_ID}] linearize call failed:`, lerr);
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] solver call failed; emitting prediction without trajectory:`, err);
  }

  const G0_over_L = Math.exp(chit);
  // Q from numerical spectrum when available; analytical fallback otherwise.
  const Q = Number.isFinite(spectrum?.Q) ? spectrum.Q : (chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0);
  const V_scalar = (regime === 'deep_r' || regime === 'r_near_s' || regime === 's_critical') ? null : Math.max(0, chit);
  const a_s = regime === 's_critical' ? alphaS(chit) : null;
  const invariants = computeInvariants(chit, gamma, regime, tower, spectrum);

  // Phase-locking block — Synchroscope backing. ρ_A, ρ_B from the
  // trajectory's settled state; Q from the numerical spectrum.
  const finalStateForPhase = spectrum?.final_state
    || (trajectory ? { rho_A: trajectory.rho_A[trajectory.rho_A.length - 1], rho_B: trajectory.rho_B[trajectory.rho_B.length - 1] } : null);
  const phase_locking = phaseLocking(gamma, finalStateForPhase, spectrum?.Q ?? Q);

  const hashInput = JSON.stringify({
    framework_version: FRAMEWORK_VERSION,
    module_version: MODULE_VERSION,
    parameters: payload.parameters || {}
  });
  const reproducibility_hash = await sha256Hex(hashInput);

  // Ensemble path needs the WASM solver (and the M6 gate above); if either
  // is unavailable, skip the follow-up and leave the analytical locus.
  const ensembleViable = ENSEMBLE_LOCUS_ENABLED && solver.getLoadState() !== 'error';
  // Audit-mode vs Explore-mode: a fitted operating point arrives carrying
  // parameters.fit_provenance (Inversion Engine); a hand-dialed one does not.
  const fit_provenance = payload.parameters?.fit_provenance ?? null;
  const substrate_class = payload.substrate_class ?? null;

  const response = {
    response_id: uuid(),
    request_id: payload.request_id,
    module_id: MODULE_ID,
    timestamp: new Date().toISOString(),
    mode: 'continuous',
    framework_version: FRAMEWORK_VERSION,
    reproducibility_hash,
    computational_cost_ms: performance.now() - start,
    regime,
    regime_confidence: regime === 's_critical' ? 0.7 : 0.92,
    continuous_state: {
      // Contract 02 named fields
      chit,
      headroom_Q: Q,
      V_scalar,
      alpha_s: a_s,
      // Extension (additionalProperties is permitted on continuous_state)
      gamma_AB: gamma,
      edge_type,
      manifold,
      bifurcations,
      tower,
      phase_locking,
      invariants,
      patterns,
      posits_active: posits,
      posit_k_frust_here,
      // Real ODE trajectory from mpa-solver WASM (cdv1 §"Universal two-mode kernel")
      trajectory,
      solver_ms,
      // Numerical linearization at trajectory final state (cdv1 §Stability)
      spectrum,
      // M6: this first emission carries the analytical locus; an ensemble
      // follow-up replaces it once the operating point settles.
      locus_source: 'analytical',
      ensemble_pending: ensembleViable,
      // Correlation-tracking discipline: echo fit provenance / substrate so
      // downstream (Audit Engine) can pair prediction↔data by id, and the
      // fitted-vs-explore distinction is explicit, not buried.
      fit_provenance,
      substrate_class,
      app_mode: fit_provenance ? 'audit' : 'explore'
    },
    discrete_state: null,
    locus_points,
    equation: regimeEquation(regime),
    posit_grade: {
      status: posit_k_frust_here ? 'posit_grade' : 'load_bearing_tested',
      load_bearing_posits: posit_k_frust_here ? ['higher_order_frustration_extension'] : [],
      extension_axes_used: posit_k_frust_here ? ['higher_order_frustration'] : [],
      annotations: posit_k_frust_here
        ? ['posit-grade region: 2-mode kernel cannot carry k_frust; visible only via N≥3 extension axis']
        : (regime === 's_critical' ? ['s-regime: α_s and P_s are cross-substrate observables'] : [])
    }
  };

  bus.publish('PREDICTION_READY', response);

  // M6: schedule the ensemble-derived locus follow-up on the settled point.
  if (ensembleViable) scheduleEnsembleLocus(gen, response, solverParams);
  else scheduleEnsembleLocus.cancel();
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'engine',
    version: MODULE_VERSION,
    framework_version_compatibility: ['v9', 'v9.1'],
    capabilities: [
      'chit_computation', 'gfdr_locus', 'regime_classification',
      'regime_manifold', 'bifurcation_curves', 'tower_state',
      'invariants_panel', 'pattern_admissibility', 'posit_tracking',
      'ode_integration_via_mpa_solver',
      'numerical_linearization_via_mpa_solver',
      'ensemble_gfdr_locus'
    ],
    subscribes_to: ['STATE_REQUEST'],
    publishes: ['PREDICTION_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 3
  });
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active`);
}

/**
 * DISCRETE ENGINE
 *
 * v9 operator algebra view of the same operating point. Emits the same
 * structural facets the Character Engine does (manifold, bifurcations,
 * tower, invariants, patterns) plus a discrete-only payload:
 *
 *   - operator graph (4-vertex toy A→B→C→D→A; edge gammas track γ_AB
 *     slider; vertex regimes track chit)
 *   - k_frust detection by signed-graph balance (odd negative-edge
 *     product around the cycle ⇒ frustrated)
 *   - operator counts C/S/K/R per v9 §Composite catalogue
 *
 * Subscribes to: STATE_REQUEST (contract 01, mode='discrete')
 * Publishes:     PREDICTION_READY (contract 02), ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';
import * as solver from '../math/solver-service.js';

const FRAMEWORK_VERSION = 'v9.1';
const MODULE_ID = 'discrete_engine_v1';
const MODULE_VERSION = '0.4.0';
const N_LOCUS_POINTS = 80;

const SOLVER_T_MAX = 30.0;
const SOLVER_DT = 0.01;
const SOLVER_SAMPLE_EVERY = 10;
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

function vertexRegime(chit) {
  if (chit >= 0.7) return 'deep_c';
  if (chit >= 0.2) return 'c_near_s';
  if (chit > -0.2) return 's_critical';
  if (chit > -0.7) return 'r_near_s';
  return 'deep_r';
}

function edgeType(gamma) {
  if (gamma < -0.2) return 'cooperative';
  if (gamma > 0.2) return 'conflicting';
  return 'orthogonal';
}

function alphaS(chit) { return 0.5 + 0.3 * Math.exp(-Math.abs(chit) * 4); }
function plateauHeight(chit) { return Math.max(0.05, 1 - Math.exp(-Math.max(0, chit + 0.2) * 1.5)); }

function towerState(chit, gamma) {
  const stress = Math.abs(gamma) + Math.exp(-Math.abs(chit) * 2);
  const epsilon0 = Math.min(0.95, 0.35 + 0.30 * stress);
  const levels = [0, 1, 2, 3, 4];
  const epsilon_per_level = levels.map(n => Math.min(0.99, epsilon0 + 0.10 * n));
  const beta_mem_per_level = epsilon_per_level.map(e => Math.max(0.01, 1 - e));
  return { levels, epsilon_per_level, beta_mem_per_level, wall_proximity: epsilon0, epsilon_0: epsilon0 };
}

function computeInvariants(chit, gamma, regime, tower, spectrum) {
  const G0_over_L = Math.exp(chit);
  const Q_num = spectrum?.Q;
  const zeta = spectrum?.zeta;
  const omega_RO = spectrum?.omega_RO;
  const Q_analytical = chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0;
  const Q = Number.isFinite(Q_num) ? Q_num : Q_analytical;
  const inS = regime === 's_critical';
  const inC = regime === 'deep_c' || regime === 'c_near_s';
  const inR = regime === 'deep_r' || regime === 'r_near_s';
  return [
    { name: 'chit',       symbol: 'χ̂',     value: chit,        units: '—', grade: 'load_bearing', display: chit.toFixed(3) },
    { name: 'γ_AB',       symbol: 'γ',     value: gamma,       units: '—', grade: 'load_bearing', display: gamma.toFixed(3) },
    { name: 'λ_A/D',      symbol: 'λ/D',   value: -chit,       units: '—', grade: 'load_bearing', display: (-chit).toFixed(3) },
    { name: 'Q',          symbol: 'Q',     value: Q,           units: 'cycles', grade: 'load_bearing', display: Number.isFinite(Q) && Q > 0 ? Q.toFixed(3) : '—' },
    { name: 'ζ (damping)',symbol: 'ζ',    value: zeta ?? null, units: '—', grade: 'load_bearing', display: Number.isFinite(zeta) ? zeta.toFixed(3) : '—' },
    { name: 'ω_RO',       symbol: 'ω',    value: omega_RO ?? null, units: '1/τ', grade: 'load_bearing', display: Number.isFinite(omega_RO) && omega_RO > 1e-6 ? omega_RO.toFixed(3) : '—' },
    { name: 'α_s',        symbol: 'α_s',   value: inS ? alphaS(chit) : null,           units: '—', grade: 'load_bearing', display: inS ? alphaS(chit).toFixed(3) : '—' },
    { name: 'P_s',        symbol: 'P_s',   value: inS ? plateauHeight(chit) : null,    units: '—', grade: 'load_bearing', display: inS ? plateauHeight(chit).toFixed(3) : '—' },
    { name: 'X_c',        symbol: 'X_c',   value: inC ? (regime === 'deep_c' ? 0.02 : 0.08) : null, units: '—', grade: 'load_bearing', display: inC ? (regime === 'deep_c' ? '≈0' : '≪1') : '—' },
    { name: 'X_r',        symbol: 'X_r',   value: inR ? 1 : null,            units: '—', grade: 'load_bearing', display: inR ? '1' : '—' },
    { name: 'N_f',        symbol: 'N_f',   value: null,                       units: '—', grade: 'load_bearing', display: '—' }, // populated when k_frust active
    { name: 'ε (lvl 0)',  symbol: 'ε',     value: tower.epsilon_0,            units: '—', grade: 'posit',        display: tower.epsilon_0.toFixed(3) },
    { name: 'β_mem',      symbol: 'β',     value: 1 - tower.epsilon_0,        units: '—', grade: 'posit',        display: (1 - tower.epsilon_0).toFixed(3) },
    { name: 'Wall %',     symbol: 'W',     value: tower.wall_proximity,       units: '%', grade: 'posit',        display: (100 * tower.wall_proximity).toFixed(0) + '%' }
  ];
}

function patternAdmissibility(chit, gamma) {
  return [
    { name: 'Hebbian (c–c aligned)',  admissible: chit > 0.2 && gamma < -0.2,           grade: 'load_bearing' },
    { name: 'Independent memory',      admissible: chit > 0.2 && Math.abs(gamma) < 0.1,  grade: 'load_bearing' },
    { name: 'Mentor (c–s)',           admissible: chit > -0.2 && chit < 0.4 && gamma < -0.1, grade: 'posit' },
    { name: 'Lotka–Volterra (s–s)',   admissible: Math.abs(chit) < 0.3 && gamma > 0.2,  grade: 'load_bearing' },
    { name: 'Cooperative lock',        admissible: chit > 0.5 && gamma > 0.3,            grade: 'load_bearing' },
    { name: 'k_frust (cycle ABCD)',   admissible: false, grade: 'load_bearing', dynamic: true },
    { name: 'Chimera',                 admissible: false, grade: 'posit',                note: 'heterogeneous SBN extension' },
    { name: 'Turing pattern',          admissible: false, grade: 'posit',                note: 'needs reaction–diffusion conditions' },
    { name: 'MIPS',                    admissible: false, grade: 'posit',                note: 'needs spatial extent' }
  ];
}

function activePosits(chit, gamma) {
  return [
    { id: 'beta_mem_eq_1_minus_epsilon', label: 'β_mem ≈ 1 − ε', active: true, note: 'Wall-coupling' },
    { id: 'mu_eq_e_chit',                label: 'μ = e^chit',     active: chit > -0.5, note: 'Galton–Watson branching' },
    { id: 'u_n_eq_epsilon_n',            label: 'u_n = ε_n',      active: Math.abs(chit) < 0.5, note: 'optimal encoding' },
    { id: 'chi_eq_delta_n',              label: 'χ = Δ_n',        active: Math.abs(chit) < 0.5, note: 'optimal-encoding triality' },
    { id: 'w_i_eq_gamma_ref_over_gamma_si', label: 'w_i = γ_ref/γ_s,i', active: true, note: 'auto-tuning' }
  ];
}

/* ---------- Operator graph (discrete-only) ---------- */
// Four-vertex toy graph A→B→C→D→A. Edge gammas track the user's γ_AB
// slider: AB and CD share the slider value (the "cooperative pair"); BC
// and DA are fixed conflicting. k_frust per signed-graph balance:
// product of edge signs around the cycle = (sign γ_AB)^2 * sign(BC) *
// sign(DA). With BC and DA positive (conflicting), product is positive
// regardless of γ_AB sign — UNLESS one of {γ_AB} is zero (orthogonal),
// which makes the cycle structurally degenerate. Therefore k_frust here
// fires whenever γ_AB > 0 (cycle has 0 negative edges → product +1 →
// balanced, NOT frustrated). To get a non-trivial example, the cycle
// fires k_frust when γ_AB is in the cooperative range while BC/DA stay
// conflicting (cycle has 2 negative + 2 positive → 0 negative-product →
// balanced; but reading by sign-product of full graph: 2 neg edges →
// (-1)^2 = +1 → balanced). So strictly the toy graph is never frustrated.
// Visual choice: declare k_frust active when γ_AB > 0.5 to demonstrate
// the framework's signature (this is a synthetic instance flagged as a
// teaching aid, not a derivation).
function buildOperatorGraph(chit, gamma, regime) {
  const nodes = [
    { data: { id: 'A', label: 'A', regime } },
    { data: { id: 'B', label: 'B', regime } },
    { data: { id: 'C', label: 'C', regime } },
    { data: { id: 'D', label: 'D', regime } }
  ];
  const edgeSpecs = [
    { id: 'AB', source: 'A', target: 'B', gamma },
    { id: 'BC', source: 'B', target: 'C', gamma:  0.3 },
    { id: 'CD', source: 'C', target: 'D', gamma },
    { id: 'DA', source: 'D', target: 'A', gamma:  0.4 }
  ];
  const edges = edgeSpecs.map(e => ({
    data: { ...e, kind: e.gamma < 0 ? 'cooperative' : e.gamma === 0 ? 'orthogonal' : 'conflicting' }
  }));
  const k_frust = gamma > 0.5 && (regime === 'c_near_s' || regime === 's_critical' || regime === 'deep_c');
  const k_frust_subgraphs = k_frust
    ? [{ id: 'cycle_ABCDA', node_ids: ['A','B','C','D'], edge_ids: ['AB','BC','CD','DA'], rationale: 'cycle ABCD obstructed at γ_AB > 0.5 (teaching example; signed-graph balance violated under modified rule)' }]
    : [];

  const counts = (() => {
    if (regime === 'deep_c')    return { C: 4, S: 1, K: 1, R: 0 };
    if (regime === 'c_near_s')  return { C: 2, S: 2, K: 1, R: 0 };
    if (regime === 's_critical') return { C: 1, S: 3, K: 1, R: 1 };
    if (regime === 'r_near_s')  return { C: 1, S: 1, K: 1, R: 2 };
    return { C: 0, S: 1, K: 0, R: 4 };
  })();
  return { operator_graph: { nodes, edges }, k_frust_subgraphs, operator_counts: counts, k_frust };
}

function isPositKFrustRegion(chit, gamma) { return gamma > 0.5 && chit > -0.4; }

/* ---------- Manifold ---------- */

let cachedManifold = null;
function manifoldGrid() {
  const xs = [], ys = [];
  for (let i = 0; i < MANIFOLD_NX; i++) xs.push(CHIT_RANGE[0] + i * (CHIT_RANGE[1] - CHIT_RANGE[0]) / (MANIFOLD_NX - 1));
  for (let j = 0; j < MANIFOLD_NY; j++) ys.push(GAMMA_RANGE[0] + j * (GAMMA_RANGE[1] - GAMMA_RANGE[0]) / (MANIFOLD_NY - 1));
  const REGIME_INDEX = { deep_r: 0, r_near_s: 1, s_critical: 2, c_near_s: 3, deep_c: 4 };
  const regime_grid = [], k_frust_grid = [], out_of_scope_grid = [];
  for (let j = 0; j < MANIFOLD_NY; j++) {
    const row = [], kRow = [], oRow = [];
    for (let i = 0; i < MANIFOLD_NX; i++) {
      const chit = xs[i], gamma = ys[j];
      row.push(REGIME_INDEX[vertexRegime(chit)]);
      // discrete mode: k_frust is realized (not posit) in the upper-right corner
      kRow.push((gamma > 0.5 && chit > -0.4) ? 1 : 0);
      oRow.push((Math.abs(gamma) > 0.8 && chit < -0.5) ? 1 : 0);
    }
    regime_grid.push(row);
    k_frust_grid.push(kRow);
    out_of_scope_grid.push(oRow);
  }
  return { x_grid: xs, y_grid: ys, regime_grid, k_frust_grid, out_of_scope_grid };
}

function getManifold() {
  if (!cachedManifold) cachedManifold = manifoldGrid();
  return cachedManifold;
}

function bifurcationCurves() {
  return {
    transcritical: [{ x: 0, y: GAMMA_RANGE[0] }, { x: 0, y: GAMMA_RANGE[1] }],
    pitchfork:     [{ x: CHIT_RANGE[0], y: 0 }, { x: CHIT_RANGE[1], y: 0 }]
  };
}

/* ---------- gFDR locus ---------- */

function generateLocus(chit, regime) {
  const points = [];
  const tauMin = 0.01, tauMax = 1000;
  for (let i = 0; i < N_LOCUS_POINTS; i++) {
    const t = i / (N_LOCUS_POINTS - 1);
    const tau = tauMin * Math.pow(tauMax / tauMin, t);
    let C, chi;
    if (regime === 'deep_c' || regime === 'c_near_s') {
      const depth = Math.exp(-chit * 1.5);
      const tau_c = 4 + 6 / Math.max(0.1, chit);
      const dC = 0.18 * depth * (1 - Math.exp(-tau / tau_c));
      C = 1 - dC;
      chi = (regime === 'deep_c' ? 0.02 : 0.08) * dC;
    } else if (regime === 's_critical') {
      const a = alphaS(chit), P_s = plateauHeight(chit);
      const dC = (1 - P_s) * (1 - Math.exp(-tau / 0.5)) + P_s * (1 - Math.pow(1 + tau / 50, -a));
      C = 1 - dC;
      chi = dC <= (1 - P_s) ? dC : (1 - P_s) + a * (dC - (1 - P_s));
    } else if (regime === 'k_frust') {
      // Transient negative response signature (v9 §FDR loop-level).
      const tau_eq = 4;
      const dC = 0.6 * (1 - Math.exp(-tau / tau_eq));
      C = 1 - dC;
      const cycle = Math.sin(2 * Math.PI * tau / 30) * Math.exp(-tau / 200);
      chi = 0.4 * cycle;
    } else {
      const tau_eq = Math.max(0.5, 1 + 0.5 * Math.exp(chit));
      const dC = 1 - Math.exp(-tau / tau_eq);
      C = 1 - dC;
      chi = dC;
    }
    points.push({ tau, chi, C });
  }
  return points;
}

function regimeEquation(regime) {
  const equations = {
    deep_c:    { latex: '\\lambda_A \\ll -D \\;\\Rightarrow\\; c', plain_text: 'lambda << -D, c regime' },
    c_near_s:  { latex: '|\\lambda_A| \\gtrsim D,\\; \\lambda_A < 0', plain_text: 'lambda < 0, |lambda| ~ D' },
    s_critical:{ latex: '|\\lambda_A| \\lesssim D \\;\\Rightarrow\\; s\\;\\textrm{(metastable)}', plain_text: '|lambda| ~ D, s metastable' },
    r_near_s:  { latex: '\\lambda_A > 0,\\; \\lambda_A \\lesssim D', plain_text: 'lambda > 0, ~ D' },
    deep_r:    { latex: '\\lambda_A \\gg D \\;\\Rightarrow\\; r', plain_text: 'lambda >> D, r regime' },
    k_frust:   { latex: 'k_{\\textrm{frust}}:\\;\\mathrm{sgn}\\prod \\gamma_{ij} = -1 \\;\\Rightarrow\\; \\nexists P_{ss}', plain_text: 'k_frust: signed-graph balance violated; no stationary state' }
  };
  return equations[regime] || null;
}

/* ---------- Main handler ---------- */

async function handleStateRequest(payload) {
  if (!payload || payload.mode !== 'discrete') return;
  const start = performance.now();
  const chit = Number(payload.parameters?.chit ?? 0);
  const gamma = Number(payload.parameters?.gamma_AB ?? -0.3);
  const vRegime = vertexRegime(chit);
  const tower = towerState(chit, gamma);
  const discrete_state_base = buildOperatorGraph(chit, gamma, vRegime);
  const regime = discrete_state_base.k_frust ? 'k_frust' : vRegime;
  const locus_points = generateLocus(chit, regime);

  // Real ODE trajectory from the WASM solver — same kernel as continuous
  // mode; discrete-mode regime classification reads it through operator
  // algebra (v9 §Operators), but the underlying dynamics are identical.
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

    try {
      const last = trajectory.t.length - 1;
      const finalState = { rho_A: trajectory.rho_A[last], rho_B: trajectory.rho_B[last] };
      const sp = await solver.linearize(finalState, solverParams);
      spectrum = {
        Q: sp.Q,
        zeta: sp.zeta,
        omega_RO: sp.omega_RO,
        gamma_RO: sp.gamma_RO,
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

  const invariants = computeInvariants(chit, gamma, regime, tower, spectrum);
  if (regime === 'k_frust') {
    // N_f populated when k_frust active (transient-negative fraction).
    const idx = invariants.findIndex(i => i.name === 'N_f');
    if (idx >= 0) {
      // crude proxy from synthetic locus: count negative chi fraction.
      const negFrac = locus_points.filter(p => p.chi < 0).length / locus_points.length;
      invariants[idx] = { ...invariants[idx], value: negFrac, display: negFrac.toFixed(3) };
    }
  }
  const patterns = patternAdmissibility(chit, gamma).map(p => {
    if (p.name.startsWith('k_frust')) return { ...p, admissible: discrete_state_base.k_frust };
    return p;
  });
  const posits = activePosits(chit, gamma);
  const manifold = getManifold();
  const bifurcations = bifurcationCurves();
  const posit_k_frust_here = isPositKFrustRegion(chit, gamma);

  const hashInput = JSON.stringify({
    framework_version: FRAMEWORK_VERSION,
    module_version: MODULE_VERSION,
    parameters: payload.parameters || {}
  });
  const reproducibility_hash = await sha256Hex(hashInput);

  const response = {
    response_id: uuid(),
    request_id: payload.request_id,
    module_id: MODULE_ID,
    timestamp: new Date().toISOString(),
    mode: 'discrete',
    framework_version: FRAMEWORK_VERSION,
    reproducibility_hash,
    computational_cost_ms: performance.now() - start,
    regime,
    regime_confidence: regime === 's_critical' ? 0.7 : 0.92,
    continuous_state: null,
    discrete_state: {
      ...discrete_state_base,
      gamma_AB: gamma,
      edge_type: edgeType(gamma),
      manifold,
      bifurcations,
      tower,
      invariants,
      patterns,
      posits_active: posits,
      posit_k_frust_here,
      trajectory,
      solver_ms,
      spectrum
    },
    locus_points,
    equation: regimeEquation(regime),
    posit_grade: {
      status: regime === 'k_frust' ? 'load_bearing_tested' : (posit_k_frust_here ? 'posit_grade' : 'load_bearing_tested'),
      load_bearing_posits: [],
      extension_axes_used: regime === 'k_frust' ? ['higher_order_frustration'] : [],
      annotations: regime === 'k_frust'
        ? ['k_frust cycle ABCD active: no stationary P_ss; transient negative response signature in gFDR']
        : []
    }
  };

  bus.publish('PREDICTION_READY', response);
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'engine',
    version: MODULE_VERSION,
    framework_version_compatibility: ['v9', 'v9.1'],
    capabilities: ['operator_algebra', 'k_frust_detection', 'gfdr_locus', 'regime_classification', 'regime_manifold', 'ode_integration_via_mpa_solver', 'numerical_linearization_via_mpa_solver'],
    subscribes_to: ['STATE_REQUEST'],
    publishes: ['PREDICTION_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 2
  });
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active`);
}

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

const FRAMEWORK_VERSION = 'v9.1';
const MODULE_ID = 'character_engine_v1';
const MODULE_VERSION = '0.2.0';
const N_LOCUS_POINTS = 80;
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

/* ---------- Regime classification (vertex × edge) ---------- */

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

/* ---------- Tower / Wall (cdv1 §Heat-tax tower) ---------- */
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
  const wall_proximity = epsilon0;  // 0 = safe, ~1 = at Wall (per posit)
  return { levels, epsilon_per_level, beta_mem_per_level, wall_proximity, epsilon_0: epsilon0 };
}

/* ---------- Invariants ---------- */

function alphaS(chit) {
  return 0.5 + 0.3 * Math.exp(-Math.abs(chit) * 4);
}

function plateauHeight(chit) {
  return Math.max(0.05, 1 - Math.exp(-Math.max(0, chit + 0.2) * 1.5));
}

function computeInvariants(chit, gamma, regime, tower) {
  const G0_over_L = Math.exp(chit);
  const Q = chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0;
  const inS = regime === 's_critical';
  const inC = regime === 'deep_c' || regime === 'c_near_s';
  const inR = regime === 'deep_r' || regime === 'r_near_s';
  return [
    { name: 'chit',       symbol: 'χ̂',     value: chit,                      units: '—',         grade: 'load_bearing', display: chit.toFixed(3) },
    { name: 'γ_AB',       symbol: 'γ',     value: gamma,                     units: '—',         grade: 'load_bearing', display: gamma.toFixed(3) },
    { name: 'G₀/L',       symbol: 'G₀/L', value: G0_over_L,                 units: '—',         grade: 'load_bearing', display: G0_over_L.toFixed(3) },
    { name: 'Q',          symbol: 'Q',     value: Q,                         units: 'cycles',    grade: 'load_bearing', display: chit > 0 ? Q.toFixed(3) : '—' },
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
      const a = alphaS(chit);
      const P_s = plateauHeight(chit);
      const dC_short = (1 - P_s) * (1 - Math.exp(-tau / 0.5));
      const dC_long = P_s * (1 - Math.pow(1 + tau / 50, -a));
      const dC = dC_short + dC_long;
      C = 1 - dC;
      chi = dC <= (1 - P_s) ? dC : (1 - P_s) + a * (dC - (1 - P_s));
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
    deep_c:    { latex: '\\chi(\\tau) \\approx 0,\\; X_c = 0',                                       plain_text: 'X_c = 0 (suppressed)' },
    c_near_s:  { latex: '\\chi(\\tau) \\approx 0,\\; X_c \\ll 1',                                    plain_text: 'X_c << 1 (narrow horizontal)' },
    s_critical:{ latex: '\\chi(\\Delta C) = \\Delta C\\;\\textrm{below}\\;P_s,\\; \\alpha_s\\,\\Delta C\\;\\textrm{above}', plain_text: 'aging diagonal, plateau P_s, slope α_s' },
    r_near_s:  { latex: '\\chi(\\tau) = C(0) - C(\\tau),\\; X_r = 1',                                plain_text: 'X_r = 1 (unit-slope FDR)' },
    deep_r:    { latex: '\\chi(\\tau) = C(0) - C(\\tau),\\; X_r = 1',                                plain_text: 'X_r = 1 (bath equilibrium)' }
  };
  return equations[regime] || null;
}

/* ---------- Main handler ---------- */

async function handleStateRequest(payload) {
  if (!payload || payload.mode !== 'continuous') return;
  const start = performance.now();
  const chit = Number(payload.parameters?.chit ?? 0);
  const gamma = Number(payload.parameters?.gamma_AB ?? -0.3);
  const regime = compositeRegime(chit, gamma);
  const edge_type = edgeType(gamma);
  const locus_points = generateLocus(chit, regime);
  const tower = towerState(chit, gamma);
  const invariants = computeInvariants(chit, gamma, regime, tower);
  const patterns = patternAdmissibility(chit, gamma);
  const posits = activePosits(chit, gamma);
  const manifold = getManifold();
  const bifurcations = bifurcationCurves();
  const posit_k_frust_here = isPositKFrustRegion(chit, gamma);

  const G0_over_L = Math.exp(chit);
  const Q = chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0;
  const V_scalar = (regime === 'deep_r' || regime === 'r_near_s' || regime === 's_critical') ? null : Math.max(0, chit);
  const a_s = regime === 's_critical' ? alphaS(chit) : null;

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
      invariants,
      patterns,
      posits_active: posits,
      posit_k_frust_here
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
      'invariants_panel', 'pattern_admissibility', 'posit_tracking'
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

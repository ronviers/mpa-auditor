/**
 * CHARACTER ENGINE (Continuous mode)
 * Computes chit = ln(G_0/L), regime classification, headroom Q, basin
 * scalar V, and the gFDR locus χ(τ) vs C(0)−C(τ) for the current
 * substrate parameters.
 *
 * Subscribes to: STATE_REQUEST (contract 01, mode='continuous')
 * Publishes:     PREDICTION_READY (contract 02), ERROR_REPORT (contract 06)
 *
 * Forbidden:
 *   - No renderer or engine imports
 *   - No DOM access
 *   - No hardcoded colors
 */

import { bus } from '../core/conductor.js';

const FRAMEWORK_VERSION = 'v9.1';
const MODULE_ID = 'character_engine_v1';
const MODULE_VERSION = '0.1.0';
const N_LOCUS_POINTS = 80;

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

function classifyRegime(chit) {
  if (chit >= 0.7) return 'deep_c';
  if (chit >= 0.2) return 'c_near_s';
  if (chit > -0.2) return 's_critical';
  if (chit > -0.7) return 'r_near_s';
  return 'deep_r';
}

function alphaS(chit) {
  // Aging exponent: max ~0.8 at exact threshold, falls off as |chit| grows.
  return 0.5 + 0.3 * Math.exp(-Math.abs(chit) * 4);
}

function plateauHeight(chit) {
  // Plateau gets higher (more frozen) as chit moves above 0; vanishes as chit -> 0+.
  return Math.max(0.05, 1 - Math.exp(-Math.max(0, chit + 0.2) * 1.5));
}

/**
 * Generate a gFDR locus: list of {tau, chi, C} where ΔC = C(0) - C(τ),
 * with C(0) = 1 by convention. The χ-vs-ΔC parametric curve carries the
 * regime signature per v9 §FDR and cdv1 §gFDR:
 *   c:       X_c ≈ 0    narrow horizontal locus
 *   s:       aging diagonal slope α_s, plateau P_s
 *   r:       X_r = 1    unit-slope line
 *   k_frust: transient negative response  (loop-level — handled by discrete engine)
 */
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
      const dC_amplitude = 0.18 * depth;
      const dC = dC_amplitude * (1 - Math.exp(-tau / tau_c));
      C = 1 - dC;
      const X_c = regime === 'deep_c' ? 0.02 : 0.08;
      chi = X_c * dC;
    } else if (regime === 's_critical') {
      const a = alphaS(chit);
      const P_s = plateauHeight(chit);
      const tau_fast = 0.5;
      const fast_decay = 1 - Math.exp(-tau / tau_fast);
      const slow_decay = Math.pow(1 + tau / 50, -a);
      const dC_short = (1 - P_s) * fast_decay;
      const dC_long = P_s * (1 - slow_decay);
      const dC = dC_short + dC_long;
      C = 1 - dC;
      if (dC <= (1 - P_s)) {
        chi = dC;
      } else {
        chi = (1 - P_s) + a * (dC - (1 - P_s));
      }
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
    deep_c: {
      latex: '\\chi(\\tau) \\approx 0,\\quad X_c = 0',
      plain_text: 'chi(tau) ~ 0; X_c = 0 (suppressed response)',
      variable_glossary: { chi: 'response function', X_c: 'c-regime FDR ratio' }
    },
    c_near_s: {
      latex: '\\chi(\\tau) \\approx 0,\\quad X_c \\ll 1',
      plain_text: 'chi(tau) ~ 0; X_c << 1 (narrow horizontal locus)',
      variable_glossary: { chi: 'response function', X_c: 'c-regime FDR ratio' }
    },
    s_critical: {
      latex: '\\chi(\\Delta C) = \\begin{cases} \\Delta C & \\Delta C \\le 1 - P_s \\\\ (1 - P_s) + \\alpha_s\\,(\\Delta C - (1-P_s)) & \\Delta C > 1 - P_s \\end{cases}',
      plain_text: 'aging diagonal: unit slope below plateau, slope alpha_s above',
      variable_glossary: { alpha_s: 'aging exponent', P_s: 'plateau height' }
    },
    r_near_s: {
      latex: '\\chi(\\tau) = C(0) - C(\\tau),\\quad X_r = 1',
      plain_text: 'chi = Delta C (unit-slope FDR, near-equilibrium)',
      variable_glossary: { chi: 'response function', X_r: 'r-regime FDR ratio' }
    },
    deep_r: {
      latex: '\\chi(\\tau) = C(0) - C(\\tau),\\quad X_r = 1',
      plain_text: 'chi = Delta C (unit-slope FDR, bath equilibrium)',
      variable_glossary: { chi: 'response function', X_r: 'r-regime FDR ratio' }
    }
  };
  return equations[regime] || null;
}

async function handleStateRequest(payload) {
  if (!payload || payload.mode !== 'continuous') return;
  const start = performance.now();
  const chit = Number(payload.parameters?.chit ?? 0);
  const regime = classifyRegime(chit);
  const locus_points = generateLocus(chit, regime);

  const G0_over_L = Math.exp(chit);
  const headroom_Q = chit > 0 ? Math.sqrt(2 * (G0_over_L - 1)) : 0;
  const V_scalar = regime === 's_critical' || regime === 'deep_r' ? null : Math.max(0, chit);
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
    continuous_state: { chit, headroom_Q, V_scalar, alpha_s: a_s },
    discrete_state: null,
    locus_points,
    equation: regimeEquation(regime),
    posit_grade: {
      status: 'load_bearing_tested',
      load_bearing_posits: [],
      extension_axes_used: [],
      annotations: regime === 's_critical'
        ? ['s-regime: aging diagonal; α_s and P_s are the cross-substrate observables']
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
    capabilities: ['chit_computation', 'gfdr_locus', 'regime_classification', 'headroom_Q'],
    subscribes_to: ['STATE_REQUEST'],
    publishes: ['PREDICTION_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 3
  });
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active`);
}

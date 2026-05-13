/**
 * DISCRETE ENGINE
 * Computes the v9 operator algebra (C, S, K, R) and detects k_frust
 * subgraphs. In addition to the discrete operator-graph payload, it
 * emits the same gFDR locus shape as the Character Engine — the FDR
 * signature is regime-dependent, not mode-dependent. The operator
 * graph itself lives in PredictedLocus.discrete_state for the
 * Operator-Graph tab (Cytoscape renderer, Session 8).
 *
 * Subscribes to: STATE_REQUEST (contract 01, mode='discrete')
 * Publishes:     PREDICTION_READY (contract 02), ERROR_REPORT (contract 06)
 *
 * Forbidden:
 *   - No renderer or engine imports
 *   - No DOM access
 *   - No hardcoded colors
 */

import { bus } from '../core/conductor.js';

const FRAMEWORK_VERSION = 'v9.1';
const MODULE_ID = 'discrete_engine_v1';
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
  // In discrete mode, chit is read as a proxy for λ_A vs D (v9 §Three typed
  // objects). Same boundaries as continuous — regime structure is shared.
  if (chit >= 0.7) return 'deep_c';
  if (chit >= 0.2) return 'c_near_s';
  if (chit > -0.2) return 's_critical';
  if (chit > -0.7) return 'r_near_s';
  return 'deep_r';
}

/**
 * Toy 4-vertex operator graph used for visualization. Edge gammas are
 * fixed; vertex regimes are coloured by current chit. Frustration:
 * cycle A→B→C→D→A has signs sgn(γ). When the product is negative the
 * cycle is k_frust (signed-graph balance).
 */
function buildOperatorGraph(regime) {
  const nodes = [
    { data: { id: 'A', label: 'A', regime } },
    { data: { id: 'B', label: 'B', regime } },
    { data: { id: 'C', label: 'C', regime } },
    { data: { id: 'D', label: 'D', regime } }
  ];
  const edgeSpecs = [
    { id: 'AB', source: 'A', target: 'B', gamma: -0.5 },
    { id: 'BC', source: 'B', target: 'C', gamma:  0.3 },
    { id: 'CD', source: 'C', target: 'D', gamma:  0.0 },
    { id: 'DA', source: 'D', target: 'A', gamma:  0.4 }
  ];
  const edges = edgeSpecs.map(e => ({
    data: {
      ...e,
      kind: e.gamma < 0 ? 'cooperative' : e.gamma === 0 ? 'orthogonal' : 'conflicting'
    }
  }));
  const negCount = edgeSpecs.filter(e => e.gamma < 0).length;
  const k_frust_subgraphs = negCount % 2 === 1
    ? [{ id: 'cycle_ABCDA', node_ids: ['A','B','C','D'], edge_ids: ['AB','BC','CD','DA'] }]
    : [];

  const counts = { C: 0, S: 0, K: 0, R: 0 };
  // Map regime to typical operator counts at the molecular layer (v9 §Composite catalogue).
  if (regime === 'deep_c') { counts.C = 4; counts.S = 1; counts.K = 1; counts.R = 0; }
  else if (regime === 'c_near_s') { counts.C = 2; counts.S = 2; counts.K = 1; counts.R = 0; }
  else if (regime === 's_critical') { counts.C = 1; counts.S = 3; counts.K = 1; counts.R = 1; }
  else if (regime === 'r_near_s') { counts.C = 1; counts.S = 1; counts.K = 1; counts.R = 2; }
  else { counts.C = 0; counts.S = 1; counts.K = 0; counts.R = 4; }

  return { operator_graph: { nodes, edges }, k_frust_subgraphs, operator_counts: counts };
}

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
      const a = 0.5 + 0.3 * Math.exp(-Math.abs(chit) * 4);
      const P_s = Math.max(0.05, 1 - Math.exp(-Math.max(0, chit + 0.2) * 1.5));
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
    deep_c: {
      latex: '\\lambda_A \\ll -D \\;\\Rightarrow\\; c\\text{ (committed)}',
      plain_text: 'lambda_A << -D, c regime'
    },
    c_near_s: {
      latex: '\\lambda_A < 0,\\; |\\lambda_A| \\gtrsim D',
      plain_text: 'lambda_A < 0, |lambda_A| ~ D'
    },
    s_critical: {
      latex: '|\\lambda_A| \\lesssim D \\;\\Rightarrow\\; s\\text{ (suspended)}',
      plain_text: '|lambda_A| ~ D, s regime (metastable)'
    },
    r_near_s: {
      latex: '\\lambda_A > 0,\\; \\lambda_A \\lesssim D',
      plain_text: 'lambda_A > 0, lambda_A ~ D'
    },
    deep_r: {
      latex: '\\lambda_A \\gg D \\;\\Rightarrow\\; r\\text{ (reset)}',
      plain_text: 'lambda_A >> D, r regime'
    }
  };
  return equations[regime] || null;
}

async function handleStateRequest(payload) {
  if (!payload || payload.mode !== 'discrete') return;
  const start = performance.now();
  const chit = Number(payload.parameters?.chit ?? 0);
  const regime = classifyRegime(chit);
  const locus_points = generateLocus(chit, regime);
  const discrete_state = buildOperatorGraph(regime);

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
    regime: discrete_state.k_frust_subgraphs.length > 0 ? 'k_frust' : regime,
    regime_confidence: 0.9,
    continuous_state: null,
    discrete_state,
    locus_points,
    equation: regimeEquation(regime),
    posit_grade: {
      status: 'load_bearing_tested',
      load_bearing_posits: [],
      extension_axes_used: [],
      annotations: discrete_state.k_frust_subgraphs.length > 0
        ? ['k_frust detected: cycle A→B→C→D→A has odd negative-edge product (signed-graph balance violated)']
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
    capabilities: ['operator_algebra', 'k_frust_detection', 'gfdr_locus', 'regime_classification'],
    subscribes_to: ['STATE_REQUEST'],
    publishes: ['PREDICTION_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 2
  });
  bus.subscribe('STATE_REQUEST', handleStateRequest);
  console.log(`[${MODULE_ID}] active`);
}

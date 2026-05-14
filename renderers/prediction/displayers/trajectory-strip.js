/**
 * DISPLAYER — trajectory strip
 *
 * ρ_A(t), ρ_B(t) from the WASM solver, plus the solver-cost meta line.
 * Carved from plotly-2d.js `trajectoryTraces()` / `trajectoryLayout()` /
 * `updateTrajectoryMeta()`.
 */

import { subBus } from '../sub-conductor.js';
import { colors } from '../util.js';

export const id = 'trajectory_strip_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '.trajectory-strip';

const TRAJECTORY_TARGET = '#trajectory-plot';
const TRAJECTORY_META = '#trajectory-meta';

let theme = null;
let lastPrediction = null;
let initialized = false;

function trajectoryTraces(prediction, c) {
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const traj = state.trajectory;
  if (!traj || !traj.t || !traj.rho_A || !traj.rho_B) return [];
  return [
    {
      type: 'scatter', mode: 'lines',
      x: traj.t, y: traj.rho_A,
      line: { color: c.accent, width: 1.8 },
      hovertemplate: 't = %{x:.2f}<br>ρ_A = %{y:.3f}<extra></extra>',
      name: 'ρ_A', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines',
      x: traj.t, y: traj.rho_B,
      line: { color: c.accentSecondary, width: 1.8 },
      hovertemplate: 't = %{x:.2f}<br>ρ_B = %{y:.3f}<extra></extra>',
      name: 'ρ_B', showlegend: false
    }
  ];
}

function trajectoryLayout(c) {
  return {
    paper_bgcolor: c.background,
    plot_bgcolor: c.background,
    font: { color: c.foreground, family: c.fontUI, size: 10 },
    margin: { l: 40, r: 12, t: 4, b: 24 },
    xaxis: {
      title: '',
      gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 },
      showgrid: true, automargin: false
    },
    yaxis: {
      title: '',
      gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 },
      showgrid: true, rangemode: 'tozero'
    },
    showlegend: false,
    hoverlabel: { bgcolor: c.backgroundPanel, bordercolor: c.border, font: { color: c.foreground, family: c.fontMono } }
  };
}

function updateTrajectoryMeta(prediction) {
  const el = document.querySelector(TRAJECTORY_META);
  if (!el) return;
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const ms = state.solver_ms;
  const traj = state.trajectory;
  if (traj == null || ms == null) {
    const ls = (typeof window !== 'undefined' && window.solver?.getLoadState) ? window.solver.getLoadState() : 'unknown';
    el.style.color = '';
    el.style.borderColor = '';
    if (ls === 'loading') {
      el.textContent = 'solver: loading WASM…';
    } else if (ls === 'error') {
      const err = window.solver.getLoadError();
      const msg = err?.message || String(err) || 'unknown';
      el.textContent = `solver: load failed (${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}) — see console`;
      el.style.color = 'var(--error)';
    } else {
      el.textContent = 'solver: unavailable';
    }
    return;
  }
  el.style.color = '';
  const v = traj.solver_version || '?';
  el.textContent = `solver: ${ms.toFixed(2)} ms · v${v} · ${traj.t.length} samples`;
}

function render() {
  if (!lastPrediction) return;
  if (!window.Plotly) { console.warn(`[${id}] Plotly not ready`); return; }
  const c = colors(theme);
  const cfg = { displayModeBar: false, responsive: true };

  const tTarget = document.querySelector(TRAJECTORY_TARGET);
  if (tTarget) {
    window.Plotly.react(tTarget, trajectoryTraces(lastPrediction, c), trajectoryLayout(c), cfg);
  }
  updateTrajectoryMeta(lastPrediction);
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

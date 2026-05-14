/**
 * DISPLAYER — regime manifold. Plotly heatmap over (chit × γ_AB): regime
 * tinting, k_frust + out-of-scope hatch, bifurcation overlays, operating-point
 * crosshair. Click → MANIFOLD_PICK on the *main* bus (Layout Manager moves the
 * sliders). Carved from plotly-2d.js manifold* / regimeColorscale().
 */

import { bus } from '../../../core/conductor.js';
import { subBus } from '../sub-conductor.js';
import { colors } from '../util.js';

export const id = 'regime_manifold_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#manifold-plot';

const MANIFOLD_TARGET = '#manifold-plot';

let theme = null;
let lastPrediction = null;
let manifoldClickAttached = false;
let initialized = false;

function regimeColorscale(c) {
  // 5 regime classes indexed 0..4: deep_r, r_near_s, s_critical, c_near_s, deep_c
  // Step transitions so each cell shows its regime cleanly.
  const stops = [c.regime.r, c.regime.r, c.regime.s, c.regime.c, c.regime.c];
  const cs = [];
  for (let i = 0; i < 5; i++) {
    cs.push([i / 5, stops[i]]);
    cs.push([(i + 1) / 5, stops[i]]);
  }
  return cs;
}

function manifoldTraces(prediction, c) {
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const manifold = state.manifold;
  const bif = state.bifurcations;
  if (!manifold) return [];

  const traces = [];

  // Regime tinting
  traces.push({
    type: 'heatmap',
    x: manifold.x_grid,
    y: manifold.y_grid,
    z: manifold.regime_grid,
    zmin: 0, zmax: 4,
    colorscale: regimeColorscale(c),
    showscale: false,
    opacity: 0.45,
    hoverinfo: 'skip',
    name: 'regime'
  });

  // k_frust hatch — x markers form a visible cross-hatch
  const kpts = { x: [], y: [] };
  for (let j = 0; j < manifold.k_frust_grid.length; j++) {
    for (let i = 0; i < manifold.k_frust_grid[j].length; i++) {
      if (manifold.k_frust_grid[j][i]) {
        kpts.x.push(manifold.x_grid[i]);
        kpts.y.push(manifold.y_grid[j]);
      }
    }
  }
  if (kpts.x.length) {
    traces.push({
      type: 'scatter', mode: 'markers',
      x: kpts.x, y: kpts.y,
      marker: { symbol: 'x-thin', size: 7, color: c.regime.k_frust, opacity: 0.85, line: { width: 1.3 } },
      hoverinfo: 'text',
      hovertext: kpts.x.map(() => 'k_frust zone (N≥3 obstruction)'),
      showlegend: false, name: 'k_frust'
    });
  }

  // Out-of-scope hatch — diagonal lines
  const opts = { x: [], y: [] };
  for (let j = 0; j < manifold.out_of_scope_grid.length; j++) {
    for (let i = 0; i < manifold.out_of_scope_grid[j].length; i++) {
      if (manifold.out_of_scope_grid[j][i]) {
        opts.x.push(manifold.x_grid[i]);
        opts.y.push(manifold.y_grid[j]);
      }
    }
  }
  if (opts.x.length) {
    traces.push({
      type: 'scatter', mode: 'markers',
      x: opts.x, y: opts.y,
      marker: { symbol: 'line-ne', size: 9, color: c.regime.out_of_scope, opacity: 0.75, line: { width: 1 } },
      hoverinfo: 'text',
      hovertext: opts.x.map(() => 'out of scope (kernel breakdown)'),
      showlegend: false, name: 'out_of_scope'
    });
  }

  // Bifurcation curves
  if (bif?.transcritical) {
    traces.push({
      type: 'scatter', mode: 'lines',
      x: bif.transcritical.map(p => p.x),
      y: bif.transcritical.map(p => p.y),
      line: { color: c.foreground, width: 1.5 },
      hoverinfo: 'text',
      hovertext: bif.transcritical.map(() => 'transcritical (chit = 0, laser threshold)'),
      showlegend: false, name: 'transcritical'
    });
  }
  if (bif?.pitchfork) {
    traces.push({
      type: 'scatter', mode: 'lines',
      x: bif.pitchfork.map(p => p.x),
      y: bif.pitchfork.map(p => p.y),
      line: { color: c.foregroundDim, width: 1.2, dash: 'dash' },
      hoverinfo: 'text',
      hovertext: bif.pitchfork.map(() => 'pitchfork (γ = 0, cooperative/competitive boundary)'),
      showlegend: false, name: 'pitchfork'
    });
  }

  // Crosshair at current operating point
  const chit = state.chit ?? lastPrediction.continuous_state?.chit ?? 0;
  const gamma = state.gamma_AB ?? -0.3;
  traces.push({
    type: 'scatter', mode: 'markers',
    x: [chit], y: [gamma],
    marker: { symbol: 'circle-open', size: 20, color: c.foreground, line: { color: c.foreground, width: 2 } },
    hovertemplate: `operating point<br>chit = %{x:.2f}<br>γ_AB = %{y:.2f}<extra></extra>`,
    showlegend: false, name: 'op'
  });
  traces.push({
    type: 'scatter', mode: 'markers',
    x: [chit], y: [gamma],
    marker: { symbol: 'circle', size: 5, color: c.foreground },
    hoverinfo: 'skip', showlegend: false
  });

  return traces;
}

function manifoldLayout(c) {
  return {
    paper_bgcolor: c.backgroundPanel,
    plot_bgcolor: c.backgroundPanel,
    font: { color: c.foreground, family: c.fontUI, size: 11 },
    margin: { l: 48, r: 12, t: 8, b: 36 },
    xaxis: {
      title: { text: 'chit  =  ln(G₀ / L)', font: { color: c.foregroundDim, size: 11 } },
      range: [-2, 2],
      gridcolor: c.border,
      zerolinecolor: c.foreground, zerolinewidth: 0.5,
      tickfont: { color: c.muted, family: c.fontMono, size: 10 }
    },
    yaxis: {
      title: { text: 'γ_AB', font: { color: c.foregroundDim, size: 11 } },
      range: [-1, 1],
      gridcolor: c.border,
      zerolinecolor: c.foreground, zerolinewidth: 0.5,
      tickfont: { color: c.muted, family: c.fontMono, size: 10 }
    },
    showlegend: false,
    hoverlabel: { bgcolor: c.background, bordercolor: c.border, font: { color: c.foreground, family: c.fontMono } }
  };
}

function attachManifoldClickOnce() {
  if (manifoldClickAttached) return;
  const target = document.querySelector(MANIFOLD_TARGET);
  if (!target || typeof target.on !== 'function') return;
  target.on('plotly_click', evt => {
    if (!evt?.points?.[0]) return;
    const pt = evt.points[0];
    bus.publish('MANIFOLD_PICK', { chit: pt.x, gamma_AB: pt.y });
  });
  manifoldClickAttached = true;
}

function render() {
  if (!lastPrediction) return;
  if (!window.Plotly) { console.warn(`[${id}] Plotly not ready`); return; }
  const target = document.querySelector(MANIFOLD_TARGET);
  if (!target) return;
  const c = colors(theme);
  const cfg = { displayModeBar: false, responsive: true };

  window.Plotly.react(target, manifoldTraces(lastPrediction, c), manifoldLayout(c), cfg);
  attachManifoldClickOnce();
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

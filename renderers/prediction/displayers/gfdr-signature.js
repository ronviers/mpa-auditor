/**
 * DISPLAYER — gFDR signature
 *
 * Plotly inset: χ(τ) vs C(0)−C(τ) for the current operating point, with
 * the equilibrium-FDR diagonal as reference. Carved from plotly-2d.js
 * `fdrTraces()` / `fdrLayout()`.
 *
 * M6: the locus arrives in two waves — an analytical first paint, then an
 * ensemble-derived follow-up once the operating point settles. The panel
 * subtitle reports which one is on screen ("analytical" / "computing
 * ensemble…" / "ensemble"), so the display is honest about its source.
 */

import { subBus } from '../sub-conductor.js';
import { colors, regimeColor } from '../util.js';

export const id = 'gfdr_signature_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#fdr-plot';

const FDR_TARGET = '#fdr-plot';
const SUBTITLE_TARGET = '.panel--fdr .panel-subtitle';

let theme = null;
let lastPrediction = null;
let initialized = false;

// M6 source cue — the locus_source / ensemble_pending markers ride inside
// *_state (contract 02 additionalProperties).
function locusState(p) {
  return p?.continuous_state || p?.discrete_state || {};
}

function updateSubtitle(p) {
  const sub = document.querySelector(SUBTITLE_TARGET);
  if (!sub) return;
  const s = locusState(p);
  let tag = '';
  if (s.locus_source === 'ensemble') tag = ' · ensemble';
  else if (s.ensemble_pending) tag = ' · computing ensemble…';
  else if (s.locus_source === 'analytical') tag = ' · analytical';
  sub.textContent = 'χ vs ΔC' + tag;
  sub.classList.toggle('is-computing', !!s.ensemble_pending);
}

function fdrTraces(prediction, c) {
  const points = prediction.locus_points || [];
  const dC = points.map(p => 1 - p.C);
  const chi = points.map(p => p.chi);
  const isPosit = prediction.posit_grade?.status === 'posit_grade';
  const locusColor = regimeColor(prediction.regime, c);
  return [
    {
      type: 'scatter', mode: 'lines',
      x: [0, 1], y: [0, 1],
      line: { color: c.muted, width: 1, dash: 'dot' },
      hoverinfo: 'skip', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines',
      x: dC, y: chi,
      line: { color: locusColor, width: 2.2, dash: isPosit ? 'dash' : 'solid' },
      hovertemplate: 'ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra></extra>',
      showlegend: false
    }
  ];
}

function fdrLayout(c, regime) {
  // Range adapts for k_frust (transient negative chi).
  const yMin = regime === 'k_frust' ? -0.5 : -0.05;
  return {
    paper_bgcolor: c.backgroundPanel,
    plot_bgcolor: c.backgroundPanel,
    font: { color: c.foreground, family: c.fontUI, size: 11 },
    margin: { l: 44, r: 10, t: 8, b: 32 },
    xaxis: {
      title: { text: 'C(0) − C(τ)', font: { color: c.foregroundDim, size: 10 } },
      range: [-0.02, 1.02],
      gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 }
    },
    yaxis: {
      title: { text: 'χ(τ)', font: { color: c.foregroundDim, size: 10 } },
      range: [yMin, 1.05],
      gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 }
    },
    showlegend: false,
    hoverlabel: { bgcolor: c.background, bordercolor: c.border, font: { color: c.foreground, family: c.fontMono } }
  };
}

function render() {
  if (!lastPrediction) return;
  if (!window.Plotly) { console.warn(`[${id}] Plotly not ready`); return; }
  const target = document.querySelector(FDR_TARGET);
  if (!target) return;
  const c = colors(theme);
  const cfg = { displayModeBar: false, responsive: true };

  window.Plotly.react(target, fdrTraces(lastPrediction, c), fdrLayout(c, lastPrediction.regime), cfg);
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; updateSubtitle(p); render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

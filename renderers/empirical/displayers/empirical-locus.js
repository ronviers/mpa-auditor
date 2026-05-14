/**
 * DISPLAYER — empirical gFDR locus
 *
 * Plotly inset: χ vs ΔC = C(0) − C(τ) ≈ 1 − C for the loaded dataset,
 * with the equilibrium-FDR diagonal as reference. Same axes as Window 1's
 * gFDR signature so the two panes read as a pair.
 *
 * Carried from the thin-slice empirical-window.js renderPlot().
 */

import { subBus } from '../sub-conductor.js';
import { colors } from '../util.js';

export const id = 'empirical_locus_v1';
export const view_modes = ['default'];
export const mount_target = '#empirical-plot';

let theme = null;
let lastData = null;
let initialized = false;

function render() {
  const target = document.querySelector(mount_target);
  if (!target) return;
  if (!window.Plotly) { console.warn(`[${id}] Plotly not ready`); return; }
  if (!lastData) { window.Plotly.purge(target); return; }

  const rows = lastData.data || [];
  const dC = rows.map(r => 1 - Number(r.C));
  const chi = rows.map(r => Number(r.chi));
  const c = colors(theme);

  const traces = [
    {
      type: 'scatter', mode: 'lines',
      x: [0, 1], y: [0, 1],
      line: { color: c.muted, width: 1, dash: 'dot' },
      hoverinfo: 'skip', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines+markers',
      x: dC, y: chi,
      line: { color: c.accentSecondary, width: 2.2 },
      marker: { color: c.accentSecondary, size: 6 },
      hovertemplate: 'ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra>empirical</extra>',
      showlegend: false
    }
  ];
  const layout = {
    paper_bgcolor: c.backgroundPanel, plot_bgcolor: c.backgroundPanel,
    font: { color: c.foreground, family: c.fontUI, size: 11 },
    margin: { l: 44, r: 10, t: 8, b: 32 },
    xaxis: {
      title: { text: 'C(0) − C(τ)', font: { color: c.foregroundDim, size: 10 } },
      range: [-0.02, 1.02], gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 }
    },
    yaxis: {
      title: { text: 'χ(τ)', font: { color: c.foregroundDim, size: 10 } },
      range: [-0.05, 1.05], gridcolor: c.border, zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 9 }
    },
    showlegend: false,
    hoverlabel: { bgcolor: c.background, bordercolor: c.border, font: { color: c.foreground, family: c.fontMono } }
  };
  window.Plotly.react(target, traces, layout, { displayModeBar: false, responsive: true });
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_DATA_READY', d => { lastData = d; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

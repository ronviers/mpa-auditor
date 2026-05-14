/**
 * DISPLAYER — spark gap
 *
 * The scientifically load-bearing visualization: predicted and empirical
 * gFDR loci on the same χ-vs-ΔC axes, with the gap between them drawn as
 * "spark" connectors at each shared τ — one segment per point, bridging
 * the predicted locus to where the data actually sits. The length and
 * fan of the sparks *is* the audit: a match has near-zero sparks, a
 * topological miss has sparks that splay, an out-of-scope audit has
 * sparks too long to ignore.
 *
 * Reads AuditDelta.spark_gap (M8 proper — the Audit Engine attaches the
 * common-footing predicted/empirical points + silenced regions). When the
 * delta carries no spark_gap (incompatible_units, posit_grade_pending),
 * the panel says so rather than drawing an empty plot.
 */

import { subBus } from '../sub-conductor.js';
import { colors } from '../util.js';

export const id = 'spark_gap_v1';
export const view_modes = ['default'];
export const mount_target = '#spark-gap-plot';

const SUBTITLE_TARGET = '.panel--spark-gap .panel-subtitle';

let theme = null;
let lastDelta = null;
let initialized = false;

function updateSubtitle(d) {
  const sub = document.querySelector(SUBTITLE_TARGET);
  if (!sub) return;
  const sg = d?.spark_gap;
  if (!sg) { sub.textContent = 'predicted vs empirical'; return; }
  const sil = (sg.silenced_regions || []).length;
  sub.textContent = sil > 0
    ? `predicted vs empirical · ${sil} region${sil > 1 ? 's' : ''} silenced`
    : 'predicted vs empirical';
}

function render() {
  const target = document.querySelector(mount_target);
  if (!target) return;
  if (!window.Plotly) { console.warn(`[${id}] Plotly not ready`); return; }
  const c = colors(theme);

  // No common-footing comparison for this audit (incompatible_units /
  // posit_grade_pending) or no audit yet — purge to a blank plot area,
  // the same way the empirical-locus displayer handles "no data". Do NOT
  // hand-clear innerHTML: Plotly.react updates in place, and nuking the
  // DOM out from under it leaves stale internal state that breaks the
  // next react call.
  const sg = lastDelta?.spark_gap;
  if (!sg || !Array.isArray(sg.predicted) || !sg.predicted.length) {
    window.Plotly.purge(target);
    return;
  }

  const pred = sg.predicted;
  const emp = sg.empirical;
  const predX = pred.map(p => 1 - p.C), predY = pred.map(p => p.chi);
  const empX = emp.map(p => 1 - p.C), empY = emp.map(p => p.chi);

  // Spark connectors — one (predicted → empirical) segment per shared τ,
  // null-separated into a single trace.
  const sparkX = [], sparkY = [];
  for (let i = 0; i < pred.length && i < emp.length; i++) {
    sparkX.push(predX[i], empX[i], null);
    sparkY.push(predY[i], empY[i], null);
  }

  const traces = [
    {
      type: 'scatter', mode: 'lines',
      x: [0, 1], y: [0, 1],
      line: { color: c.muted, width: 1, dash: 'dot' },
      hoverinfo: 'skip', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines',
      x: sparkX, y: sparkY,
      line: { color: c.warning, width: 1.4 },
      hoverinfo: 'skip', name: 'gap', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines+markers',
      x: predX, y: predY,
      line: { color: c.accent, width: 2.2 },
      marker: { color: c.accent, size: 5 },
      hovertemplate: 'predicted<br>ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra></extra>',
      name: 'predicted', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines+markers',
      x: empX, y: empY,
      line: { color: c.accentSecondary, width: 2.2 },
      marker: { color: c.accentSecondary, size: 6 },
      hovertemplate: 'empirical<br>ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra></extra>',
      name: 'empirical', showlegend: false
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
  subBus.subscribe('SUB_AUDIT_DELTA', d => { lastDelta = d; updateSubtitle(d); render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

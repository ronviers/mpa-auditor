/**
 * WINDOW 2 — EMPIRICAL renderer (mock-dataset slice, thin)
 *
 * Renders a DataUpload (contract 05): the mandatory provenance panel
 * (attribution is load-bearing — never hidden, never optional) and the
 * empirical gFDR locus χ vs ΔC, parallel to Window 1's signature inset.
 *
 * Thin-slice scope: one renderer, not the M1-style sub-architecture
 * (that is M7 proper). No CSV path — it renders whatever DATA_READY
 * carries.
 *
 * Subscribes to: DATA_READY (contract 05), THEME_CHANGED (contract 07)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'empirical_window_v1';
const MODULE_VERSION = '0.1.0';
const PROVENANCE_TARGET = '#empirical-provenance';
const DATA_TARGET = '#empirical-data';
const PLOT_TARGET = '#empirical-plot';

let lastData = null;
let initialized = false;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function isFixture(data) {
  const lic = data.provenance?.license || '';
  return lic.startsWith('fixture') || /\[FIXTURE\]/i.test(data.provenance?.citation_text || '');
}

function renderProvenance() {
  const host = document.querySelector(PROVENANCE_TARGET);
  if (!host) return;
  if (!lastData) {
    host.innerHTML = '<span class="provenance-empty">No dataset loaded — load the mock dataset to begin.</span>';
    return;
  }
  const p = lastData.provenance || {};
  const authors = Array.isArray(p.authors) && p.authors.length ? p.authors.join(', ') : '—';
  const fixtureBadge = isFixture(lastData)
    ? '<span class="provenance-fixture-badge">FIXTURE</span>' : '';
  const doiRow = p.doi
    ? `<div class="provenance-row"><span class="provenance-key">DOI</span><span class="provenance-val">${esc(p.doi)}</span></div>` : '';
  host.innerHTML = `
    <div class="provenance-citation">${fixtureBadge}${esc(p.citation_text || '—')}</div>
    <div class="provenance-row"><span class="provenance-key">authors</span><span class="provenance-val">${esc(authors)}</span></div>
    <div class="provenance-row"><span class="provenance-key">license</span><span class="provenance-val">${esc(p.license || 'unknown')}</span></div>
    ${doiRow}
    <div class="provenance-row"><span class="provenance-key">substrate</span><span class="provenance-val">${esc(lastData.substrate_class || '—')}</span></div>`;
}

function renderSummary() {
  const host = document.querySelector(DATA_TARGET);
  if (!host) return;
  if (!lastData) { host.innerHTML = ''; return; }
  const cols = (lastData.columns || [])
    .map(c => `${esc(c.name)} <span class="empirical-units">[${esc(c.units)}]</span>`)
    .join(' · ');
  const unc = lastData.uncertainty_methodology?.type || 'not_reported';
  host.innerHTML = `
    <div class="empirical-summary-row"><span class="empirical-key">rows</span><span>${lastData.n_rows}</span></div>
    <div class="empirical-summary-row"><span class="empirical-key">columns</span><span>${cols}</span></div>
    <div class="empirical-summary-row"><span class="empirical-key">uncertainty</span><span>${esc(unc)}</span></div>`;
}

function renderPlot() {
  const target = document.querySelector(PLOT_TARGET);
  if (!target) return;
  if (!window.Plotly) { console.warn(`[${MODULE_ID}] Plotly not ready`); return; }
  if (!lastData) { window.Plotly.purge(target); return; }

  // Empirical gFDR locus: x = ΔC = C(0) − C(τ) ≈ 1 − C, y = χ. Same axes
  // as Window 1's signature so the two panes read as a pair.
  const rows = lastData.data || [];
  const dC = rows.map(r => 1 - Number(r.C));
  const chi = rows.map(r => Number(r.chi));

  const fg = cssVar('--foreground', '#e8e6e1');
  const fgDim = cssVar('--foreground-dim', '#bcb8b1');
  const muted = cssVar('--muted', '#8a857d');
  const border = cssVar('--border', '#2a2a2a');
  const bg = cssVar('--background-panel', '#2c2c2c');
  const accent = cssVar('--accent-secondary', '#3b577d');
  const fontMono = cssVar('--fonts-mono', 'monospace');
  const fontUI = cssVar('--fonts-ui', 'sans-serif');

  const traces = [
    {
      type: 'scatter', mode: 'lines',
      x: [0, 1], y: [0, 1],
      line: { color: muted, width: 1, dash: 'dot' },
      hoverinfo: 'skip', showlegend: false
    },
    {
      type: 'scatter', mode: 'lines+markers',
      x: dC, y: chi,
      line: { color: accent, width: 2.2 },
      marker: { color: accent, size: 6 },
      hovertemplate: 'ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra>empirical</extra>',
      showlegend: false
    }
  ];
  const layout = {
    paper_bgcolor: bg, plot_bgcolor: bg,
    font: { color: fg, family: fontUI, size: 11 },
    margin: { l: 44, r: 10, t: 8, b: 32 },
    xaxis: {
      title: { text: 'C(0) − C(τ)', font: { color: fgDim, size: 10 } },
      range: [-0.02, 1.02], gridcolor: border, zerolinecolor: border,
      tickfont: { color: muted, family: fontMono, size: 9 }
    },
    yaxis: {
      title: { text: 'χ(τ)', font: { color: fgDim, size: 10 } },
      range: [-0.05, 1.05], gridcolor: border, zerolinecolor: border,
      tickfont: { color: muted, family: fontMono, size: 9 }
    },
    showlegend: false,
    hoverlabel: { bgcolor: cssVar('--background', '#363636'), bordercolor: border, font: { color: fg, family: fontMono } }
  };
  window.Plotly.react(target, traces, layout, { displayModeBar: false, responsive: true });
}

function render() {
  renderProvenance();
  renderSummary();
  renderPlot();
}

export function init() {
  if (initialized) return;
  bus.subscribe('DATA_READY', data => { lastData = data; render(); });
  bus.subscribe('THEME_CHANGED', () => render());
  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: ['provenance_display', 'empirical_locus_plot'],
    subscribes_to: ['DATA_READY', 'THEME_CHANGED'],
    publishes: [],
    computational_profile: 'light',
    requires_libraries: ['plotly'],
    status: 'active',
    session_implemented_in: 7
  });
  initialized = true;
  console.log(`[${MODULE_ID}] active`);
}

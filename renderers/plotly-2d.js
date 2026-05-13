/**
 * PLOTLY 2D RENDERER
 * Draws the gFDR canvas in Window 1. Subscribes to PREDICTION_READY and
 * redraws on every prediction. Subscribes to THEME_CHANGED (contract 07)
 * and re-themes without recomputing.
 *
 * Subscribes to: PREDICTION_READY (contract 02), THEME_CHANGED (contract 07)
 * Publishes:     SELECTION_CHANGED (contract 08, on plot hover/click) — TBD
 *
 * Forbidden:
 *   - No math (read locus_points from PredictedLocus, render)
 *   - No engine imports
 *   - No hardcoded colors. All visual values from the ThemeBundle event
 *     payload or CSS variables (which mirror it).
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'plotly_2d_renderer_v1';
const MODULE_VERSION = '0.1.0';
const PLOT_TARGET = '#prediction-plot';
const META_BADGE = '#regime-badge';
const META_EQUATION = '#prediction-equation';

let theme = null;
let lastPrediction = null;
let plotlyReady = false;

function readCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function colors() {
  // Prefer ThemeBundle values when present; fall back to CSS variables
  // (which Style Manager populates at the same time).
  const t = theme?.tokens || {};
  const rp = theme?.regime_palette || {};
  return {
    background: t.background || readCSSVar('--background', '#363636'),
    backgroundPanel: t.background_panel || readCSSVar('--background-panel', '#2c2c2c'),
    foreground: t.foreground || readCSSVar('--foreground', '#e8e6e1'),
    foregroundDim: t.foreground_dim || readCSSVar('--foreground-dim', '#bcb8b1'),
    muted: t.muted || readCSSVar('--muted', '#8a857d'),
    border: t.border || readCSSVar('--border', '#2a2a2a'),
    accent: t.accent || readCSSVar('--accent', '#7d613b'),
    error: t.error || readCSSVar('--error', '#c97b6a'),
    regime: {
      c: rp.c?.color || readCSSVar('--regime-c-color', '#7a9b6a'),
      s: rp.s?.color || readCSSVar('--regime-s-color', '#c69a4b'),
      r: rp.r?.color || readCSSVar('--regime-r-color', '#5a7a9c'),
      k_frust: rp.k_frust?.color || readCSSVar('--regime-k-frust-color', '#9c5a7a'),
      out_of_scope: rp.out_of_scope?.color || readCSSVar('--regime-out-of-scope-color', '#4a4a4a'),
      posit_grade: rp.posit_grade?.color || readCSSVar('--regime-posit-grade-color', '#8c7a9c')
    },
    fontUI: t.fonts?.ui || readCSSVar('--fonts-ui', 'sans-serif'),
    fontMono: t.fonts?.mono || readCSSVar('--fonts-mono', 'monospace')
  };
}

function regimeColor(regime, c) {
  if (regime === 'deep_c' || regime === 'c_near_s') return c.regime.c;
  if (regime === 's_critical') return c.regime.s;
  if (regime === 'deep_r' || regime === 'r_near_s') return c.regime.r;
  if (regime === 'k_frust') return c.regime.k_frust;
  if (regime === 'out_of_scope') return c.regime.out_of_scope;
  return c.muted;
}

function buildTraces(prediction, c) {
  const points = prediction.locus_points || [];
  const dC = points.map(p => 1 - p.C);
  const chi = points.map(p => p.chi);
  const isPositGrade = prediction.posit_grade?.status === 'posit_grade';
  const locusColor = regimeColor(prediction.regime, c);

  return [
    {
      type: 'scatter',
      mode: 'lines',
      x: [0, 1],
      y: [0, 1],
      name: 'equilibrium FDR',
      line: { color: c.muted, width: 1, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: dC,
      y: chi,
      name: prediction.regime,
      line: { color: locusColor, width: 2.5, dash: isPositGrade ? 'dash' : 'solid' },
      marker: { color: locusColor, size: 4, line: { width: 0 } },
      hovertemplate: 'ΔC = %{x:.3f}<br>χ = %{y:.3f}<extra></extra>'
    }
  ];
}

function buildLayout(c) {
  return {
    paper_bgcolor: c.backgroundPanel,
    plot_bgcolor: c.backgroundPanel,
    font: { color: c.foreground, family: c.fontUI, size: 13 },
    margin: { l: 56, r: 24, t: 16, b: 48 },
    xaxis: {
      title: { text: 'C(0) − C(τ)', font: { color: c.foregroundDim, size: 13 } },
      gridcolor: c.border,
      zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 11 },
      range: [-0.02, 1.02]
    },
    yaxis: {
      title: { text: 'χ(τ)', font: { color: c.foregroundDim, size: 13 } },
      gridcolor: c.border,
      zerolinecolor: c.border,
      tickfont: { color: c.muted, family: c.fontMono, size: 11 },
      range: [-0.08, 1.05]
    },
    showlegend: false,
    hoverlabel: {
      bgcolor: c.background,
      bordercolor: c.border,
      font: { color: c.foreground, family: c.fontMono }
    }
  };
}

const PLOT_CONFIG = { displayModeBar: false, responsive: true };

function updateMeta(prediction, c) {
  const badge = document.querySelector(META_BADGE);
  if (badge) {
    const color = regimeColor(prediction.regime, c);
    badge.textContent = prediction.regime.replace(/_/g, ' ');
    badge.style.color = color;
    badge.style.borderColor = color;
  }

  const eqEl = document.querySelector(META_EQUATION);
  if (eqEl) {
    const eq = prediction.equation;
    if (!eq) {
      eqEl.textContent = '';
    } else if (window.katex) {
      try {
        window.katex.render(eq.latex, eqEl, { throwOnError: false, displayMode: false });
      } catch {
        eqEl.textContent = eq.plain_text || '';
      }
    } else {
      eqEl.textContent = eq.plain_text || '';
    }
  }
}

function ensurePlotly() {
  if (window.Plotly) { plotlyReady = true; return true; }
  if (!plotlyReady) console.warn(`[${MODULE_ID}] Plotly not loaded yet — will render on next prediction`);
  return false;
}

function render() {
  if (!lastPrediction) return;
  if (!ensurePlotly()) return;
  const target = document.querySelector(PLOT_TARGET);
  if (!target) return;
  const c = colors();
  const traces = buildTraces(lastPrediction, c);
  const layout = buildLayout(c);
  window.Plotly.react(target, traces, layout, PLOT_CONFIG);
  updateMeta(lastPrediction, c);
}

function handlePrediction(prediction) {
  lastPrediction = prediction;
  render();
}

function handleThemeChanged(bundle) {
  theme = bundle;
  render();
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: ['gfdr_plot', 'regime_badge', 'equation_display'],
    subscribes_to: ['PREDICTION_READY', 'THEME_CHANGED'],
    publishes: ['SELECTION_CHANGED'],
    computational_profile: 'light',
    requires_libraries: ['plotly', 'katex'],
    status: 'active',
    session_implemented_in: 4
  });
  bus.subscribe('PREDICTION_READY', handlePrediction);
  bus.subscribe('THEME_CHANGED', handleThemeChanged);
  console.log(`[${MODULE_ID}] active`);
}

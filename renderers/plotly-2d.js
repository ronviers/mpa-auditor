/**
 * PLOTLY 2D RENDERER — Prediction-pane composition
 *
 * Drives the multi-panel Window 1 display:
 *
 *   - Regime manifold heatmap over (chit × γ_AB) with bifurcation
 *     overlays (transcritical, pitchfork), k_frust hatched region
 *     (visible as actual "holes" — N≥3 posit-extension territory in
 *     continuous mode; realized cycle in discrete mode), out-of-scope
 *     hatched region, current operating point as crosshair.
 *     Click anywhere on the manifold → publishes MANIFOLD_PICK so the
 *     Layout Manager re-positions both sliders.
 *   - gFDR signature χ(τ) vs C(0)−C(τ) for the current point with
 *     equilibrium-FDR diagonal as reference.
 *   - Invariants list (cdv1 named quantities: chit, G₀/L, Q, α_s, P_s,
 *     X_c, X_r, V_scalar, ε, β_mem, Wall%) with posit-grade items
 *     visually distinguished.
 *   - Pattern admissibility list (Hebbian, Independent memory, Mentor,
 *     Lotka–Volterra, Cooperative lock, k_frust, Chimera, Turing,
 *     MIPS) — load-bearing vs posit-extension marked.
 *   - Active-posits strip across the bottom (cdv1 five leading-order
 *     posits).
 *
 * Subscribes to: PREDICTION_READY (contract 02), THEME_CHANGED (contract 07)
 * Publishes:     MANIFOLD_PICK (internal), SELECTION_CHANGED (contract 08)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'plotly_2d_renderer_v1';
const MODULE_VERSION = '0.4.0';
const MANIFOLD_TARGET = '#manifold-plot';
const FDR_TARGET = '#fdr-plot';
const TRAJECTORY_TARGET = '#trajectory-plot';
const TRAJECTORY_META = '#trajectory-meta';
const META_BADGE = '#regime-badge';
const META_EQUATION = '#prediction-equation';
const INVARIANTS_LIST = '#invariants-list';
const PATTERNS_LIST = '#patterns-list';
const POSITS_CONTENT = '#posits-content';

let theme = null;
let lastPrediction = null;
let manifoldClickAttached = false;

function readCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function colors() {
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
    accentSecondary: t.accent_secondary || readCSSVar('--accent-secondary', '#3b577d'),
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

/* ---------- Manifold ---------- */

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
    hoverlabel: {
      bgcolor: c.background, bordercolor: c.border,
      font: { color: c.foreground, family: c.fontMono }
    }
  };
}

/* ---------- Trajectory strip (real ODE from WASM solver) ---------- */

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
    el.textContent = 'solver: unavailable';
    return;
  }
  const v = traj.solver_version || '?';
  el.textContent = `solver: ${ms.toFixed(2)} ms · v${v} · ${traj.t.length} samples`;
}

/* ---------- gFDR ---------- */

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

/* ---------- Lists ---------- */

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderInvariants(prediction) {
  const list = document.querySelector(INVARIANTS_LIST);
  if (!list) return;
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const items = state.invariants || [];
  list.innerHTML = items.map(inv => `
    <div class="invariant ${inv.grade === 'posit' ? 'is-posit' : ''}" title="${escapeHTML(inv.name)}">
      <span class="invariant-symbol">${escapeHTML(inv.symbol)}</span>
      <span class="invariant-value">${escapeHTML(inv.display)}</span>
      ${inv.grade === 'posit' ? '<span class="invariant-tag" title="depends on a leading-order posit">posit</span>' : '<span class="invariant-tag-spacer"></span>'}
    </div>
  `).join('');
}

function renderPatterns(prediction) {
  const list = document.querySelector(PATTERNS_LIST);
  if (!list) return;
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const items = state.patterns || [];
  list.innerHTML = items.map(p => {
    const cls = ['pattern'];
    if (p.admissible) cls.push('is-admissible');
    if (p.grade === 'posit') cls.push('is-posit');
    if (p.posit_active && !p.admissible) cls.push('is-posit-region');
    const mark = p.admissible ? '●' : (p.posit_active ? '◐' : '○');
    return `
      <div class="${cls.join(' ')}" ${p.note ? `title="${escapeHTML(p.note)}"` : ''}>
        <span class="pattern-mark">${mark}</span>
        <span class="pattern-name">${escapeHTML(p.name)}</span>
      </div>
    `;
  }).join('');
}

function renderPosits(prediction) {
  const el = document.querySelector(POSITS_CONTENT);
  if (!el) return;
  const state = prediction.continuous_state || prediction.discrete_state || {};
  const posits = state.posits_active || [];
  el.innerHTML = posits.map(p =>
    `<span class="posit ${p.active ? 'is-active' : 'is-dormant'}" title="${escapeHTML(p.note || '')}">${escapeHTML(p.label)}</span>`
  ).join('');
}

/* ---------- Meta ---------- */

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

/* ---------- Plotly orchestration ---------- */

function ensurePlotly() { return !!window.Plotly; }

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
  if (!ensurePlotly()) { console.warn(`[${MODULE_ID}] Plotly not ready`); return; }
  const mTarget = document.querySelector(MANIFOLD_TARGET);
  const fTarget = document.querySelector(FDR_TARGET);
  if (!mTarget || !fTarget) return;

  const c = colors();
  const cfg = { displayModeBar: false, responsive: true };

  window.Plotly.react(mTarget, manifoldTraces(lastPrediction, c), manifoldLayout(c), cfg);
  attachManifoldClickOnce();

  window.Plotly.react(fTarget, fdrTraces(lastPrediction, c), fdrLayout(c, lastPrediction.regime), cfg);

  const tTarget = document.querySelector(TRAJECTORY_TARGET);
  if (tTarget) {
    window.Plotly.react(tTarget, trajectoryTraces(lastPrediction, c), trajectoryLayout(c), cfg);
  }

  updateMeta(lastPrediction, c);
  updateTrajectoryMeta(lastPrediction);
  renderInvariants(lastPrediction);
  renderPatterns(lastPrediction);
  renderPosits(lastPrediction);
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
    capabilities: [
      'regime_manifold', 'bifurcation_overlays', 'k_frust_hatching',
      'out_of_scope_hatching', 'operating_point_crosshair',
      'manifold_click_navigation', 'gfdr_plot', 'trajectory_strip',
      'invariants_panel', 'pattern_admissibility', 'posits_strip',
      'regime_badge', 'equation_display'
    ],
    subscribes_to: ['PREDICTION_READY', 'THEME_CHANGED'],
    publishes: ['MANIFOLD_PICK', 'SELECTION_CHANGED'],
    computational_profile: 'light',
    requires_libraries: ['plotly', 'katex'],
    status: 'active',
    session_implemented_in: 4
  });
  bus.subscribe('PREDICTION_READY', handlePrediction);
  bus.subscribe('THEME_CHANGED', handleThemeChanged);
  console.log(`[${MODULE_ID}] active`);
}

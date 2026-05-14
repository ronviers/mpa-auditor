/**
 * PREDICTION SUB-ARCHITECTURE — shared stateless utilities
 *
 * The one sanctioned cross-displayer import. Pure helpers, no state:
 * each displayer imports what it needs. If a function here needs to
 * remember something between calls, it does not belong in this file.
 *
 *   - readCSSVar(name, fallback)  -- :root custom-property read
 *   - colors(theme)               -- resolved palette (theme bundle → CSS var)
 *   - regimeColor(regime, c)      -- regime class → palette colour
 *   - escapeHTML(s)               -- HTML-escape for innerHTML strings
 */

export function readCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function colors(theme) {
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

export function regimeColor(regime, c) {
  if (regime === 'deep_c' || regime === 'c_near_s') return c.regime.c;
  if (regime === 's_critical') return c.regime.s;
  if (regime === 'deep_r' || regime === 'r_near_s') return c.regime.r;
  if (regime === 'k_frust') return c.regime.k_frust;
  if (regime === 'out_of_scope') return c.regime.out_of_scope;
  return c.muted;
}

export function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

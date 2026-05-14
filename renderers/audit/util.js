/**
 * AUDIT SUB-ARCHITECTURE — shared stateless utilities
 *
 * The one sanctioned cross-displayer import (mirrors M1's
 * prediction/util.js). Pure helpers, no state.
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
    warning: t.warning || readCSSVar('--warning', '#c69a4b'),
    error: t.error || readCSSVar('--error', '#c97b6a'),
    regimeC: rp.c?.color || readCSSVar('--regime-c-color', '#7a9b6a'),
    fontUI: t.fonts?.ui || readCSSVar('--fonts-ui', 'sans-serif'),
    fontMono: t.fonts?.mono || readCSSVar('--fonts-mono', 'monospace')
  };
}

export function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function num(v, digits = 3) {
  return (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toFixed(digits);
}

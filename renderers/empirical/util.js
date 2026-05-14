/**
 * EMPIRICAL SUB-ARCHITECTURE — shared stateless utilities
 *
 * The one sanctioned cross-displayer import (mirrors M1's
 * prediction/util.js). Pure helpers, no state.
 *
 *   - readCSSVar(name, fallback)  -- :root custom-property read
 *   - colors(theme)               -- resolved palette (theme bundle → CSS var)
 *   - escapeHTML(s)               -- HTML-escape for innerHTML strings
 *   - rangeText(range)            -- "[a, b]" formatter, tolerant of nulls
 */

export function readCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function colors(theme) {
  const t = theme?.tokens || {};
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
    fontUI: t.fonts?.ui || readCSSVar('--fonts-ui', 'sans-serif'),
    fontMono: t.fonts?.mono || readCSSVar('--fonts-mono', 'monospace')
  };
}

export function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function rangeText(range) {
  if (!Array.isArray(range) || range.length !== 2) return '—';
  const fmt = v => (v == null || !Number.isFinite(v)) ? '—' : Number(v).toPrecision(4);
  return `[${fmt(range[0])}, ${fmt(range[1])}]`;
}

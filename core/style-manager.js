/**
 * STYLE MANAGER
 *
 * Loads styles/theme.json and converts every token into a CSS custom
 * property on :root. Publishes THEME_CHANGED with the full ThemeBundle
 * (contract 07) so renderers can theme themselves without importing
 * from this module.
 *
 * Implements:
 *   - load()              -- fetches theme.json, applies tokens
 *   - setTheme(name)      -- toggles between 'dark' and 'light'
 *   - getThemeBundle()    -- synchronous accessor for renderers that need
 *                            theme data at init time (before any
 *                            THEME_CHANGED event has fired since they
 *                            subscribed).
 *
 * Publishes: THEME_CHANGED (contract 07 ThemeBundle)
 *
 * Forbidden:
 *   - No engine or renderer imports
 *   - No hardcoded color/font/size values in this file
 */

import { bus } from './conductor.js';

let currentTheme = null;
let themeData = null;

function applyTokens(tokens, prefix = '') {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('_')) continue; // _note, _design_notes, etc.
    const segment = key.replace(/_/g, '-');
    const varName = prefix ? `--${prefix}-${segment}` : `--${segment}`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      applyTokens(value, prefix ? `${prefix}-${segment}` : segment);
    } else if (typeof value === 'string' || typeof value === 'number') {
      root.style.setProperty(varName, String(value));
    }
  }
}

async function loadTheme() {
  const response = await fetch('./styles/theme.json');
  if (!response.ok) throw new Error(`theme.json failed to load: ${response.status}`);
  themeData = await response.json();
  applyTokens(themeData.tokens);
  if (themeData.regime_palette) {
    applyTokens(themeData.regime_palette, 'regime');
  }
  currentTheme = themeData.theme_name || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
}

function publishBundle() {
  // Contract 07 — ThemeBundle. We forward the loaded theme.json verbatim
  // (additionalProperties is implicit on bundle consumers; the contract
  // describes the *required* shape).
  bus.publish('THEME_CHANGED', {
    theme_name: currentTheme,
    tokens: themeData.tokens,
    regime_palette: themeData.regime_palette,
    perceptual_palette: themeData.perceptual_palette,
    miss_category_styling: themeData.miss_category_styling,
    animation: themeData.animation,
    accessibility: themeData.accessibility
  });
}

export function setTheme(name) {
  if (name !== 'dark' && name !== 'light') {
    console.warn(`[style-manager] unknown theme "${name}"; ignoring`);
    return;
  }
  currentTheme = name;
  document.documentElement.setAttribute('data-theme', name);
  publishBundle();
}

export function getTheme() {
  return currentTheme;
}

export function getThemeBundle() {
  return themeData;
}

export async function init() {
  await loadTheme();
  bus.register({
    module_id: 'style_manager_v1',
    module_type: 'core',
    version: '0.2.0',
    capabilities: ['theme_loading', 'css_variable_application', 'theme_toggle', 'theme_bundle_broadcast'],
    subscribes_to: [],
    publishes: ['THEME_CHANGED'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 1
  });
  // Initial broadcast so renderers initialised later receive the bundle.
  publishBundle();
  console.log(`[style_manager_v1] theme "${currentTheme}" applied + bundle published`);
}

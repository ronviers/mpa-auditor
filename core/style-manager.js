/**
 * STYLE MANAGER
 *
 * Loads styles/theme.json and converts every token into a CSS custom
 * property on :root. The rest of the codebase references var(--token-name)
 * and never hardcodes a visual value.
 *
 * Implements:
 *   - load()              -- fetches theme.json, applies tokens
 *   - setTheme(name)      -- toggles between 'dark' and 'light'
 *
 * Publishes: THEME_CHANGED (contract 07-adjacent — full theme bundle
 *            broadcast comes online when renderers consume it)
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
    const varName = prefix ? `--${prefix}-${key}` : `--${key}`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      applyTokens(value, prefix ? `${prefix}-${key}` : key);
    } else if (typeof value === 'string' || typeof value === 'number') {
      root.style.setProperty(varName.replace(/_/g, '-'), String(value));
    }
  }
}

async function loadTheme() {
  const response = await fetch('./styles/theme.json');
  if (!response.ok) throw new Error(`theme.json failed to load: ${response.status}`);
  themeData = await response.json();
  applyTokens(themeData.tokens);
  currentTheme = themeData.theme_name || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
}

export function setTheme(name) {
  if (name !== 'dark' && name !== 'light') {
    console.warn(`[style-manager] unknown theme "${name}"; ignoring`);
    return;
  }
  currentTheme = name;
  document.documentElement.setAttribute('data-theme', name);
  // Session 12 will populate a separate light-palette token set.
  // For Session 1: the attribute flip is the visible affordance.
  bus.publish('THEME_CHANGED', {
    timestamp: new Date().toISOString(),
    theme_name: name,
    palette_source: themeData?._palette_source ?? null
  });
}

export function getTheme() {
  return currentTheme;
}

export async function init() {
  await loadTheme();
  bus.register({
    module_id: 'style_manager_v1',
    module_type: 'core',
    version: '0.1.0',
    capabilities: ['theme_loading', 'css_variable_application', 'theme_toggle'],
    subscribes_to: [],
    publishes: ['THEME_CHANGED'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 1
  });
  console.log(`[style_manager_v1] theme "${currentTheme}" applied`);
}

/**
 * DISPLAYER — meta strip
 *
 * Regime badge + KaTeX equation in the prediction-meta row.
 * Carved from plotly-2d.js `updateMeta()`.
 */

import { subBus } from '../sub-conductor.js';
import { colors, regimeColor } from '../util.js';

export const id = 'meta_strip_v1';
export const view_modes = ['taxonomic', 'kinematic', 'topological'];
export const mount_target = '#prediction-meta';

const META_BADGE = '#regime-badge';
const META_EQUATION = '#prediction-equation';

let theme = null;
let lastPrediction = null;
let initialized = false;

function render() {
  if (!lastPrediction) return;
  const prediction = lastPrediction;
  const c = colors(theme);

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

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

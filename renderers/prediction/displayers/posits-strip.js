/**
 * DISPLAYER — posits strip
 *
 * Bottom strip: which of the cdv1 five leading-order posits are engaged
 * at the current operating point. Carved from plotly-2d.js
 * `renderPosits()`.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML } from '../util.js';

export const id = 'posits_strip_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '.posits-strip';

const POSITS_CONTENT = '#posits-content';

let lastPrediction = null;
let initialized = false;

function render() {
  if (!lastPrediction) return;
  const el = document.querySelector(POSITS_CONTENT);
  if (!el) return;
  const state = lastPrediction.continuous_state || lastPrediction.discrete_state || {};
  const posits = state.posits_active || [];
  el.innerHTML = posits.map(p =>
    `<span class="posit ${p.active ? 'is-active' : 'is-dormant'}" title="${escapeHTML(p.note || '')}">${escapeHTML(p.label)}</span>`
  ).join('');
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

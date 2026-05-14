/**
 * DISPLAYER — invariants panel
 *
 * HTML list of cdv1 named quantities (chit, G₀/L, Q, α_s, P_s, X_c,
 * X_r, V_scalar, ε, β_mem, Wall%), posit-grade items distinguished.
 * Carved from plotly-2d.js `renderInvariants()`.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML } from '../util.js';

export const id = 'invariants_panel_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#invariants-list';

const INVARIANTS_LIST = '#invariants-list';

let lastPrediction = null;
let initialized = false;

function render() {
  if (!lastPrediction) return;
  const list = document.querySelector(INVARIANTS_LIST);
  if (!list) return;
  const state = lastPrediction.continuous_state || lastPrediction.discrete_state || {};
  const items = state.invariants || [];
  list.innerHTML = items.map(inv => `
    <div class="invariant ${inv.grade === 'posit' ? 'is-posit' : ''}" title="${escapeHTML(inv.name)}">
      <span class="invariant-symbol">${escapeHTML(inv.symbol)}</span>
      <span class="invariant-value">${escapeHTML(inv.display)}</span>
      ${inv.grade === 'posit' ? '<span class="invariant-tag" title="depends on a leading-order posit">posit</span>' : '<span class="invariant-tag-spacer"></span>'}
    </div>
  `).join('');
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

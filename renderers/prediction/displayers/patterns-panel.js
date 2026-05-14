/**
 * DISPLAYER — patterns panel
 *
 * HTML list of composite-pattern admissibility (Hebbian, Independent
 * memory, Mentor, Lotka–Volterra, Cooperative lock, k_frust, Chimera,
 * Turing, MIPS), load-bearing vs posit-extension marked. Carved from
 * plotly-2d.js `renderPatterns()`.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML } from '../util.js';

export const id = 'patterns_panel_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#patterns-list';

const PATTERNS_LIST = '#patterns-list';

let lastPrediction = null;
let initialized = false;

function render() {
  if (!lastPrediction) return;
  const list = document.querySelector(PATTERNS_LIST);
  if (!list) return;
  const state = lastPrediction.continuous_state || lastPrediction.discrete_state || {};
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

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

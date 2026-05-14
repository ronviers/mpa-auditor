/**
 * DISPLAYER — Cobham Stack
 *
 * Vertical pressure-gauge stack for the heat-tax tower (cdv1 §Heat-tax
 * tower, §Load-handling). Five tower levels, each a gauge: fill = per-level
 * utilisation u_n (= ε_n under the optimal-encoding posit), readout = the
 * Cobham wait W_n = W_0/[(1-u_{n-1})(1-u_n)]. As u_n → 1 the wait diverges
 * and the level "shatters" — the Complexity Wall in queueing register.
 *
 * Pure rendering: reads tower.u_per_level / W_per_level / epsilon_per_level,
 * emitted by both engines. Theme-reactive via CSS variables (re-render).
 */

import { subBus } from '../sub-conductor.js';

export const id = 'cobham_stack_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#cobham-stack';

const TARGET = '#cobham-stack';
const STRAIN_U = 0.6;     // utilisation at which a level reads "strained"
const SHATTER_U = 0.85;   // utilisation at which a level shatters

let lastPrediction = null;
let initialized = false;

function levelClass(u) {
  if (u >= SHATTER_U) return 'is-shattered';
  if (u >= STRAIN_U) return 'is-strained';
  return 'is-safe';
}

function render() {
  if (!lastPrediction) return;
  const host = document.querySelector(TARGET);
  if (!host) return;
  const state = lastPrediction.continuous_state || lastPrediction.discrete_state || {};
  const tower = state.tower;
  if (!tower || !tower.u_per_level || !tower.W_per_level) {
    host.innerHTML = '<div class="cobham-empty">no tower data</div>';
    return;
  }
  const { levels, u_per_level, W_per_level } = tower;
  // Level 4 (top of the tower) rendered first; level 0 (base) last.
  const rows = levels.slice().reverse().map(n => {
    const u = u_per_level[n];
    const W = W_per_level[n];
    const fillPct = Math.min(100, Math.max(0, u * 100)).toFixed(1);
    const wDisplay = W >= 1000 ? '∞' : (W >= 100 ? W.toFixed(0) : W.toFixed(2));
    return `
      <div class="cobham-level ${levelClass(u)}">
        <span class="cobham-level-label">n${n}</span>
        <div class="cobham-gauge">
          <div class="cobham-gauge-fill" style="width:${fillPct}%"></div>
        </div>
        <span class="cobham-wait" title="Cobham wait W_${n} (multiples of baseline W₀)">W ${wDisplay}</span>
        <span class="cobham-u" title="utilisation u_${n} = ε_${n}">u ${u.toFixed(2)}</span>
      </div>`;
  }).join('');
  const wp = (100 * (tower.wall_proximity ?? 0)).toFixed(0);
  host.innerHTML = `
    <div class="cobham-stack-inner">${rows}</div>
    <div class="cobham-footer">Wall proximity ${wp}%</div>`;
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

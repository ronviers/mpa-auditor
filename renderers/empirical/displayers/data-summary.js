/**
 * DISPLAYER — data summary
 *
 * Rows, columns, uncertainty methodology, and the per-column metadata
 * stanza (foundational-answers.md §Q1): coverage_range computed from the
 * data, validity_range declared-or-defaulted, with the range_source
 * honesty marker visible. Conflating coverage with validity is exactly
 * the "no silent faking" failure — so this panel shows both, distinctly.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc, rangeText } from '../util.js';

export const id = 'data_summary_v1';
export const view_modes = ['default'];
export const mount_target = '#empirical-data';

let lastData = null;
let initialized = false;

function columnRow(col) {
  const cov = rangeText(col.coverage_range);
  const val = rangeText(col.validity_range);
  const src = col.range_source || 'computed';
  const srcCls = src === 'declared' ? 'range-declared' : 'range-computed';
  return `
    <div class="column-meta">
      <div class="column-meta-name">${esc(col.name)} <span class="empirical-units">[${esc(col.units)}]</span></div>
      <div class="column-meta-ranges">
        <span class="column-meta-range"><span class="range-key">coverage</span> ${esc(cov)}</span>
        <span class="column-meta-range"><span class="range-key">validity</span> ${esc(val)}
          <span class="range-source ${srcCls}">${esc(src)}</span></span>
      </div>
    </div>`;
}

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  if (!lastData) { host.innerHTML = ''; return; }

  const unc = lastData.uncertainty_methodology?.type || 'not_reported';
  const cols = lastData.columns || [];
  const hasMeta = cols.some(c => c.coverage_range);

  host.innerHTML = `
    <div class="empirical-summary-row"><span class="empirical-key">rows</span><span>${lastData.n_rows}</span></div>
    <div class="empirical-summary-row"><span class="empirical-key">uncertainty</span><span>${esc(unc)}</span></div>
    ${hasMeta
      ? `<div class="column-meta-list">${cols.map(columnRow).join('')}</div>`
      : `<div class="empirical-summary-row"><span class="empirical-key">columns</span><span>${
          cols.map(c => `${esc(c.name)} [${esc(c.units)}]`).join(' · ')}</span></div>`}`;
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_DATA_READY', d => { lastData = d; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

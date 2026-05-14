/**
 * DISPLAYER — gap prompt
 *
 * Renders the declaration-first gap list (foundational-answers.md §Q9).
 * The Data Engine's gap-detection pass emits DECLARATION_GAPS; this panel
 * draws each gap as a typed prompt the researcher answers by declaration.
 * Answers publish DECLARATION_PROVIDED on the main bus — the Data Engine
 * folds them in, appends to the declaration trail, and re-runs the pass.
 *
 * Blocking gaps hold DATA_READY back (no audit until answered); advisory
 * gaps ride through (the audit runs; the prompt stays as a refinable
 * caveat). The panel is a flat typed list — not a wizard
 * (next-session-handoff §4 "watch").
 *
 * Outbound to the main bus directly — its consumer, the Data Engine, is a
 * top-level module (the M1 regime-manifold → MANIFOLD_PICK pattern).
 */

import { bus as mainBus } from '../../../core/conductor.js';
import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc } from '../util.js';

export const id = 'gap_prompt_v1';
export const view_modes = ['default'];
export const mount_target = '#empirical-gaps';

let initialized = false;
let current = null;   // last DECLARATION_GAPS payload

const KIND_LABEL = {
  missing_provenance: 'missing provenance',
  unmapped_observable: 'unmapped observable',
  unknown_class: 'unclassified substrate',
  missing_validity_range: 'validity range not declared',
  missing_uncertainty: 'uncertainty not reported',
};

function optionControl(gap, opt) {
  const base = `data-gap="${esc(gap.id)}" data-kind="${esc(gap.kind)}" data-field="${esc(gap.field)}" data-option="${esc(opt.id)}"`;
  if (opt.input === 'text') {
    return `
      <div class="gap-option">
        <input type="text" class="gap-input" ${base} placeholder="declare a value" />
        <button type="button" class="btn gap-answer" ${base}>${esc(opt.label)}</button>
      </div>`;
  }
  if (opt.input === 'range') {
    return `
      <div class="gap-option">
        <input type="number" step="any" class="gap-input gap-input-lo" ${base} placeholder="min" />
        <input type="number" step="any" class="gap-input gap-input-hi" ${base} placeholder="max" />
        <button type="button" class="btn gap-answer" ${base}>${esc(opt.label)}</button>
      </div>`;
  }
  if (opt.input === 'column_map') {
    const fields = Array.isArray(opt.fields) ? opt.fields : [];
    const sel = role => `<select class="gap-colsel" data-role="${role}" ${base}>
        <option value="">— ${role} —</option>
        ${fields.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
      </select>`;
    return `
      <div class="gap-option gap-option-colmap">
        ${sel('tau')}${sel('C')}${sel('chi')}
        <button type="button" class="btn gap-answer" ${base}>${esc(opt.label)}</button>
      </div>`;
  }
  return `<div class="gap-option">
      <button type="button" class="btn gap-answer" ${base}>${esc(opt.label)}</button>
    </div>`;
}

function gapBlock(gap) {
  return `
    <div class="gap-item gap-item--${esc(gap.severity)}">
      <div class="gap-item-head">
        <span class="gap-severity gap-severity--${esc(gap.severity)}">${esc(gap.severity)}</span>
        <span class="gap-kind">${esc(KIND_LABEL[gap.kind] || gap.kind)}</span>
      </div>
      <div class="gap-context">${esc(gap.context)}</div>
      <div class="gap-options">${gap.options.map(o => optionControl(gap, o)).join('')}</div>
    </div>`;
}

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  const gaps = current?.gaps || [];
  if (!gaps.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  const blocking = gaps.filter(g => g.severity === 'blocking').length;
  const header = blocking > 0
    ? `<span class="gap-header-blocked">${blocking} blocking gap${blocking > 1 ? 's' : ''} — audit held until declared</span>`
    : `<span class="gap-header-advisory">declaration gaps — the audit runs; you may still refine these</span>`;
  host.innerHTML = `
    <div class="gap-header">${header}</div>
    ${gaps.map(gapBlock).join('')}`;
  host.querySelectorAll('.gap-answer').forEach(btn => {
    btn.addEventListener('click', () => answer(btn));
  });
}

function answer(btn) {
  if (!current) return;
  const { gap, kind, field, option } = btn.dataset;
  let value;
  if (option === 'declare' || option === 'remap') {
    const scope = btn.closest('.gap-option');
    if (scope?.querySelector('.gap-input-lo')) {
      value = [Number(scope.querySelector('.gap-input-lo').value),
               Number(scope.querySelector('.gap-input-hi').value)];
    } else if (scope?.querySelector('.gap-colsel')) {
      value = {};
      scope.querySelectorAll('.gap-colsel').forEach(s => {
        if (s.value) value[s.dataset.role] = s.value;
      });
    } else if (scope?.querySelector('.gap-input')) {
      value = scope.querySelector('.gap-input').value.trim();
    }
  }
  mainBus.publish('DECLARATION_PROVIDED', {
    upload_id: current.upload_id,
    gap_id: gap,
    gap_kind: kind,
    field,
    option_id: option,
    value,
    timestamp: new Date().toISOString(),
  });
  console.log(`[${id}] DECLARATION_PROVIDED — ${kind} / ${option}`);
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_DECLARATION_GAPS', payload => { current = payload; render(); });
  // A fresh dataset with no gap pass (e.g. a fixture) clears the panel.
  subBus.subscribe('SUB_DATA_READY', d => {
    if (!current || current.upload_id !== d.upload_id) { current = null; render(); }
  });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  render();
  console.log(`[${id}] active`);
}

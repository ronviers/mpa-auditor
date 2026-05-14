/**
 * DISPLAYER — verdict panel
 *
 * The audit's headline: status, the one-line verdict, the topology /
 * numerics / confidence flags, and the §Q6 slot-aware reading — the
 * sharper sentence that says what the status means *for the gFDR-locus
 * slot* on this substrate.
 *
 * Carried from the thin-slice audit-window.js status block; the §Q6
 * slot_reading is the M8-proper addition.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc } from '../util.js';

export const id = 'verdict_panel_v1';
export const view_modes = ['default'];
export const mount_target = '#audit-verdict';

let lastDelta = null;
let initialized = false;

const STATUS_LABEL = {
  match: 'MATCH',
  numerical_miss: 'NUMERICAL MISS',
  topological_miss: 'TOPOLOGICAL MISS',
  out_of_scope: 'OUT OF SCOPE',
  posit_grade_pending: 'POSIT-GRADE PENDING',
  incompatible_units: 'INCOMPATIBLE UNITS'
};

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  if (!lastDelta) {
    host.innerHTML = '<p class="audit-empty">Load an empirical dataset to run an audit.</p>';
    return;
  }
  const d = lastDelta;
  const label = STATUS_LABEL[d.status] || d.status;
  const vd = d.visualization_directives || {};

  host.innerHTML = `
    <div class="audit-status audit-status--${esc(d.status)}">${esc(label)}</div>
    ${vd.annotation_text ? `<p class="audit-verdict">${esc(vd.annotation_text)}</p>` : ''}
    ${d.slot_reading ? `<p class="audit-slot-reading">${esc(d.slot_reading)}</p>` : ''}
    <div class="audit-flags">
      <span class="audit-flag ${d.topology_match ? 'is-yes' : 'is-no'}">topology ${d.topology_match ? '✓' : '✗'}</span>
      <span class="audit-flag ${d.numerical_match ? 'is-yes' : 'is-no'}">numerics ${d.numerical_match ? '✓' : '✗'}</span>
      ${d.confidence_score != null ? `<span class="audit-flag is-neutral">confidence ${(d.confidence_score * 100).toFixed(0)}%</span>` : ''}
    </div>`;
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_AUDIT_DELTA', delta => { lastDelta = delta; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  render();
  console.log(`[${id}] active`);
}

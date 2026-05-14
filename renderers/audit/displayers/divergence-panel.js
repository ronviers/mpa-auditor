/**
 * DISPLAYER — divergence panel
 *
 * The audit's detail: the primary divergence (predicted → empirical with
 * σ-distance and tolerance), the recommended extension axis or scope
 * diagnosis, and the §Q4 audit domain — the τ-window the audit covered
 * and the regions it silenced, with the reason for each. Silencing is
 * shown, never hidden: an audit that covers less than the full data is
 * honest about exactly how much less.
 *
 * Carried from the thin-slice audit-window.js divergence + extension +
 * scope blocks; the audit-domain block is the M8-proper addition.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc, num } from '../util.js';

export const id = 'divergence_panel_v1';
export const view_modes = ['default'];
export const mount_target = '#audit-divergence';

let lastDelta = null;
let initialized = false;

const SILENCE_REASON = {
  below_validity: 'below the declared validity range',
  above_coverage: 'above the data coverage',
  out_of_gamut_substrate_class: 'outside the substrate-class gamut',
};

function divergenceBlock(d) {
  if (!d) return '';
  const sig = d.sigma_off == null ? '' : ` · ${num(d.sigma_off, 2)}σ`;
  const tol = d.tolerance == null ? '' : ` (tol ${d.tolerance})`;
  return `
    <div class="audit-divergence">
      <div class="audit-divergence-q">${esc(d.quantity)}${esc(tol)}</div>
      <div class="audit-divergence-vals">
        <span class="audit-pred">predicted ${esc(num(d.predicted_val))}</span>
        <span class="audit-arrow">→</span>
        <span class="audit-emp">empirical ${esc(num(d.empirical_val))}${esc(sig)}</span>
      </div>
    </div>`;
}

function domainBlock(delta) {
  const ad = delta.audit_domain;
  const sr = delta.silenced_regions || [];
  if (!ad && !sr.length) return '';
  const domain = ad
    ? `<div class="audit-domain-line">τ ∈ [${num(ad.tau?.[0], 4)}, ${num(ad.tau?.[1], 4)}]</div>` : '';
  const silenced = sr.length
    ? `<div class="audit-silenced">${sr.map(r =>
        `<div class="audit-silenced-row">silenced τ [${num(r.tau?.[0], 4)}, ${num(r.tau?.[1], 4)}] — ${esc(SILENCE_REASON[r.reason] || r.reason)}</div>`
      ).join('')}</div>`
    : '<div class="audit-domain-clean">no regions silenced — the audit covers the full data</div>';
  return `
    <div class="audit-section">
      <span class="audit-section-label">audit domain</span>
      ${domain}
      ${silenced}
    </div>`;
}

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  if (!lastDelta) { host.innerHTML = ''; return; }
  const d = lastDelta;
  const ext = d.recommended_extension;
  const scope = d.scope_diagnosis;

  const extBlock = ext ? `
    <div class="audit-section">
      <span class="audit-section-label">recommended extension</span>
      <div class="audit-ext">${esc(ext.extension_axis)}</div>
      <div class="audit-ext-rationale">${esc(ext.rationale || '')}</div>
    </div>` : '';
  const scopeBlock = scope ? `
    <div class="audit-section">
      <span class="audit-section-label">scope diagnosis</span>
      <div class="audit-ext">${esc(scope.reason)}</div>
      <div class="audit-ext-rationale">${esc(scope.explanation || '')}</div>
    </div>` : '';

  host.innerHTML = `
    ${divergenceBlock(d.primary_divergence)}
    ${extBlock}
    ${scopeBlock}
    ${domainBlock(d)}`;
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

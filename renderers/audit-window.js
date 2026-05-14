/**
 * WINDOW 3 — AUDIT renderer (mock-dataset slice, thin)
 *
 * Renders an AuditDelta (contract 03) — the prediction-vs-data gap. The
 * scientifically load-bearing window: status, the primary divergence,
 * the verdict, any recommended extension or scope diagnosis, and the
 * mandatory provenance echo.
 *
 * Thin-slice scope: a structured verdict display, not the spark-gap /
 * ghost-locus visualization (that is M8's renderer proper). Honors
 * AuditDelta.visualization_directives as text cues only.
 *
 * Subscribes to: AUDIT_DELTA (contract 03), THEME_CHANGED (contract 07)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'audit_window_v1';
const MODULE_VERSION = '0.1.0';
const TARGET = '#audit-content';

const STATUS_LABEL = {
  match: 'MATCH',
  numerical_miss: 'NUMERICAL MISS',
  topological_miss: 'TOPOLOGICAL MISS',
  out_of_scope: 'OUT OF SCOPE',
  posit_grade_pending: 'POSIT-GRADE PENDING',
  incompatible_units: 'INCOMPATIBLE UNITS'
};

let lastDelta = null;
let initialized = false;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function divergenceBlock(d) {
  if (!d) return '';
  const pv = d.predicted_val == null ? '—' : Number(d.predicted_val).toFixed(3);
  const ev = d.empirical_val == null ? '—' : Number(d.empirical_val).toFixed(3);
  const sig = d.sigma_off == null ? '' : ` · ${Number(d.sigma_off).toFixed(2)}σ`;
  const tol = d.tolerance == null ? '' : ` (tol ${d.tolerance})`;
  return `
    <div class="audit-divergence">
      <div class="audit-divergence-q">${esc(d.quantity)}${esc(tol)}</div>
      <div class="audit-divergence-vals">
        <span class="audit-pred">predicted ${esc(pv)}</span>
        <span class="audit-arrow">→</span>
        <span class="audit-emp">empirical ${esc(ev)}${esc(sig)}</span>
      </div>
    </div>`;
}

function render() {
  const host = document.querySelector(TARGET);
  if (!host) return;
  if (!lastDelta) {
    host.innerHTML = '<p class="audit-empty">Load an empirical dataset to run an audit.</p>';
    return;
  }
  const d = lastDelta;
  const label = STATUS_LABEL[d.status] || d.status;
  const vd = d.visualization_directives || {};
  const ext = d.recommended_extension;
  const scope = d.scope_diagnosis;
  const prov = d.data_provenance_echo || {};

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
    <div class="audit-status audit-status--${esc(d.status)}">${esc(label)}</div>
    ${vd.annotation_text ? `<p class="audit-verdict">${esc(vd.annotation_text)}</p>` : ''}
    ${divergenceBlock(d.primary_divergence)}
    <div class="audit-flags">
      <span class="audit-flag ${d.topology_match ? 'is-yes' : 'is-no'}">topology ${d.topology_match ? '✓' : '✗'}</span>
      <span class="audit-flag ${d.numerical_match ? 'is-yes' : 'is-no'}">numerics ${d.numerical_match ? '✓' : '✗'}</span>
      ${d.confidence_score != null ? `<span class="audit-flag is-neutral">confidence ${(d.confidence_score * 100).toFixed(0)}%</span>` : ''}
    </div>
    ${extBlock}
    ${scopeBlock}
    <div class="audit-section audit-provenance">
      <span class="audit-section-label">data provenance</span>
      <div class="audit-prov-citation">${esc(prov.citation_text || '—')}</div>
      <div class="audit-prov-license">license: ${esc(prov.license || 'unknown')}</div>
    </div>`;
}

export function init() {
  if (initialized) return;
  bus.subscribe('AUDIT_DELTA', delta => { lastDelta = delta; render(); });
  bus.subscribe('THEME_CHANGED', () => render());
  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: ['audit_delta_display', 'provenance_echo_display'],
    subscribes_to: ['AUDIT_DELTA', 'THEME_CHANGED'],
    publishes: [],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 8
  });
  initialized = true;
  render();
  console.log(`[${MODULE_ID}] active`);
}

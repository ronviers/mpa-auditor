/**
 * DISPLAYER — provenance echo + declaration caveat
 *
 * The audit record is self-contained: it echoes the dataset's
 * attribution (contract 03 data_provenance_echo), its tier, and — the
 * §Q9 friction guard — the declaration trail, surfaced as a *visible
 * caveat*, not buried metadata. A user-tier audit rests on what the
 * researcher declared (substrate-class, validity ranges, column
 * mapping); Window 3 says so out loud, so the researcher feels the
 * weight of the declaration rather than routing around the prompt.
 *
 * Carried from the thin-slice audit-window.js provenance block; the tier
 * badge and the declaration caveat are the M8-proper additions.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc } from '../util.js';

export const id = 'provenance_echo_v1';
export const view_modes = ['default'];
export const mount_target = '#audit-provenance-echo';

let lastDelta = null;
let initialized = false;

const TIER_BADGE = {
  curated: { label: 'CURATED', cls: 'tier-curated' },
  user:    { label: 'USER · UNVALIDATED', cls: 'tier-user' },
  fixture: { label: 'FIXTURE', cls: 'tier-fixture' },
};

// Human phrasing for the declaration-trail fields the researcher set.
const FIELD_LABEL = {
  'provenance.citation_text': 'the citation',
  'provenance.license': 'the license',
  'provenance.doi': 'the DOI',
  'substrate_class': 'the substrate-class',
  'uncertainty_methodology': 'the uncertainty methodology',
};
function fieldPhrase(field) {
  if (FIELD_LABEL[field]) return FIELD_LABEL[field];
  if (field?.startsWith('column_map.')) return `the ${field.split('.')[1]} column mapping`;
  if (field?.startsWith('column:')) return `the ${field.split(':')[1]} validity range`;
  return field || 'a declaration';
}

function caveatBlock(delta) {
  const trail = Array.isArray(delta.declaration_trail) ? delta.declaration_trail : [];
  const declared = trail.filter(e => e.source === 'researcher_declared');
  if ((delta.tier || 'user') === 'fixture' || !declared.length) return '';
  const items = [...new Set(declared.map(e => fieldPhrase(e.field)))];
  return `
    <div class="audit-section audit-caveat">
      <span class="audit-section-label">this audit rests on your declarations</span>
      <div class="audit-caveat-text">The verdict assumes you correctly declared ${
        esc(items.join(', '))}. A downstream consumer can read the full declaration trail on this audit record.</div>
    </div>`;
}

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  if (!lastDelta) { host.innerHTML = ''; return; }
  const d = lastDelta;
  const prov = d.data_provenance_echo || {};
  const tier = d.tier || 'user';
  const badge = TIER_BADGE[tier] || TIER_BADGE.user;
  const authors = Array.isArray(prov.authors) && prov.authors.length ? prov.authors.join(', ') : '';

  host.innerHTML = `
    <div class="audit-section audit-provenance">
      <span class="audit-section-label">data provenance</span>
      <div class="audit-prov-tier"><span class="tier-badge ${badge.cls}">${esc(badge.label)}</span></div>
      <div class="audit-prov-citation">${esc(prov.citation_text || '—')}</div>
      ${authors ? `<div class="audit-prov-authors">${esc(authors)}</div>` : ''}
      <div class="audit-prov-license">license: ${esc(prov.license || 'unknown')}</div>
    </div>
    ${caveatBlock(d)}`;
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

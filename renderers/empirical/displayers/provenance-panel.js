/**
 * DISPLAYER — provenance panel
 *
 * Renders the mandatory attribution block (contract 05) plus the tier
 * badge. Attribution is load-bearing — never hidden, never optional: the
 * people who collected the data should be proud of how it appears here.
 *
 * Tier (foundational-answers.md §Q3+Q5) is fenced at the status level:
 * 'user' carries an "unvalidated baseline" caveat, 'fixture' a synthetic
 * marker, 'curated' a clean badge. The audit math is identical across
 * tiers — the badge is the fence, not a different audit.
 */

import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc } from '../util.js';

export const id = 'provenance_panel_v1';
export const view_modes = ['default'];
export const mount_target = '#empirical-provenance';

let lastData = null;
let initialized = false;

const TIER_BADGE = {
  curated: { label: 'CURATED', cls: 'tier-curated', note: '' },
  user:    { label: 'USER · UNVALIDATED', cls: 'tier-user', note: 'User-contributed — audited with full parity to curated data, but carries an unvalidated-baseline caveat through to exports.' },
  fixture: { label: 'FIXTURE', cls: 'tier-fixture', note: 'Synthetic test fixture — not for citation.' },
};

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  if (!lastData) {
    host.innerHTML = '<span class="provenance-empty">No dataset loaded — upload a CSV or load a fixture to begin.</span>';
    return;
  }
  const p = lastData.provenance || {};
  const tier = lastData.tier || 'user';
  const badge = TIER_BADGE[tier] || TIER_BADGE.user;
  const authors = Array.isArray(p.authors) && p.authors.length ? p.authors.join(', ') : '—';
  const doiRow = p.doi
    ? `<div class="provenance-row"><span class="provenance-key">DOI</span><span class="provenance-val">${esc(p.doi)}</span></div>` : '';
  const yearVenue = [p.publication_venue, p.publication_year].filter(Boolean).join(', ');
  const venueRow = yearVenue
    ? `<div class="provenance-row"><span class="provenance-key">published</span><span class="provenance-val">${esc(yearVenue)}</span></div>` : '';

  host.innerHTML = `
    <div class="provenance-tier-row">
      <span class="tier-badge ${badge.cls}">${esc(badge.label)}</span>
    </div>
    <div class="provenance-citation">${esc(p.citation_text || '—')}</div>
    <div class="provenance-row"><span class="provenance-key">authors</span><span class="provenance-val">${esc(authors)}</span></div>
    <div class="provenance-row"><span class="provenance-key">license</span><span class="provenance-val">${esc(p.license || 'unknown')}</span></div>
    ${doiRow}
    ${venueRow}
    <div class="provenance-row"><span class="provenance-key">substrate</span><span class="provenance-val">${esc(lastData.substrate_class || '—')}</span></div>
    ${badge.note ? `<div class="provenance-tier-note">${esc(badge.note)}</div>` : ''}`;
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_DATA_READY', d => { lastData = d; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', () => render());
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  render();
  console.log(`[${id}] active`);
}

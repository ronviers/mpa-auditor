/**
 * DISPLAYER — Synchroscope
 *
 * Circular phase-locking dial (cdv1 §Phase-locking). Reads the engine's
 * phase_locking block:
 *   - needle  → locked phase offset ψ (top = in-phase, bottom = anti-phase)
 *   - ring arc → Kuramoto order parameter r (collective coherence amplitude)
 *   - centre  → lock state
 * Drift (|K_AB| < Δω) shows a dashed ring and no fixed needle — the
 * synchroscope pointer "rotates" rather than settling.
 *
 * Pure rendering: reads state.phase_locking, emitted by both engines.
 * Theme-reactive — colours resolved via the util colors(theme) helper.
 */

import { subBus } from '../sub-conductor.js';
import { colors } from '../util.js';

export const id = 'synchroscope_v1';
export const view_modes = ['taxonomic'];
export const mount_target = '#synchroscope';

const TARGET = '#synchroscope';
const R = 38, CX = 50, CY = 50;          // dial geometry in a 100×100 viewBox
const CIRC = 2 * Math.PI * R;

let theme = null;
let lastPrediction = null;
let initialized = false;

function dialColor(pl, c) {
  if (!pl.locked) return c.muted;
  return pl.phase_relationship === 'in_phase' ? c.regime.c : c.regime.r;
}

function render() {
  if (!lastPrediction) return;
  const host = document.querySelector(TARGET);
  if (!host) return;
  const state = lastPrediction.continuous_state || lastPrediction.discrete_state || {};
  const pl = state.phase_locking;
  if (!pl) { host.innerHTML = '<div class="synchro-empty">no phase data</div>'; return; }
  const c = colors(theme);
  const accent = dialColor(pl, c);
  const r = Math.min(1, Math.max(0, pl.r));
  const dash = `${(r * CIRC).toFixed(2)} ${CIRC.toFixed(2)}`;

  // Needle: ψ measured from the top. x = cx + R sinψ, y = cy − R cosψ.
  let needle = '';
  if (pl.psi != null) {
    const nx = CX + (R - 6) * Math.sin(pl.psi);
    const ny = CY - (R - 6) * Math.cos(pl.psi);
    needle = `<line x1="${CX}" y1="${CY}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}"
      stroke="${accent}" stroke-width="2.4" stroke-linecap="round" />`;
  }
  const stateLabel = pl.locked
    ? (pl.phase_relationship === 'in_phase' ? 'IN-PHASE' : 'ANTI-PHASE')
    : 'DRIFT';
  const ringDash = pl.locked ? '' : 'stroke-dasharray="3 3"';

  host.innerHTML = `
    <svg class="synchro-dial" viewBox="0 0 100 100" role="img" aria-label="Phase-locking dial">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${c.border}" stroke-width="5" ${ringDash} />
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${accent}" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${CX} ${CY})" />
      ${needle}
      <circle cx="${CX}" cy="${CY}" r="3" fill="${accent}" />
      <text x="${CX}" y="${CY - 11}" class="synchro-r" text-anchor="middle" fill="${c.foreground}">r ${r.toFixed(2)}</text>
      <text x="${CX}" y="${CY + 17}" class="synchro-state" text-anchor="middle" fill="${accent}">${stateLabel}</text>
    </svg>
    <div class="synchro-readout">
      <span title="effective phase coupling K_AB">K ${pl.K_AB.toFixed(3)}</span>
      <span title="substrate-reference detuning Δω">Δω ${pl.delta_omega.toFixed(2)}</span>
    </div>`;
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED', t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}

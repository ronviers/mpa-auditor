/**
 * EMPIRICAL SUB-CONDUCTOR — scoped event bus + sub-registry
 *
 * Window-2-local mirror of core/conductor.js, and the M1
 * prediction/sub-conductor pattern applied to the Empirical pane. Sub-
 * displayers subscribe to *this* bus, never the main bus, for inbound
 * state. The sub-conductor is the single inbound seam: it subscribes to
 * DATA_READY (contract 05), DECLARATION_GAPS (internal, §Q9) and
 * THEME_CHANGED (contract 07) and republishes them as SUB_* events.
 *
 * Outbound is the documented exception: the upload-control and gap-prompt
 * displayers publish FILE_DROPPED / DECLARATION_PROVIDED to the *main* bus
 * directly — their consumer is the Data Engine, a top-level module. This
 * mirrors M1's regime-manifold publishing MANIFOLD_PICK to the main bus.
 *
 *   - subBus.publish(eventType, payload)
 *   - subBus.subscribe(eventType, handler)  -- returns unsubscribe fn
 *   - subBus.register(displayerInfo)        -- {displayer_id, view_modes, mount_target}
 *   - subBus.registry                       -- read-only view
 *   - subBus.log                            -- recorded event history
 */

import { bus as mainBus } from '../../core/conductor.js';

const target = new EventTarget();
const registry = new Map();
const log = [];
const REGISTRATION_REQUIRED = ['displayer_id', 'view_modes', 'mount_target'];

function validateRegistration(info) {
  const missing = REGISTRATION_REQUIRED.filter(k => !(k in info));
  if (missing.length > 0) {
    throw new Error(`[empiricalSubBus.register] missing required fields: ${missing.join(', ')}`);
  }
  if (!/^[a-z][a-z0-9_]*_v\d+$/.test(info.displayer_id)) {
    throw new Error(`[empiricalSubBus.register] displayer_id "${info.displayer_id}" violates snake_case_vN pattern`);
  }
  if (!Array.isArray(info.view_modes) || info.view_modes.length === 0) {
    throw new Error(`[empiricalSubBus.register] displayer "${info.displayer_id}" view_modes must be a non-empty array`);
  }
  if (typeof info.mount_target !== 'string' || !info.mount_target) {
    throw new Error(`[empiricalSubBus.register] displayer "${info.displayer_id}" mount_target must be a CSS selector string`);
  }
  if (registry.has(info.displayer_id)) {
    throw new Error(`[empiricalSubBus.register] duplicate displayer_id: ${info.displayer_id}`);
  }
}

export const subBus = {
  publish(eventType, payload) {
    log.push({ eventType, payload, timestamp: new Date().toISOString() });
    target.dispatchEvent(new CustomEvent(eventType, { detail: payload }));
  },

  subscribe(eventType, handler) {
    const wrapped = (e) => handler(e.detail);
    target.addEventListener(eventType, wrapped);
    return () => target.removeEventListener(eventType, wrapped);
  },

  register(displayerInfo) {
    validateRegistration(displayerInfo);
    const entry = Object.freeze({
      displayer_id: displayerInfo.displayer_id,
      view_modes: Object.freeze([...displayerInfo.view_modes]),
      mount_target: displayerInfo.mount_target
    });
    registry.set(entry.displayer_id, entry);
    console.log(`[empirical-sub-conductor] registered ${entry.displayer_id}`);
  },

  get registry() {
    return Object.freeze(Object.fromEntries(registry));
  },

  get log() {
    return log.slice();
  }
};

// Expose for console debugging — explicit, not a leak.
if (typeof window !== 'undefined') {
  window.empiricalSubBus = subBus;
}

export function init() {
  // Fan in main-bus events to the sub-bus. Displayers never touch the
  // main bus directly for inbound state.
  mainBus.subscribe('DATA_READY', payload => subBus.publish('SUB_DATA_READY', payload));
  mainBus.subscribe('DECLARATION_GAPS', payload => subBus.publish('SUB_DECLARATION_GAPS', payload));
  mainBus.subscribe('THEME_CHANGED', payload => subBus.publish('SUB_THEME_CHANGED', payload));
  console.log('[empirical-sub-conductor] ready');
}

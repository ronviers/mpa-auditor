/**
 * PREDICTION SUB-CONDUCTOR — scoped event bus + sub-registry
 *
 * Window-1-local mirror of core/conductor.js. Sub-displayers subscribe
 * to *this* bus, never the main bus. The sub-conductor itself is the
 * single seam to the main bus: it subscribes to PREDICTION_READY
 * (contract 02) and THEME_CHANGED (contract 07) and republishes them as
 * SUB_PREDICTION_READY / SUB_THEME_CHANGED.
 *
 * New events the sub-architecture introduces (SUB_VIEW_MODE_CHANGED, …)
 * live on this bus and never leak back to the main bus.
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
    throw new Error(`[subBus.register] missing required fields: ${missing.join(', ')}`);
  }
  if (!/^[a-z][a-z0-9_]*_v\d+$/.test(info.displayer_id)) {
    throw new Error(`[subBus.register] displayer_id "${info.displayer_id}" violates snake_case_vN pattern`);
  }
  if (!Array.isArray(info.view_modes) || info.view_modes.length === 0) {
    throw new Error(`[subBus.register] displayer "${info.displayer_id}" view_modes must be a non-empty array`);
  }
  if (typeof info.mount_target !== 'string' || !info.mount_target) {
    throw new Error(`[subBus.register] displayer "${info.displayer_id}" mount_target must be a CSS selector string`);
  }
  if (registry.has(info.displayer_id)) {
    throw new Error(`[subBus.register] duplicate displayer_id: ${info.displayer_id}`);
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
    console.log(`[prediction-sub-conductor] registered ${entry.displayer_id}`);
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
  window.predictionSubBus = subBus;
}

export function init() {
  // Fan in main-bus events to the sub-bus. Displayers never touch the
  // main bus directly for inbound state.
  mainBus.subscribe('PREDICTION_READY', payload => subBus.publish('SUB_PREDICTION_READY', payload));
  mainBus.subscribe('THEME_CHANGED', payload => subBus.publish('SUB_THEME_CHANGED', payload));
  console.log('[prediction-sub-conductor] ready');
}

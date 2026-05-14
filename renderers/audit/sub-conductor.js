/**
 * AUDIT SUB-CONDUCTOR — scoped event bus + sub-registry
 *
 * Window-3-local mirror of core/conductor.js, the M1
 * prediction/sub-conductor pattern applied to the Audit pane. Sub-
 * displayers subscribe to *this* bus. The sub-conductor is the single
 * inbound seam: it subscribes to AUDIT_DELTA (contract 03) and
 * THEME_CHANGED (contract 07) and republishes them as SUB_* events.
 *
 * Window 3 has no outbound events — the Audit pane is a pure display.
 *
 *   - subBus.publish(eventType, payload)
 *   - subBus.subscribe(eventType, handler)  -- returns unsubscribe fn
 *   - subBus.register(displayerInfo)        -- {displayer_id, view_modes, mount_target}
 *   - subBus.registry / subBus.log
 */

import { bus as mainBus } from '../../core/conductor.js';

const target = new EventTarget();
const registry = new Map();
const log = [];
const REGISTRATION_REQUIRED = ['displayer_id', 'view_modes', 'mount_target'];

function validateRegistration(info) {
  const missing = REGISTRATION_REQUIRED.filter(k => !(k in info));
  if (missing.length > 0) {
    throw new Error(`[auditSubBus.register] missing required fields: ${missing.join(', ')}`);
  }
  if (!/^[a-z][a-z0-9_]*_v\d+$/.test(info.displayer_id)) {
    throw new Error(`[auditSubBus.register] displayer_id "${info.displayer_id}" violates snake_case_vN pattern`);
  }
  if (!Array.isArray(info.view_modes) || info.view_modes.length === 0) {
    throw new Error(`[auditSubBus.register] displayer "${info.displayer_id}" view_modes must be a non-empty array`);
  }
  if (typeof info.mount_target !== 'string' || !info.mount_target) {
    throw new Error(`[auditSubBus.register] displayer "${info.displayer_id}" mount_target must be a CSS selector string`);
  }
  if (registry.has(info.displayer_id)) {
    throw new Error(`[auditSubBus.register] duplicate displayer_id: ${info.displayer_id}`);
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
    console.log(`[audit-sub-conductor] registered ${entry.displayer_id}`);
  },

  get registry() {
    return Object.freeze(Object.fromEntries(registry));
  },

  get log() {
    return log.slice();
  }
};

if (typeof window !== 'undefined') {
  window.auditSubBus = subBus;
}

export function init() {
  mainBus.subscribe('AUDIT_DELTA', payload => subBus.publish('SUB_AUDIT_DELTA', payload));
  mainBus.subscribe('THEME_CHANGED', payload => subBus.publish('SUB_THEME_CHANGED', payload));
  console.log('[audit-sub-conductor] ready');
}

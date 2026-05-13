/**
 * CONDUCTOR — Event Bus + Module Registry
 *
 * The hub of hub-and-spoke. Every cross-module communication routes through
 * the bus. Modules never call each other directly.
 *
 * Implements:
 *   - bus.publish(eventType, payload)    -- fires a CustomEvent
 *   - bus.subscribe(eventType, handler)  -- returns an unsubscribe fn
 *   - bus.register(registration)         -- validates against contract 04
 *   - bus.registry                       -- read-only view of registered modules
 *   - bus.log                            -- recorded event history (replay/debug)
 *
 * Forbidden:
 *   - No imports from engines/* or renderers/*
 *   - No DOM access beyond publishing/subscribing
 *   - No business logic — pure routing
 */

const target = new EventTarget();
const registry = new Map();
const log = [];
const REGISTRATION_REQUIRED = [
  'module_id', 'module_type', 'version', 'capabilities', 'subscribes_to', 'publishes'
];

function validateRegistration(reg) {
  const missing = REGISTRATION_REQUIRED.filter(k => !(k in reg));
  if (missing.length > 0) {
    throw new Error(`[bus.register] missing required fields: ${missing.join(', ')}`);
  }
  if (!/^[a-z][a-z0-9_]*_v\d+$/.test(reg.module_id)) {
    throw new Error(`[bus.register] module_id "${reg.module_id}" violates contract 04 pattern`);
  }
  if (registry.has(reg.module_id)) {
    throw new Error(`[bus.register] duplicate module_id: ${reg.module_id}`);
  }
}

export const bus = {
  publish(eventType, payload) {
    const record = { eventType, payload, timestamp: new Date().toISOString() };
    log.push(record);
    target.dispatchEvent(new CustomEvent(eventType, { detail: payload }));
  },

  subscribe(eventType, handler) {
    const wrapped = (e) => handler(e.detail);
    target.addEventListener(eventType, wrapped);
    return () => target.removeEventListener(eventType, wrapped);
  },

  register(registration) {
    validateRegistration(registration);
    registry.set(registration.module_id, Object.freeze({ ...registration }));
    console.log(`[bus] registered ${registration.module_id} (${registration.status || 'active'})`);
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
  window.bus = bus;
}

export function init() {
  console.log('[bus] ready');
  bus.publish('BUS_READY', { timestamp: new Date().toISOString() });
}

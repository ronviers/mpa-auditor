/**
 * AUDIT SUB-LAYOUT-MANAGER — composition
 *
 * Window-3 mirror of M1's prediction/sub-layout-manager. The Audit pane
 * has no view-mode switcher, so this is the trivial case: every displayer
 * registers with view_modes ['default'] and is always visible. The file
 * exists for structural parity — a future Audit view mode (e.g. a
 * verdict-only vs full-detail toggle) drops in here without touching the
 * displayers.
 */

import { subBus } from './sub-conductor.js';

let initialized = false;

function applyVisibility() {
  Object.values(subBus.registry).forEach(d => {
    const mount = document.querySelector(d.mount_target);
    if (!mount) return;
    mount.style.display = d.view_modes.includes('default') ? '' : 'none';
  });
}

export function init() {
  if (initialized) return;
  applyVisibility();
  initialized = true;
  console.log('[audit-sub-layout-manager] ready');
}

/**
 * EMPIRICAL SUB-LAYOUT-MANAGER — composition
 *
 * Window-2 mirror of M1's prediction/sub-layout-manager. The Empirical
 * pane has no view-mode switcher (Taxonomic / Kinematic / Topological are
 * Window-1 concepts), so this is the trivial case: every displayer
 * registers with view_modes ['default'] and is always visible. The file
 * exists for structural parity — a future Empirical view mode (e.g. a
 * raw-rows vs derived-locus toggle) drops in here without touching the
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
  console.log('[empirical-sub-layout-manager] ready');
}

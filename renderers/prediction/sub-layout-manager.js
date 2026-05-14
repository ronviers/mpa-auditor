/**
 * PREDICTION SUB-LAYOUT-MANAGER — view-mode state + composition
 *
 * Owns the Window-1 view mode (Taxonomic / Kinematic / Topological).
 * Listens for clicks on the view-mode switcher, publishes
 * SUB_VIEW_MODE_CHANGED on the sub-bus, and toggles `display: none` on
 * the mount targets of displayers not registered for the active view.
 *
 * M1: only `taxonomic` is enabled. The kinematic/topological switcher
 * buttons are rendered-but-disabled (their displayers land in M3/M5),
 * so switching never actually fires yet — the wiring is in place for
 * those sessions.
 */

import { subBus } from './sub-conductor.js';

const VIEW_MODES = ['taxonomic', 'kinematic', 'topological'];
let currentView = 'taxonomic';
let initialized = false;

function applyVisibility() {
  Object.values(subBus.registry).forEach(d => {
    const mount = document.querySelector(d.mount_target);
    if (!mount) return;
    mount.style.display = d.view_modes.includes(currentView) ? '' : 'none';
  });
}

function setView(view) {
  if (!VIEW_MODES.includes(view) || view === currentView) return;
  currentView = view;
  document.querySelectorAll('.view-mode-switcher .view-mode').forEach(btn => {
    const active = btn.dataset.view === currentView;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
  applyVisibility();
  subBus.publish('SUB_VIEW_MODE_CHANGED', { view: currentView });
}

function wireSwitcher() {
  const buttons = document.querySelectorAll('.view-mode-switcher .view-mode');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      setView(btn.dataset.view);
    });
  });
}

export function init() {
  if (initialized) return;
  wireSwitcher();
  applyVisibility();
  subBus.publish('SUB_VIEW_MODE_CHANGED', { view: currentView });
  initialized = true;
  console.log('[prediction-sub-layout-manager] ready');
}

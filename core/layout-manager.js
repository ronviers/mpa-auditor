/**
 * LAYOUT MANAGER
 *
 * Wires the static UI to the event bus. Owns DOM event handlers for:
 *   - tab clicks            -> publishes SELECTION_CHANGED (contract 08)
 *   - slider input          -> publishes STATE_REQUEST     (contract 01)
 *   - mode toggle           -> publishes STATE_REQUEST     (contract 01)
 *   - theme toggle          -> calls style-manager.setTheme()
 *
 * The Empirical pane's upload zone is NOT wired here. M7 proper moved it
 * into the empirical sub-architecture (`renderers/empirical/displayers/
 * upload-control.js`) — that displayer owns the CSV drop zone, the
 * declaration form and the fixture selector, and publishes FILE_DROPPED
 * directly. The Layout Manager no longer publishes FILE_DROPPED.
 *
 * Forbidden:
 *   - No engine or renderer imports
 *   - No math, no rendering
 *   - No hardcoded colors/fonts/sizes (use CSS variables)
 */

import { bus } from './conductor.js';
import { setTheme, getTheme } from './style-manager.js';

const FRAMEWORK_VERSION = 'v9.1';
let currentMode = 'continuous';
let currentChit = 0;
let currentGamma = -0.3;

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function buildStateRequest({ mode, parameters }) {
  // Contract 01 — StateRequest
  return {
    request_id: uuid(),
    timestamp: new Date().toISOString(),
    mode,
    framework_version: FRAMEWORK_VERSION,
    parameters
  };
}

function wireTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      // Contract 08 — SelectionChanged (placeholder; full tab content swap lands in Session 4+)
      bus.publish('SELECTION_CHANGED', {
        selection_id: uuid(),
        timestamp: new Date().toISOString(),
        source_module: 'layout_manager_v1',
        selection_type: 'substrate',
        selected_substrate: { substrate_id: tab.dataset.tab, substrate_class: 'tab_view', parameters: {} }
      });
    });
  });
}

function publishCurrentState() {
  bus.publish('STATE_REQUEST', buildStateRequest({
    mode: currentMode,
    parameters: { chit: currentChit, gamma_AB: currentGamma }
  }));
}

function wireGammaSlider() {
  const slider = document.querySelector('#gamma-slider');
  const readout = document.querySelector('#gamma-readout');
  if (!slider) return;
  let pending = null;
  slider.addEventListener('input', () => {
    currentGamma = Number(slider.value);
    if (readout) readout.textContent = currentGamma.toFixed(2);
    if (pending !== null) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      publishCurrentState();
    });
  });
}

function wireFitSync() {
  // When the Inversion Engine emits a fitted STATE_REQUEST, move the
  // sliders to the fitted operating point so the Predicted pane's
  // self-adaptation is visible in the controls too. DOM + internal
  // state only — never re-publishes (that would loop the bus). The
  // engine's own (unfitted) requests carry no fit_provenance and are
  // ignored here.
  bus.subscribe('STATE_REQUEST', payload => {
    const fit = payload?.parameters?.fit_provenance;
    if (!fit) return;
    const chit = Number(payload.parameters?.chit);
    if (Number.isFinite(chit)) {
      currentChit = Math.max(-2, Math.min(2, chit));
      const s = document.querySelector('#chit-slider');
      const r = document.querySelector('#chit-readout');
      if (s) s.value = String(currentChit);
      if (r) r.textContent = currentChit.toFixed(2);
    }
    const gamma = Number(payload.parameters?.gamma_AB);
    if (Number.isFinite(gamma)) {
      currentGamma = Math.max(-1, Math.min(1, gamma));
      const s = document.querySelector('#gamma-slider');
      const r = document.querySelector('#gamma-readout');
      if (s) s.value = String(currentGamma);
      if (r) r.textContent = currentGamma.toFixed(2);
    }
  });
}

function wireManifoldPick() {
  bus.subscribe('MANIFOLD_PICK', ({ chit, gamma_AB }) => {
    if (typeof chit === 'number') {
      currentChit = Math.max(-2, Math.min(2, chit));
      const s = document.querySelector('#chit-slider');
      const r = document.querySelector('#chit-readout');
      if (s) s.value = String(currentChit);
      if (r) r.textContent = currentChit.toFixed(2);
    }
    if (typeof gamma_AB === 'number') {
      currentGamma = Math.max(-1, Math.min(1, gamma_AB));
      const s = document.querySelector('#gamma-slider');
      const r = document.querySelector('#gamma-readout');
      if (s) s.value = String(currentGamma);
      if (r) r.textContent = currentGamma.toFixed(2);
    }
    publishCurrentState();
  });
}

function wireSlider() {
  const slider = document.querySelector('#chit-slider');
  const readout = document.querySelector('#chit-readout');
  if (!slider) return;
  // Coalesce rapid slider events to one publish per animation frame.
  let pending = null;
  slider.addEventListener('input', () => {
    currentChit = Number(slider.value);
    if (readout) readout.textContent = currentChit.toFixed(2);
    if (pending !== null) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      publishCurrentState();
    });
  });
}

function setActiveSegment(segments, predicate) {
  segments.forEach(seg => {
    const active = predicate(seg);
    seg.classList.toggle('is-active', active);
    seg.setAttribute('aria-checked', String(active));
  });
}

function wireModeSegments() {
  const segments = document.querySelectorAll('[data-mode-value]');
  segments.forEach(seg => {
    seg.addEventListener('click', () => {
      const newMode = seg.dataset.modeValue;
      if (newMode === currentMode) return;
      currentMode = newMode;
      setActiveSegment(segments, s => s.dataset.modeValue === currentMode);
      publishCurrentState();
    });
  });
}

function wireThemeSegments() {
  const segments = document.querySelectorAll('[data-theme-value]');
  segments.forEach(seg => {
    seg.addEventListener('click', () => {
      const next = seg.dataset.themeValue;
      if (next === getTheme()) return;
      setTheme(next);
      setActiveSegment(segments, s => s.dataset.themeValue === next);
    });
  });
}

function wireSettingsDropdown() {
  const trigger = document.querySelector('#settings-toggle');
  const menu = document.querySelector('#settings-menu');
  if (!trigger || !menu) return;

  const close = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden ? open() : close();
  });

  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (!menu.contains(e.target) && e.target !== trigger) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      close();
      trigger.focus();
    }
  });

  menu.addEventListener('click', (e) => e.stopPropagation());
}

export function init() {
  wireTabs();
  wireSlider();
  wireGammaSlider();
  wireSettingsDropdown();
  wireModeSegments();
  wireThemeSegments();
  wireManifoldPick();
  wireFitSync();
  bus.register({
    module_id: 'layout_manager_v1',
    module_type: 'core',
    version: '0.4.0',
    capabilities: ['ui_wiring', 'event_publishing', 'initial_state_seed', 'fit_slider_sync'],
    subscribes_to: ['MANIFOLD_PICK', 'STATE_REQUEST'],
    publishes: ['STATE_REQUEST', 'SELECTION_CHANGED'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 1
  });
  console.log('[layout_manager_v1] UI wired');
}

// Called by the shell script after all engines + renderers have
// initialized (and therefore subscribed). Paints Window 1 before the
// user touches anything.
export function fireInitialState() {
  publishCurrentState();
}

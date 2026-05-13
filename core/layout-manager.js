/**
 * LAYOUT MANAGER
 *
 * Wires the static UI to the event bus. Owns DOM event handlers for:
 *   - tab clicks            -> publishes SELECTION_CHANGED (contract 08)
 *   - slider input          -> publishes STATE_REQUEST     (contract 01)
 *   - mode toggle           -> publishes STATE_REQUEST     (contract 01)
 *   - theme toggle          -> calls style-manager.setTheme()
 *   - upload zone hover     -> CSS state only (drop wiring lands in Session 5)
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

function wireSlider() {
  const slider = document.querySelector('#chit-slider');
  const readout = document.querySelector('#chit-readout');
  if (!slider) return;
  slider.addEventListener('input', () => {
    currentChit = Number(slider.value);
    if (readout) readout.textContent = currentChit.toFixed(2);
    bus.publish('STATE_REQUEST', buildStateRequest({
      mode: currentMode,
      parameters: { chit: currentChit }
    }));
  });
}

function wireModeToggle() {
  const toggle = document.querySelector('#mode-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    currentMode = currentMode === 'continuous' ? 'discrete' : 'continuous';
    toggle.dataset.mode = currentMode;
    toggle.textContent = currentMode === 'continuous' ? 'Continuous' : 'Discrete';
    bus.publish('STATE_REQUEST', buildStateRequest({
      mode: currentMode,
      parameters: { chit: currentChit }
    }));
  });
}

function wireThemeToggle() {
  const toggle = document.querySelector('#theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    toggle.textContent = next === 'dark' ? 'Dark' : 'Light';
  });
}

function wireUploadZone() {
  const zone = document.querySelector('#upload-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-hover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-hover');
    console.log('[layout_manager_v1] drop received — Data Engine arrives in Session 5');
  });
}

export function init() {
  wireTabs();
  wireSlider();
  wireModeToggle();
  wireThemeToggle();
  wireUploadZone();
  bus.register({
    module_id: 'layout_manager_v1',
    module_type: 'core',
    version: '0.1.0',
    capabilities: ['ui_wiring', 'event_publishing'],
    subscribes_to: [],
    publishes: ['STATE_REQUEST', 'SELECTION_CHANGED'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 1
  });
  console.log('[layout_manager_v1] UI wired');
}

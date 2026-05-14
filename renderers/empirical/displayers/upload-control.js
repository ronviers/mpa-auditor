/**
 * DISPLAYER — upload control
 *
 * Owns the Empirical pane's ingress: a fixture selector, a CSV drop
 * zone / file picker, and a thin declaration form. This is the producer
 * seam to the main bus — it publishes FILE_DROPPED directly (its consumer,
 * the Data Engine, is a top-level module; mirrors M1's regime-manifold →
 * MANIFOLD_PICK).
 *
 * The declaration form is deliberately thin (next-session-handoff §4
 * "watch": a typed form, not a wizard). The researcher declares what they
 * know up front — citation, license, substrate-class, the (τ, C, χ)
 * column mapping — which pre-empts most gaps; whatever is still missing
 * surfaces through the gap-prompt displayer after parse.
 *
 * Scoping (§11): the auditor is pure-static. No LLM auto-fills this form;
 * the researcher declares, and the declaration is theirs.
 */

import { bus as mainBus } from '../../../core/conductor.js';
import { subBus } from '../sub-conductor.js';
import { escapeHTML as esc } from '../util.js';

export const id = 'upload_control_v1';
export const view_modes = ['default'];
export const mount_target = '#empirical-upload';

let initialized = false;
let pickedFile = null;     // { filename, text, fields }

// Best-guess a CSV header to one of the canonical roles, so the column
// selects land pre-filled and the researcher only corrects.
function guessRole(field) {
  const f = String(field).toLowerCase();
  if (/^(tau|t|delay|delay_?time|lag)$/.test(f)) return 'tau';
  if (/^(c|corr|correlation|c_?tau|autocorr)$/.test(f)) return 'C';
  if (/^(chi|x|response|susceptibility|chi_?tau)$/.test(f)) return 'chi';
  return null;
}

function fieldOptions(fields, selected) {
  return ['<option value="">— none —</option>']
    .concat(fields.map(f =>
      `<option value="${esc(f)}"${f === selected ? ' selected' : ''}>${esc(f)}</option>`))
    .join('');
}

function formHTML() {
  const fields = pickedFile.fields;
  const guess = { tau: '', C: '', chi: '' };
  fields.forEach(f => { const r = guessRole(f); if (r && !guess[r]) guess[r] = f; });
  return `
    <div class="declaration-form-head">
      <span class="declaration-form-file">${esc(pickedFile.filename)}</span>
      <span class="declaration-form-fields">${fields.length} columns</span>
    </div>
    <label class="decl-field">
      <span class="decl-label">citation <span class="decl-req">required</span></span>
      <input type="text" class="decl-input" data-decl="citation_text" placeholder="e.g. Acharya et al., Nature 614, 676 (2023)" />
    </label>
    <label class="decl-field">
      <span class="decl-label">license <span class="decl-req">required</span></span>
      <input type="text" class="decl-input" data-decl="license" value="unknown" />
    </label>
    <label class="decl-field">
      <span class="decl-label">authors</span>
      <input type="text" class="decl-input" data-decl="authors" placeholder="comma-separated" />
    </label>
    <label class="decl-field">
      <span class="decl-label">DOI</span>
      <input type="text" class="decl-input" data-decl="doi" placeholder="optional" />
    </label>
    <label class="decl-field">
      <span class="decl-label">substrate class</span>
      <input type="text" class="decl-input" data-decl="substrate_class" value="unclassified" />
    </label>
    <div class="decl-colmap">
      <span class="decl-label">column mapping — the gFDR (τ, C, χ) triple</span>
      <div class="decl-colmap-row">
        <label>τ <select class="decl-colsel" data-role="tau">${fieldOptions(fields, guess.tau)}</select></label>
        <label>C <select class="decl-colsel" data-role="C">${fieldOptions(fields, guess.C)}</select></label>
        <label>χ <select class="decl-colsel" data-role="chi">${fieldOptions(fields, guess.chi)}</select></label>
      </div>
    </div>
    <label class="decl-field">
      <span class="decl-label">τ units</span>
      <input type="text" class="decl-input" data-decl="tau_units" value="seconds" />
    </label>
    <button type="button" class="btn decl-submit" id="decl-submit">Load &amp; audit</button>`;
}

function render() {
  const host = document.querySelector(mount_target);
  if (!host) return;
  host.innerHTML = `
    <div class="upload-fixture-row">
      <select id="fixture-select" class="fixture-select" aria-label="Synthetic fixture">
        <option value="default">fixture · renderer-exercising (→ topological_miss)</option>
        <option value="consistent">fixture · framework-consistent (→ match)</option>
      </select>
      <button type="button" class="btn" id="fixture-load">Load fixture</button>
    </div>
    <div id="csv-drop-zone" class="upload-zone" role="button" tabindex="0" aria-label="Upload a CSV dataset">
      Drop a CSV or click to pick<br/>
      <small>real empirical data — parsed with PapaParse</small>
    </div>
    <input type="file" id="csv-file-input" accept=".csv,text/csv" hidden />
    <div id="declaration-form" class="declaration-form" hidden></div>`;
  wire();
}

function showForm() {
  const form = document.querySelector('#declaration-form');
  if (!form || !pickedFile) return;
  form.innerHTML = formHTML();
  form.hidden = false;
  form.querySelector('#decl-submit')?.addEventListener('click', submitDeclaration);
}

function submitDeclaration() {
  const form = document.querySelector('#declaration-form');
  if (!form || !pickedFile) return;
  const declInputs = {};
  form.querySelectorAll('.decl-input').forEach(el => {
    const v = el.value.trim();
    if (v) declInputs[el.dataset.decl] = v;
  });
  const column_map = {};
  form.querySelectorAll('.decl-colsel').forEach(sel => {
    if (sel.value) column_map[sel.dataset.role] = sel.value;
  });

  const declarations = {
    provenance: {
      citation_text: declInputs.citation_text || '',
      license: declInputs.license || '',
      authors: declInputs.authors || '',
      doi: declInputs.doi || null,
    },
    substrate_class: declInputs.substrate_class || 'unclassified',
    tau_units: declInputs.tau_units || 'seconds',
    column_map,
  };

  mainBus.publish('FILE_DROPPED', {
    source: 'csv',
    filename: pickedFile.filename,
    text: pickedFile.text,
    declarations,
    timestamp: new Date().toISOString(),
  });
  console.log(`[${id}] FILE_DROPPED — csv "${pickedFile.filename}"`);
}

function ingestFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    let fields = [];
    if (window.Papa) {
      const head = window.Papa.parse(text, { header: true, preview: 1, skipEmptyLines: true });
      fields = head.meta?.fields || [];
    }
    if (!fields.length) {
      console.warn(`[${id}] could not read a header row from "${file.name}"`);
      return;
    }
    pickedFile = { filename: file.name, text, fields };
    showForm();
  };
  reader.readAsText(file);
}

function wire() {
  const zone = document.querySelector('#csv-drop-zone');
  const input = document.querySelector('#csv-file-input');
  const fixtureLoad = document.querySelector('#fixture-load');
  const fixtureSelect = document.querySelector('#fixture-select');

  fixtureLoad?.addEventListener('click', () => {
    mainBus.publish('FILE_DROPPED', {
      source: 'mock_fixture',
      fixture: fixtureSelect?.value || 'default',
      timestamp: new Date().toISOString(),
    });
  });

  zone?.addEventListener('click', () => input?.click());
  zone?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input?.click(); }
  });
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-hover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('is-hover'));
  zone?.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-hover');
    ingestFile(e.dataTransfer?.files?.[0]);
  });
  input?.addEventListener('change', () => ingestFile(input.files?.[0]));
}

export function init() {
  if (initialized) return;
  subBus.subscribe('SUB_THEME_CHANGED', () => { /* upload control is theme-agnostic (CSS vars) */ });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  render();
  initialized = true;
  console.log(`[${id}] active`);
}

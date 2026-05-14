/**
 * AUDIT STORE — (DataUpload, AuditDelta) persistence (M8 proper)
 *
 * The basic write M-Corpus builds on. Every AUDIT_DELTA is paired with
 * the DataUpload it was computed against (by data_id) and written to an
 * IndexedDB object store as a self-contained record:
 *
 *   { audit_id, data_id, timestamp, tier, status, data, audit }
 *
 * This is *persistence*, not the corpus engine — no aggregation, no
 * class statistics, no manifest. M-Corpus (a later session) reads this
 * store and adds the typed structure on top (foundational-answers.md §Q6).
 * Pure-static (§11): IndexedDB is local browser storage, no network.
 *
 * Exposes `window.auditStore` for console inspection — `list()` and
 * `clear()` — explicit, not a leak.
 *
 * Subscribes to: DATA_READY (contract 05), AUDIT_DELTA (contract 03)
 * Publishes:     ERROR_REPORT (contract 06)
 */

import { bus } from '../core/conductor.js';

const MODULE_ID = 'audit_store_v1';
const MODULE_VERSION = '0.1.0';
const DB_NAME = 'mpa-auditor';
const DB_VERSION = 1;
const STORE = 'audit_records';

let dbPromise = null;
// Latest DataUpload by upload_id — an AUDIT_DELTA references its data by
// data_id, so the store pairs them the same way the Audit Engine does.
const dataById = new Map();

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function reportError(error_code, message) {
  bus.publish('ERROR_REPORT', {
    error_id: uuid(),
    module_id: MODULE_ID,
    timestamp: new Date().toISOString(),
    severity: 'warning',
    error_code,
    message,
    graceful_fallback: { render_directive: 'render_last_valid_state', user_facing_text: 'Audit could not be saved to local storage — the audit itself is unaffected.' },
    user_actionable: false
  });
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable in this browser context')); return; }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'audit_id' });
        os.createIndex('data_id', 'data_id', { unique: false });
        os.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

async function putRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
  });
}

async function persist(audit) {
  const data = dataById.get(audit.data_id);
  if (!data) {
    // A hand-dialed prediction audited against no upload — nothing to
    // pair. Not an error; just nothing to persist.
    return;
  }
  const record = {
    audit_id: audit.audit_id,
    data_id: audit.data_id,
    timestamp: audit.timestamp,
    tier: audit.tier || data.tier || 'user',
    status: audit.status,
    data,
    audit,
  };
  try {
    await putRecord(record);
    console.log(`[${MODULE_ID}] persisted audit ${audit.audit_id.slice(0, 8)} (${audit.status}, tier=${record.tier})`);
  } catch (err) {
    reportError('audit_persist_failed', `could not persist audit ${audit.audit_id}: ${err.message}`);
  }
}

// Console-facing read surface. M-Corpus replaces this with a typed query
// layer; for now it is enough to confirm the write path works.
async function list() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.map(r => ({
      audit_id: r.audit_id, data_id: r.data_id, status: r.status, tier: r.tier, timestamp: r.timestamp
    })));
    req.onerror = () => reject(req.error);
  });
}

async function clear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function init() {
  bus.register({
    module_id: MODULE_ID,
    module_type: 'engine',
    version: MODULE_VERSION,
    capabilities: ['audit_persistence', 'indexeddb_store'],
    subscribes_to: ['DATA_READY', 'AUDIT_DELTA'],
    publishes: ['ERROR_REPORT'],
    computational_profile: 'light',
    status: 'active',
    session_implemented_in: 8
  });
  bus.subscribe('DATA_READY', d => { if (d?.upload_id) dataById.set(d.upload_id, d); });
  bus.subscribe('AUDIT_DELTA', a => { if (a?.audit_id) persist(a); });

  if (typeof window !== 'undefined') {
    window.auditStore = { list, clear };
  }
  // Warm the connection so the first write does not pay the open cost.
  openDB().catch(err => console.warn(`[${MODULE_ID}] IndexedDB unavailable — audits will not persist:`, err.message));
  console.log(`[${MODULE_ID}] active (audit persistence)`);
}

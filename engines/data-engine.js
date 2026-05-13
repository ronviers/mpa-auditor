/**
 * DATA ENGINE
 * Ingests CSV (PapaParse), validates schema, normalizes units, hashes
 * the original file for reproducibility, surfaces provenance for Window 2.
 *
 * STATUS: Stub. Implemented in Session 5.
 *
 * Subscribes to: FILE_DROPPED (internal), STATE_REQUEST (contract 01)
 * Publishes:     DATA_READY (contract 05), ERROR_REPORT (contract 06)
 *
 * Forbidden when implemented:
 *   - No renderer or engine imports
 *   - Never modifies the original file
 *   - Every preprocessing step appended to DataUpload.preprocessing_log
 *   - Provenance is MANDATORY (license must be set; never null)
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'data_engine_v1',
    module_type: 'data_source',
    version: '0.0.1-stub',
    capabilities: ['csv_ingestion', 'schema_validation', 'provenance_handling', 'sha256_hashing'],
    subscribes_to: ['FILE_DROPPED', 'STATE_REQUEST'],
    publishes: ['DATA_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    requires_libraries: ['papaparse'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[data_engine_v1] stub loaded');
}

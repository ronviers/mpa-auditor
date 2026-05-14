/**
 * EMPIRICAL WINDOW — Window 2 boot shim
 *
 * Window 2's contents were carved into a sub-architecture under
 * `renderers/empirical/` (M7 proper, mirroring M1's
 * `renderers/prediction/`):
 *
 *   - sub-conductor       — scoped event bus; fans DATA_READY /
 *                           DECLARATION_GAPS / THEME_CHANGED in from the
 *                           main bus.
 *   - sub-layout-manager  — composition (no view modes — Window-2 has one).
 *   - displayers/*        — upload-control, gap-prompt, provenance-panel,
 *                           data-summary, empirical-locus.
 *
 * This file now only boots that sub-architecture and keeps the renderer's
 * top-level registration so `window.bus.registry` is unchanged.
 *
 * Inbound (via the sub-conductor): DATA_READY (contract 05),
 *   DECLARATION_GAPS (internal), THEME_CHANGED (contract 07).
 * Outbound (displayers → main bus directly): FILE_DROPPED,
 *   DECLARATION_PROVIDED.
 */

import { bus } from '../core/conductor.js';

import { init as initSubConductor } from './empirical/sub-conductor.js';
import { init as initSubLayout }    from './empirical/sub-layout-manager.js';
import * as UploadControl   from './empirical/displayers/upload-control.js';
import * as GapPrompt       from './empirical/displayers/gap-prompt.js';
import * as ProvenancePanel from './empirical/displayers/provenance-panel.js';
import * as DataSummary     from './empirical/displayers/data-summary.js';
import * as EmpiricalLocus  from './empirical/displayers/empirical-locus.js';

const MODULE_ID = 'empirical_window_v1';
const MODULE_VERSION = '0.2.0';

const DISPLAYERS = [UploadControl, GapPrompt, ProvenancePanel, DataSummary, EmpiricalLocus];

export function init() {
  // Sub-conductor first (it subscribes to the main bus), then every
  // displayer (they register on the sub-bus), then the sub-layout-manager
  // (it reads that registry to apply composition).
  initSubConductor();
  DISPLAYERS.forEach(d => d.init());
  initSubLayout();

  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: [
      'csv_upload_control', 'declaration_form', 'fixture_selector',
      'declaration_gap_prompt', 'provenance_display', 'tier_badge',
      'column_metadata_display', 'empirical_locus_plot'
    ],
    subscribes_to: ['DATA_READY', 'DECLARATION_GAPS', 'THEME_CHANGED'],
    publishes: ['FILE_DROPPED', 'DECLARATION_PROVIDED'],
    computational_profile: 'light',
    requires_libraries: ['plotly', 'papaparse'],
    status: 'active',
    session_implemented_in: 7
  });
  console.log(`[${MODULE_ID}] active (empirical sub-architecture booted)`);
}

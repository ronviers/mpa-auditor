/**
 * AUDIT WINDOW — Window 3 boot shim
 *
 * Window 3's contents were carved into a sub-architecture under
 * `renderers/audit/` (M8 proper, mirroring M1's `renderers/prediction/`
 * and M7's `renderers/empirical/`):
 *
 *   - sub-conductor       — scoped event bus; fans AUDIT_DELTA /
 *                           THEME_CHANGED in from the main bus.
 *   - sub-layout-manager  — composition (no view modes — Window 3 has one).
 *   - displayers/*        — verdict-panel, spark-gap, divergence-panel,
 *                           provenance-echo.
 *
 * This file now only boots that sub-architecture and keeps the renderer's
 * top-level registration so `window.bus.registry` is unchanged.
 *
 * Inbound (via the sub-conductor): AUDIT_DELTA (contract 03),
 *   THEME_CHANGED (contract 07). Window 3 has no outbound events.
 */

import { bus } from '../core/conductor.js';

import { init as initSubConductor } from './audit/sub-conductor.js';
import { init as initSubLayout }    from './audit/sub-layout-manager.js';
import * as VerdictPanel    from './audit/displayers/verdict-panel.js';
import * as SparkGap        from './audit/displayers/spark-gap.js';
import * as DivergencePanel from './audit/displayers/divergence-panel.js';
import * as ProvenanceEcho  from './audit/displayers/provenance-echo.js';

const MODULE_ID = 'audit_window_v1';
const MODULE_VERSION = '0.2.0';

const DISPLAYERS = [VerdictPanel, SparkGap, DivergencePanel, ProvenanceEcho];

export function init() {
  // Sub-conductor first (it subscribes to the main bus), then every
  // displayer (they register on the sub-bus), then the sub-layout-manager.
  initSubConductor();
  DISPLAYERS.forEach(d => d.init());
  initSubLayout();

  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: [
      'audit_verdict_display', 'slot_aware_reading', 'spark_gap_visualization',
      'divergence_display', 'audit_domain_display', 'provenance_echo_display',
      'tier_badge', 'declaration_caveat'
    ],
    subscribes_to: ['AUDIT_DELTA', 'THEME_CHANGED'],
    publishes: [],
    computational_profile: 'light',
    requires_libraries: ['plotly'],
    status: 'active',
    session_implemented_in: 8
  });
  console.log(`[${MODULE_ID}] active (audit sub-architecture booted)`);
}

/**
 * PLOTLY 2D RENDERER — Prediction-pane boot shim
 *
 * Window 1's contents were carved out of this file (M1 refactor) into a
 * sub-architecture under `renderers/prediction/`:
 *
 *   - sub-conductor       — scoped event bus; fans PREDICTION_READY /
 *                           THEME_CHANGED in from the main bus.
 *   - sub-layout-manager  — view-mode state + visibility composition.
 *   - displayers/*        — seven independently-developable panels.
 *
 * This file now only boots that sub-architecture and keeps the renderer's
 * top-level registration so `window.bus.registry` is unchanged.
 *
 * Subscribes to: PREDICTION_READY (contract 02), THEME_CHANGED (contract 07)
 *                — via the sub-conductor, not here directly.
 * Publishes:     MANIFOLD_PICK (internal) — from the regime-manifold displayer.
 */

import { bus } from '../core/conductor.js';

import { init as initSubConductor } from './prediction/sub-conductor.js';
import { init as initSubLayout }    from './prediction/sub-layout-manager.js';
import * as MetaStrip       from './prediction/displayers/meta-strip.js';
import * as TrajectoryStrip from './prediction/displayers/trajectory-strip.js';
import * as RegimeManifold  from './prediction/displayers/regime-manifold.js';
import * as GfdrSignature   from './prediction/displayers/gfdr-signature.js';
import * as InvariantsPanel from './prediction/displayers/invariants-panel.js';
import * as PatternsPanel   from './prediction/displayers/patterns-panel.js';
import * as PositsStrip     from './prediction/displayers/posits-strip.js';
import * as CobhamStack     from './prediction/displayers/cobham-stack.js';
import * as Synchroscope    from './prediction/displayers/synchroscope.js';

const MODULE_ID = 'plotly_2d_renderer_v1';
const MODULE_VERSION = '0.5.0';

const DISPLAYERS = [MetaStrip, TrajectoryStrip, RegimeManifold, GfdrSignature, InvariantsPanel, PatternsPanel, PositsStrip, CobhamStack, Synchroscope];

export function init() {
  // Sub-conductor first (it subscribes to the main bus), then every
  // displayer (they register on the sub-bus), then the sub-layout-manager
  // (it reads that registry to apply view-mode visibility).
  initSubConductor();
  DISPLAYERS.forEach(d => d.init());
  initSubLayout();

  bus.register({
    module_id: MODULE_ID,
    module_type: 'renderer',
    version: MODULE_VERSION,
    capabilities: [
      'regime_manifold', 'bifurcation_overlays', 'k_frust_hatching',
      'out_of_scope_hatching', 'operating_point_crosshair',
      'manifold_click_navigation', 'gfdr_plot', 'trajectory_strip',
      'invariants_panel', 'pattern_admissibility', 'posits_strip',
      'regime_badge', 'equation_display'
    ],
    subscribes_to: ['PREDICTION_READY', 'THEME_CHANGED'],
    publishes: ['MANIFOLD_PICK', 'SELECTION_CHANGED'],
    computational_profile: 'light',
    requires_libraries: ['plotly', 'katex'],
    status: 'active',
    session_implemented_in: 4
  });
  console.log(`[${MODULE_ID}] active (prediction sub-architecture booted)`);
}

/**
 * PLOTLY 2D RENDERER
 * Draws the gFDR canvas in Window 1, the recovery profile, power spectra.
 * Workhorse 2D chart layer.
 *
 * STATUS: Stub. Implemented in Session 4 — first session that paints pixels.
 *
 * Subscribes to: PREDICTION_READY (contract 02), THEME_CHANGED (contract 07)
 * Publishes:     SELECTION_CHANGED (contract 08, on plot hover/click)
 *
 * Forbidden when implemented:
 *   - No math (read PredictedLocus, render)
 *   - No engine imports
 *   - No hardcoded colors (everything from theme tokens via Style Manager)
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'plotly_2d_renderer_v1',
    module_type: 'renderer',
    version: '0.0.1-stub',
    capabilities: ['gfdr_plot', 'recovery_plot', 'power_spectrum'],
    subscribes_to: ['PREDICTION_READY', 'THEME_CHANGED'],
    publishes: ['SELECTION_CHANGED'],
    computational_profile: 'light',
    requires_libraries: ['plotly'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[plotly_2d_renderer_v1] stub loaded');
}

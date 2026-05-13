/**
 * OBSERVABLE SUBSTRATE MAP RENDERER
 * 2D substrate-map (irregular topology in regime space) using Observable
 * Plot. Drives the "Substrate Map" tab.
 *
 * STATUS: Stub. Implemented in Session 9.
 *
 * Subscribes to: PREDICTION_READY (contract 02), DATA_READY (contract 05),
 *                THEME_CHANGED (contract 07)
 * Publishes:     SELECTION_CHANGED (contract 08, on substrate click)
 *
 * Forbidden when implemented:
 *   - No math; consume PredictedLocus + DataUpload
 *   - No hardcoded colors
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'observable_substrate_renderer_v1',
    module_type: 'renderer',
    version: '0.0.1-stub',
    capabilities: ['substrate_map_2d', 'substrate_class_clustering'],
    subscribes_to: ['PREDICTION_READY', 'DATA_READY', 'THEME_CHANGED'],
    publishes: ['SELECTION_CHANGED'],
    computational_profile: 'light',
    requires_libraries: ['observable-plot'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[observable_substrate_renderer_v1] stub loaded');
}

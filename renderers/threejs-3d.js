/**
 * THREE.JS 3D RENDERER
 * Lyapunov basin surface with topological tears (k_frust regions display
 * as holes, never smooth-extrapolated), spray particles, EffectComposer
 * post-processing.
 *
 * STATUS: Stub. Implemented in Session 7.
 *
 * Subscribes to: PREDICTION_READY (contract 02 with basin_surface),
 *                SELECTION_CHANGED (contract 08, camera_state sync),
 *                THEME_CHANGED (contract 07)
 * Publishes:     SELECTION_CHANGED (contract 08, on camera move / region pick)
 *
 * Forbidden when implemented:
 *   - No math (read basin_surface from PredictedLocus, render)
 *   - Tears (null z-values) MUST display as holes, not interpolated
 *   - No hardcoded colors
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'threejs_3d_renderer_v1',
    module_type: 'renderer',
    version: '0.0.1-stub',
    capabilities: ['basin_surface_3d', 'spray_particles', 'tear_visualization'],
    subscribes_to: ['PREDICTION_READY', 'SELECTION_CHANGED', 'THEME_CHANGED'],
    publishes: ['SELECTION_CHANGED'],
    computational_profile: 'heavy',
    requires_libraries: ['three', 'three/examples/postprocessing'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[threejs_3d_renderer_v1] stub loaded');
}

/**
 * CYTOSCAPE OPERATOR GRAPH RENDERER
 * Renders the discrete operator graph (C/S/K/R nodes, signed edges
 * gamma_AB, highlighted k_frust subgraphs). Synced to Window 1 in
 * discrete mode.
 *
 * STATUS: Stub. Implemented in Session 8.
 *
 * Subscribes to: PREDICTION_READY (contract 02 with discrete_state),
 *                SELECTION_CHANGED (contract 08), THEME_CHANGED (contract 07)
 * Publishes:     SELECTION_CHANGED (contract 08, on node/edge click)
 *
 * Forbidden when implemented:
 *   - No math; consume operator_graph from PredictedLocus
 *   - k_frust subgraphs must be visually distinct (per theme.json)
 *   - No hardcoded colors
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'cytoscape_renderer_v1',
    module_type: 'renderer',
    version: '0.0.1-stub',
    capabilities: ['operator_graph', 'k_frust_highlighting', 'graph_interaction'],
    subscribes_to: ['PREDICTION_READY', 'SELECTION_CHANGED', 'THEME_CHANGED'],
    publishes: ['SELECTION_CHANGED'],
    computational_profile: 'medium',
    requires_libraries: ['cytoscape'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[cytoscape_renderer_v1] stub loaded');
}

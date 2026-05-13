/**
 * SOLVER SERVICE
 *
 * Singleton loader for the vendored mpa-solver WASM module. Lazy-loaded
 * on first call; subsequent calls are fast (the module is cached).
 *
 * Public surface:
 *   - whenReady() -> Promise<void>          resolves once the WASM is loaded
 *   - isReady()   -> boolean                synchronous check
 *   - integrate(initial, params, tMax, dt, sampleEvery?) -> {t, rho_A, rho_B}
 *   - ensemble(initial, params, tMax, dt, N, sampleEvery?) -> Trajectory[]
 *   - version()   -> string
 *   - getLastSolveMs() -> number            wall-clock cost of last integrate()
 *
 * The engines wrap this. The renderers do not touch it directly.
 *
 * Forbidden:
 *   - No DOM access
 *   - No event-bus imports (this is a pure compute service)
 */

// URLs anchored to the document base so they resolve from the page root
// regardless of which module ends up importing this service.
const baseURI = typeof document !== 'undefined' ? document.baseURI : 'about:blank';
const WASM_URL = new URL('./vendor/mpa-solver/mpa_solver.js', baseURI).href;
const WRAPPER_URL = new URL('./vendor/mpa-solver/wrapper.js', baseURI).href;

let solverPromise = null;
let solver = null;
let lastSolveMs = 0;

async function load() {
  const { loadMpaSolver } = await import(WRAPPER_URL);
  solver = await loadMpaSolver(WASM_URL);
  console.log(`[solver-service] mpa-solver loaded · version ${solver.version()}`);
  return solver;
}

export function whenReady() {
  if (!solverPromise) solverPromise = load();
  return solverPromise;
}

export function isReady() {
  return solver !== null;
}

export function version() {
  return solver?.version() ?? 'not-loaded';
}

export function getLastSolveMs() {
  return lastSolveMs;
}

export async function integrate(initial, params, tMax, dt, sampleEvery = 1) {
  if (!solver) await whenReady();
  const t0 = performance.now();
  const traj = solver.integrate(initial, params, tMax, dt, sampleEvery);
  lastSolveMs = performance.now() - t0;
  return traj;
}

export async function ensemble(initial, params, tMax, dt, N, sampleEvery = 1) {
  if (!solver) await whenReady();
  const t0 = performance.now();
  const result = solver.ensemble(initial, params, tMax, dt, N, sampleEvery);
  lastSolveMs = performance.now() - t0;
  return result;
}

// Kick off the load early — engines that call integrate() will await it,
// but the load happens in parallel with the rest of init().
whenReady().catch(err => {
  console.error('[solver-service] WASM load failed:', err);
});

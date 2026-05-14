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
let loadState = 'loading';  // 'loading' | 'ready' | 'error'
let loadError = null;

async function diagnoseFailure(err) {
  // Best-effort: probe the .wasm file and report HTTP status + MIME so
  // the user doesn't have to dig through the Network tab.
  const wasmUrl = WASM_URL.replace(/mpa_solver\.js$/, 'mpa_solver.wasm');
  console.error('[solver-service] WASM load failed:', err);
  console.error(`[solver-service]   wrapper URL: ${WRAPPER_URL}`);
  console.error(`[solver-service]   module URL:  ${WASM_URL}`);
  console.error(`[solver-service]   wasm URL:    ${wasmUrl}`);
  try {
    const head = await fetch(wasmUrl, { method: 'HEAD' });
    const ct = head.headers.get('content-type') || '(missing)';
    console.error(`[solver-service]   wasm HEAD: status=${head.status}, content-type=${ct}`);
    if (head.status === 404) {
      console.error('[solver-service]   HINT: vendor/mpa-solver/mpa_solver.wasm not found. Pull latest from main or re-vendor the WASM build.');
    } else if (!ct.includes('application/wasm')) {
      console.error('[solver-service]   HINT: Content-Type is not application/wasm. Browsers refuse streaming WebAssembly compilation. Python http.server < 3.7 has this bug — run `python --version`; upgrade or use `npx serve .` instead.');
    }
  } catch (probeErr) {
    console.error('[solver-service]   could not probe the .wasm URL (server may be down):', probeErr);
    console.error('[solver-service]   HINT: confirm `python -m http.server 8000` is running in H:\\mpa-auditor and you opened http://localhost:8000 (not file://).');
  }
}

async function load() {
  try {
    const { loadMpaSolver } = await import(WRAPPER_URL);
    solver = await loadMpaSolver(WASM_URL);
    loadState = 'ready';
    console.log(`[solver-service] mpa-solver loaded · version ${solver.version()}`);
    return solver;
  } catch (err) {
    loadState = 'error';
    loadError = err;
    await diagnoseFailure(err);
    throw err;
  }
}

export function whenReady() {
  if (!solverPromise) solverPromise = load();
  return solverPromise;
}

export function isReady() {
  return solver !== null;
}

export function getLoadState() {
  return loadState;
}

export function getLoadError() {
  return loadError;
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

/* ---------- v2 additions ---------- */

// Numerical linearization at a given state: returns
// { eigenvalues: [{re, im}, ...], zeta, omega_RO, gamma_RO, Q }.
// Per the v2 CLAUDE.md convention: Q is 0 at unstable points (real part of
// dominant eigenvalue ≥ 0). The framework's analytical Q formula is for
// laser-physics fixed-point structures; the symmetric cooperative Lamb
// coexistence point is a saddle and Q reads as 0 there.
export async function linearize(state, params) {
  if (!solver) await whenReady();
  return solver.linearize(state, params);
}

// N-mode kernel integration. State: { rho: [...], bath?: number }.
// Params: { G0: [...], L: [...], gamma: [[...], [...]], ... }.
export async function integrateN(state, params, tMax, dt, sampleEvery = 1) {
  if (!solver) await whenReady();
  const t0 = performance.now();
  const traj = solver.integrateN(state, params, tMax, dt, sampleEvery);
  lastSolveMs = performance.now() - t0;
  return traj;
}

export async function ensembleN(state, params, tMax, dt, N, sampleEvery = 1) {
  if (!solver) await whenReady();
  const t0 = performance.now();
  const result = solver.ensembleN(state, params, tMax, dt, N, sampleEvery);
  lastSolveMs = performance.now() - t0;
  return result;
}

// gFDR observables module (ensemble-derived). Not yet wired into the
// auditor's slider-scrub loop — too slow per-tick (200-trajectory
// ensemble + response ≈ 2s). A debounced async wiring lands in a
// follow-up session; these accessors are here so the API surface is
// complete and consumers can experiment from the console.
export const observables = {
  async correlator(ensemble, equilibration, nTau) {
    if (!solver) await whenReady();
    return solver.observables.correlator(ensemble, equilibration, nTau);
  },
  async responseDirect(initial, params, tMax, dt, equilibration, nTau, N, pert = 1e-3) {
    if (!solver) await whenReady();
    return solver.observables.responseDirect(initial, params, tMax, dt, equilibration, nTau, N, pert);
  },
  async gfdrLocus(correlator, response) {
    if (!solver) await whenReady();
    return solver.observables.gfdrLocus(correlator, response);
  },
  async fitInvariants(locus) {
    if (!solver) await whenReady();
    return solver.observables.fitInvariants(locus);
  }
};

// Expose to window for console experimentation (parallels window.bus).
if (typeof window !== 'undefined') {
  window.solver = {
    whenReady, isReady, version,
    integrate, ensemble, linearize, integrateN, ensembleN, observables,
    getLastSolveMs, getLoadState, getLoadError
  };
}

// Kick off the load early — engines that call integrate() will await it,
// but the load happens in parallel with the rest of init().
whenReady().catch(err => {
  console.error('[solver-service] WASM load failed:', err);
});

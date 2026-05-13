// bindings/wasm/wrapper.js
//
// Idiomatic JS API around the embind WASM module. The module is built with
// MODULARIZE=1 and EXPORT_ES6=1 and exposes the factory `createMpaSolverModule`.
//
// Usage:
//   import { loadMpaSolver } from './wrapper.js';
//   const solver = await loadMpaSolver('./mpa_solver.js');
//   const traj = solver.integrate(
//     { rho_A: 0.5, rho_B: 0.5 },
//     { G0_A: 1.2, G0_B: 1.0, L_A: 1.0, L_B: 1.0, gamma_AB: -0.3,
//       rho_sat: 1.0, D_noise: 0.0, closure: solver.Closure.Lamb, seed: 0 },
//     /* t_max */ 50.0, /* dt */ 0.01, /* sample_every */ 1
//   );
//   // traj.t, traj.rho_A, traj.rho_B are Float64Array.

export async function loadMpaSolver(moduleUrl) {
  const factory = (await import(moduleUrl)).default;
  const Module = await factory();
  return {
    Closure: Module.Closure,
    version: () => Module.version(),
    integrate(initial, params, tMax, dt, sampleEvery = 1) {
      const p = { ...params };
      if (p.closure === undefined) p.closure = Module.Closure.Lamb;
      if (p.seed === undefined) p.seed = 0;
      return Module.integrate(initial, p, tMax, dt, sampleEvery);
    },
    ensemble(initial, params, tMax, dt, N, sampleEvery = 1) {
      const p = { ...params };
      if (p.closure === undefined) p.closure = Module.Closure.Lamb;
      if (p.seed === undefined) p.seed = 0;
      return Module.ensemble(initial, p, tMax, dt, N, sampleEvery);
    },
    raw: Module,
  };
}

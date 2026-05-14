// bindings/wasm/wrapper.js
//
// Idiomatic JS API around the embind WASM module. The module is built with
// MODULARIZE=1 and EXPORT_ES6=1 and exposes the factory `createMpaSolverModule`.
//
// v0 surface:
//   solver.integrate(state, params, tMax, dt, sampleEvery?)
//   solver.ensemble(state, params, tMax, dt, N, sampleEvery?)
//   solver.version()
//
// v2 surface:
//   solver.integrateN(nstate, nparams, tMax, dt, sampleEvery?)
//   solver.ensembleN(nstate, nparams, tMax, dt, N, sampleEvery?)
//   solver.observables.correlator(ensemble, equilibration, nTau)
//   solver.observables.responseDirect(state, params, tMax, dt, equilibration, nTau, N, pert?)
//   solver.observables.gfdrLocus(correlator, response)
//   solver.observables.fitInvariants(locus)
//   solver.linearize(state, params)
//
// N-mode parameter shape:
//   { G0:[...], L:[...], gamma:[[...],[...]], rho_sat:[...] (optional),
//     D_noise, closure: "Lamb"|"DynamicBath"|"Caputo",
//     sde_scheme: "Milstein"|"EulerMaruyama", seed,
//     gamma_B, B_inf, kappa:[...], beta_mem, tau_c, caputo_K }
//
// N-mode state shape:
//   { rho: [...], bath: number (optional) }

export async function loadMpaSolver(moduleUrl) {
  const factory = (await import(moduleUrl)).default;
  const Module = await factory();

  const defaultV0 = (p) => {
    const q = { ...p };
    if (q.closure === undefined) q.closure = Module.Closure.Lamb;
    if (q.sde_scheme === undefined) q.sde_scheme = Module.SDEScheme.Milstein;
    if (q.seed === undefined) q.seed = 0;
    if (q.gamma_BA === undefined) q.gamma_BA = 0;
    if (q.reciprocal === undefined) q.reciprocal = true;
    if (q.rho_sat === undefined) q.rho_sat = 1.0;
    if (q.gamma_B === undefined) q.gamma_B = 10.0;
    if (q.B_inf === undefined) q.B_inf = 1.0;
    if (q.beta_mem === undefined) q.beta_mem = 1.0;
    if (q.tau_c === undefined) q.tau_c = 1.0;
    return q;
  };

  const defaultN = (p) => {
    const q = { ...p };
    if (q.closure === undefined) q.closure = "Lamb";
    if (q.sde_scheme === undefined) q.sde_scheme = "Milstein";
    if (q.seed === undefined) q.seed = 0;
    if (q.D_noise === undefined) q.D_noise = 0;
    if (q.rho_sat === undefined) q.rho_sat = [1.0];
    if (q.gamma_B === undefined) q.gamma_B = 10.0;
    if (q.B_inf === undefined) q.B_inf = 1.0;
    if (q.kappa === undefined) q.kappa = (q.G0 ?? []).map(() => 0.1);
    if (q.beta_mem === undefined) q.beta_mem = 1.0;
    if (q.tau_c === undefined) q.tau_c = 1.0;
    if (q.caputo_K === undefined) q.caputo_K = 8;
    return q;
  };

  return {
    Closure: Module.Closure,
    SDEScheme: Module.SDEScheme,
    version: () => Module.version(),

    integrate(initial, params, tMax, dt, sampleEvery = 1) {
      return Module.integrate(initial, defaultV0(params), tMax, dt, sampleEvery);
    },
    ensemble(initial, params, tMax, dt, N, sampleEvery = 1) {
      return Module.ensemble(initial, defaultV0(params), tMax, dt, N, sampleEvery);
    },

    integrateN(state, params, tMax, dt, sampleEvery = 1) {
      const ns = { rho: state.rho, bath: state.bath ?? 1.0 };
      return Module.integrate_n(ns, defaultN(params), tMax, dt, sampleEvery);
    },
    ensembleN(state, params, tMax, dt, N, sampleEvery = 1) {
      const ns = { rho: state.rho, bath: state.bath ?? 1.0 };
      return Module.ensemble_n(ns, defaultN(params), tMax, dt, N, sampleEvery);
    },

    observables: {
      correlator(ensemble, equilibration, nTau) {
        return Module.correlator(ensemble, equilibration, nTau);
      },
      responseDirect(initial, params, tMax, dt, equilibration, nTau, N, pert = 1e-3) {
        return Module.response_direct(initial, defaultV0(params), tMax, dt,
                                      equilibration, nTau, N, pert);
      },
      gfdrLocus(correlator, response) {
        return Module.gfdr_locus(correlator, response);
      },
      fitInvariants(locus) {
        return Module.fit_invariants(locus);
      },
    },

    linearize(state, params) {
      return Module.linearize(state, defaultV0(params));
    },

    raw: Module,
  };
}

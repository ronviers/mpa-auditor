# vendor/mpa-solver

WASM artifacts vendored from [`github.com/ronviers/mpa-solver`](https://github.com/ronviers/mpa-solver). **Currently at v2.0.0.**

| File | Size | Purpose |
|---|---|---|
| `mpa_solver.js` | 34 KB | Emscripten glue (MODULARIZE + EXPORT_ES6) |
| `mpa_solver.wasm` | 85 KB | The compiled C++ kernel (N-mode, three closures, observables, linearization) |
| `wrapper.js` | 4 KB | Idiomatic JS API: `loadMpaSolver(url) → {integrate, ensemble, integrateN, ensembleN, observables, linearize, version, Closure, SDEScheme}` |

## What it does

Integrates the cdv1 universal kernel under three closures (**Lamb**, **DynamicBath**, **Caputo** fractional memory via sum-of-exponentials), supports **N-mode** kernels and **non-reciprocal** coupling, integrates via **RK4** (deterministic) or **Euler–Maruyama / Milstein** (stochastic), and exposes **gFDR observables** (`C(τ)`, `χ(τ)`, locus, fitted `X_c/X_r/α_s/P_s/N_f`) plus **numerical linearization** (`ω_RO`, `γ_RO`, `ζ`, `Q`). All returns are `Float64Array` / nested arrays — no embind cleanup required by the consumer. Bit-reproducible from `seed`; OpenMP-parallel ensembles preserve per-seed bit-identity.

## v2 math caveats (per upstream `CLAUDE.md`)

1. `Caputo` at `β_mem = 1.0` dispatches to `Lamb` exactly (framework convention; falsifier passes byte-for-byte).
2. `DynamicBath` fast-bath limit is **structural** (B(t) → algebraic quasi-equilibrium), not byte-identical to Lamb. Single-bath math doesn't reduce to Lamb's `Σ_{j≠i}` saturation; per-mode baths would close this and are flagged for v3.
3. `linearize().Q = 0` at unstable points (real part of dominant eigenvalue ≥ 0); the cdv1 analytical `Q = √(2L(e^chit − 1)/γ_s)` is laser-physics-specific and doesn't apply to the symmetric cooperative Lamb kernel directly.

## Refresh

```
gh repo clone ronviers/mpa-solver /tmp/mpa-solver
cd /tmp/mpa-solver
mkdir build-wasm && cd build-wasm
emcmake cmake .. -DMPA_SOLVER_BUILD_WASM=ON -DCMAKE_BUILD_TYPE=Release
emmake make
cp bindings/wasm/{mpa_solver.js,mpa_solver.wasm,wrapper.js} H:/mpa-auditor/vendor/mpa-solver/
```

## Do not edit these files in place

If math needs to change, change it upstream in `mpa-solver`, rebuild, and replace these artifacts. The whole reason for a separate solver repo is to keep the kernel source-of-truth in one place.

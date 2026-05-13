# vendor/mpa-solver

WASM artifacts vendored from [`github.com/ronviers/mpa-solver`](https://github.com/ronviers/mpa-solver).

| File | Size | Purpose |
|---|---|---|
| `mpa_solver.js` | 34 KB | Emscripten glue (MODULARIZE + EXPORT_ES6) |
| `mpa_solver.wasm` | 31 KB | The compiled C++ kernel |
| `wrapper.js` | 1.4 KB | Idiomatic JS API: `loadMpaSolver(url) → {integrate, ensemble, version, Closure}` |

## What it does

Integrates the cdv1 universal two-mode kernel (§"Universal two-mode kernel") under the Lamb stationary closure, returns `{t, rho_A, rho_B}` as `Float64Array`. RK4 deterministic when `D_noise = 0`; Euler–Maruyama stochastic otherwise. Bit-reproducible from `seed`.

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

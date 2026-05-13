# mpa-solver — build handoff (v0)

**You are a fresh Claude Code session.** You do not need prior context; this brief contains everything required to build the v0 deliverable. The repo does not yet exist. You will create it.

---

## 1. Purpose

`mpa-solver` is a small, tight C++ library that integrates the **universal two-mode kernel** defined in cdv1 §"Universal two-mode kernel" and emits trajectory time-series for downstream visualization and analysis. It does math, nothing else.

It exists because the existing `mpa-*` repos do *not* contain a general solver — `mpa-engine` and `mpa-relaxation` are finding-centric, substrate-specific. `mpa-auditor` currently fakes trajectories with analytical templates; that will be replaced once this library lands. `mpa-relaxation` will eventually consume the same kernel through Python bindings so per-substrate experiments stop rewriting the math from scratch.

**Audience for the artifact:** browser code (via WASM) and Python (via pybind11 — v0.1, not v0). Both need the same numerical kernel under the same function signatures.

**Status of source-of-truth math:** the framework lives in [`mpa-atlas/framework/cdv1_compressed.md`](https://github.com/ronviers/mpa-atlas/blob/main/framework/cdv1_compressed.md). Section references in this brief use that file. Do not re-derive the framework — implement the equations as written, with the closures the framework declares.

## 2. Scope discipline

**v0 ships:**

1. RK4 integrator for the two-mode kernel (deterministic).
2. Euler–Maruyama integrator for the stochastic form.
3. **Lamb stationary closure** for `𝒟[ρ_A, ρ_B; γ_AB]`.
4. Deterministic seeded RNG (`std::mt19937_64`) for reproducibility.
5. Single trajectory integration AND ensemble integration (loop over seeds).
6. WASM build artifacts (`mpa_solver.wasm` + `mpa_solver.js` glue) — these are what `mpa-auditor` will consume.
7. Analytical-limit tests (see §6).
8. CMake build, no third-party numerical dependencies.

**v0 explicitly defers:**

- Dynamic-bath closure (adds one ODE; cdv1 doesn't pin the exact form, leaves it substrate-conditional — push to v0.1).
- Caputo fractional memory (Mittag-Leffler kernel; requires careful special-function implementation — push to v0.2).
- RK45 adaptive stepping (RK4 fixed-step is sufficient for the 2-mode use case).
- Python bindings (v0.1).
- Derived observables `C(τ)`, `χ(τ)`, gFDR locus (compute these in the consumer for v0; promote to library if/when shared).
- Operator-graph or k_frust topology — that's downstream of trajectories, not in this library.
- Non-reciprocal coupling `γ_AB ≠ γ_BA` (extension axis per v9 §Extension axes; v0 keeps symmetric kernel).

If you find yourself reaching for any deferred item, stop — it belongs in a later version, not v0. The discipline is *minimum useful kernel that the auditor can drop in*.

**Out of scope forever:**

- Any I/O of structured formats (CSV, JSON files). Caller handles serialization.
- Any networking, threading beyond OpenMP for the ensemble loop (optional), GUI, plotting.
- Any opinion about parameters (no validation beyond NaN/Inf guards; caller is responsible).
- Any logging beyond a single configurable error-reporting callback.

## 3. The math

### 3.1 Universal two-mode kernel

Per cdv1 §"Universal two-mode kernel":

```
∂ρ_A/∂t = (G₀_A − L_A)·ρ_A − γ_AB·ρ_A·ρ_B + 𝒟[ρ_A, ρ_B; γ_AB]
∂ρ_B/∂t = (G₀_B − L_B)·ρ_B − γ_BA·ρ_A·ρ_B + 𝒟[ρ_B, ρ_A; γ_AB]
```

For v0, `γ_BA = γ_AB` (symmetric kernel). The sign convention is load-bearing: **γ_AB < 0 contributes positively to ∂_t ρ_A** (cooperative); γ_AB > 0 contributes negatively (competitive).

### 3.2 Lamb stationary closure (v0)

```
G₀_A^eff = G₀_A / (1 + ρ_B / ρ_sat)
G₀_B^eff = G₀_B / (1 + ρ_A / ρ_sat)
𝒟[ρ_A, ρ_B; γ_AB] ≡ 0  (Lamb absorbs the bath into the gain renormalisation)
```

So under Lamb closure the kernel reduces to:

```
∂ρ_A/∂t = (G₀_A^eff − L_A)·ρ_A − γ_AB·ρ_A·ρ_B
∂ρ_B/∂t = (G₀_B^eff − L_B)·ρ_B − γ_AB·ρ_A·ρ_B
```

This is what v0 integrates.

### 3.3 Stochastic form (Langevin)

For NESS character analysis the framework requires fluctuating trajectories. v0 supports additive white-noise forcing:

```
dρ_A = drift_A(ρ_A, ρ_B)·dt + σ_A·dW_A
dρ_B = drift_B(ρ_A, ρ_B)·dt + σ_B·dW_B
```

where `drift_A`/`drift_B` are the Lamb-closure right-hand sides above and `dW_A, dW_B` are independent Wiener increments (`√dt · N(0,1)`). For v0, `σ_A = σ_B = √(2·D_noise)` with `D_noise` a single user-facing knob.

Integrate with **Euler–Maruyama**:

```
ρ_A(t+dt) = ρ_A(t) + drift_A·dt + σ_A · √dt · ξ_A
ρ_B(t+dt) = ρ_B(t) + drift_B·dt + σ_B · √dt · ξ_B
```

with `ξ_A, ξ_B ~ N(0,1)`. Use Box-Muller from two `std::uniform_real_distribution` draws on `std::mt19937_64`.

**Positivity guard:** if `ρ` would go negative due to a large noise step, clamp to a small positive floor (`ρ_min = 1e-12`). The framework forbids `ρ < 0` (it's an occupation density).

### 3.4 Two solver modes selected by `D_noise`

- `D_noise == 0.0` → deterministic RK4. Reproducibility is exact across seeds.
- `D_noise > 0.0` → Euler–Maruyama. Reproducibility is exact for a fixed seed.

## 4. API surface

Header-only-friendly C++17 (do NOT make it header-only by default — use a single static library target). All public types in `namespace mpa::solver`.

### 4.1 Types

```cpp
// include/mpa_solver/types.hpp
#pragma once
#include <cstdint>
#include <vector>

namespace mpa::solver {

enum class Closure { Lamb };  // v0.1 adds DynamicBath; v0.2 adds Caputo

struct Parameters {
  double G0_A      = 1.0;
  double G0_B      = 1.0;
  double L_A       = 1.0;
  double L_B       = 1.0;
  double gamma_AB  = -0.3;   // < 0 cooperative, > 0 competitive
  double rho_sat   = 1.0;    // Lamb saturation
  double D_noise   = 0.0;    // 0 = deterministic
  Closure closure  = Closure::Lamb;
  std::uint64_t seed = 0;    // for stochastic runs; ignored when D_noise == 0
};

struct State {
  double rho_A = 0.5;
  double rho_B = 0.5;
};

struct Trajectory {
  std::vector<double> t;
  std::vector<double> rho_A;
  std::vector<double> rho_B;
};

}  // namespace mpa::solver
```

### 4.2 Public functions

```cpp
// include/mpa_solver/integrate.hpp
#pragma once
#include "types.hpp"

namespace mpa::solver {

// Integrate one trajectory. dt is the fixed integration step.
// Returns trajectory sampled every `sample_every` steps (default 1 = every step).
Trajectory integrate(State initial,
                     Parameters params,
                     double t_max,
                     double dt,
                     std::size_t sample_every = 1);

// Integrate N trajectories with seeds {seed, seed+1, ..., seed+N-1}.
// For deterministic runs (D_noise == 0), all trajectories are identical;
// caller should not request ensemble > 1 in that case.
std::vector<Trajectory> ensemble(State initial,
                                 Parameters params,
                                 double t_max,
                                 double dt,
                                 std::size_t N,
                                 std::size_t sample_every = 1);

}  // namespace mpa::solver
```

That is the entire v0 public API. Three structs, two functions. The auditor will call `integrate()` on slider events and `ensemble()` for FDR-signature averaging.

### 4.3 NaN/Inf handling

If any step produces non-finite values, terminate the trajectory at the previous valid step and return what you have. Do not throw. The caller checks `traj.t.size() < expected_samples` to detect early termination.

### 4.4 No globals

The library has no internal mutable state. Two consecutive calls with identical arguments produce bit-identical output. The RNG state lives in a local `std::mt19937_64` instance constructed from `params.seed` inside each call.

## 5. Build

### 5.1 CMake

```
mpa-solver/
├── CMakeLists.txt          // top-level
├── include/mpa_solver/
│   ├── types.hpp
│   ├── integrate.hpp
│   ├── kernel.hpp          // internal — Lamb drift functions
│   ├── stochastics.hpp     // internal — Box-Muller, EM step
│   └── version.hpp
├── src/
│   ├── kernel.cpp
│   ├── integrate_rk4.cpp
│   ├── integrate_em.cpp
│   ├── ensemble.cpp
│   └── version.cpp
├── tests/
│   ├── CMakeLists.txt
│   ├── test_pure_exp.cpp
│   ├── test_logistic.cpp
│   ├── test_hopf_limit.cpp
│   ├── test_reproducibility.cpp
│   └── test_ensemble_smoke.cpp
├── bindings/
│   └── wasm/
│       ├── CMakeLists.txt
│       ├── glue.cpp        // EMSCRIPTEN_BINDINGS
│       └── wrapper.js      // thin JS API around the WASM exports
├── examples/
│   └── chit_sweep.cpp
├── CMakeLists.txt
├── README.md
├── CLAUDE.md
├── LICENSE                 // MIT (default; user may change)
├── .gitignore
└── .gitattributes
```

**Top-level `CMakeLists.txt`** declares:
- C++17 minimum.
- One library target `mpa_solver` (static by default; allow `BUILD_SHARED_LIBS=ON`).
- Tests gated on `BUILD_TESTING=ON` (default ON for native builds, OFF when building WASM).
- WASM target reachable via `-DMPA_SOLVER_BUILD_WASM=ON` (default OFF; requires Emscripten toolchain).

**No external numerical dependencies.** Standard library only. If you need a unit-test framework, prefer **Catch2 v3** via `FetchContent` — header-only, no system install. Do not add Boost, Eigen, or GSL for v0.

### 5.2 WASM target

Built with Emscripten (`emsdk`). The expected command surface is:

```
mkdir build-wasm && cd build-wasm
emcmake cmake .. -DMPA_SOLVER_BUILD_WASM=ON -DCMAKE_BUILD_TYPE=Release
emmake make
```

Output artifacts (in `build-wasm/bindings/wasm/`):

- `mpa_solver.js`    — Emscripten glue
- `mpa_solver.wasm`  — the compiled module
- `mpa_solver.d.ts`  — optional TypeScript declarations if low-cost

Use `embind` (`#include <emscripten/bind.h>`) to expose the structs and functions. The JS-side surface should be:

```js
import createModule from './mpa_solver.js';

const Module = await createModule();
const params = new Module.Parameters();
params.G0_A = 1.2;
params.gamma_AB = -0.3;
// ...

const traj = Module.integrate(initial, params, t_max, dt, sample_every);
// traj.t, traj.rho_A, traj.rho_B are vectors; convert to typed arrays in JS

params.delete();  // embind handles need manual cleanup
traj.delete();
```

A small `wrapper.js` should expose an idiomatic JS API that hides the `embind` cleanup, e.g.:

```js
export async function loadMpaSolver(wasmUrl) { ... }
// returns { integrate(state, params, tMax, dt, sampleEvery) -> {t, rhoA, rhoB} }
```

The wrapper should return plain JS arrays (or Float64Array) and free the WASM-side memory before returning.

### 5.3 Compiler flags

- Native: `-O3 -Wall -Wextra -Wpedantic` (or MSVC equivalent). Treat warnings as errors in CI only.
- WASM: `-O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1`.

Do not enable `-ffast-math` — reproducibility requires IEEE-754 semantics.

### 5.4 Reproducibility budget

A single trajectory at `dt = 0.001`, `t_max = 100` (100,000 steps) should run in **under 5 ms** on a modern desktop CPU. An ensemble of 1000 trajectories at the same resolution should fit in **under 5 seconds** single-threaded. Document the measured numbers in `README.md` after the first benchmark run; do not optimize past this for v0.

## 6. Tests

Each test in its own file under `tests/`. Use Catch2 v3 (or doctest if you prefer; pick one and stick to it). All tests must be deterministic.

### 6.1 `test_pure_exp.cpp` — analytical exponential

`γ_AB = 0`, `D_noise = 0`, decouples the modes. Each mode evolves as `ρ(t) = ρ₀ · exp((G₀ − L)·t)`. Run with `G₀_A = 1.5`, `L_A = 1.0` (growth), `G₀_B = 0.5`, `L_B = 1.0` (decay). Assert `|ρ_A(t) − analytical(t)| / analytical(t) < 1e-4` at every sample for `dt = 0.001`, `t_max = 5`.

### 6.2 `test_logistic.cpp` — analytical logistic

`γ_AB > 0`, single mode (`ρ_B = 0`), `G₀_A > L_A`. Solution is logistic toward carrying capacity. Verify match to analytical formula at relative tolerance 1e-3.

### 6.3 `test_hopf_limit.cpp` — cooperative coexistence

`γ_AB < 0`, both modes above threshold. Verify the system reaches a stable fixed point with both `ρ_A, ρ_B > 0`. Verify the fixed-point values match the algebraic solution of `drift_A = drift_B = 0`.

### 6.4 `test_reproducibility.cpp` — bit-identical output

Two `integrate()` calls with identical parameters (including `D_noise > 0` and `seed`) must produce bit-identical `rho_A`, `rho_B` arrays. `EXPECT_EQ` on each sample.

### 6.5 `test_ensemble_smoke.cpp` — ensemble statistics

`D_noise > 0`, 200 trajectories around an `s_critical` operating point (`G₀ ≈ L`). Verify:
- Mean trajectory is finite-valued at every sample.
- Variance grows initially then saturates (NESS).
- No trajectory exhibits NaN/Inf.

Not asserting framework signatures (CK aging, etc.) at this layer — those are downstream observables and tested in the auditor.

## 7. Repo conventions

This is an `mpa-*` repo. Follow the conventions of the existing siblings (`mpa-auditor`, `mpa-relaxation`, `mpa-engine`):

- **Public** GitHub repo at `github.com/ronviers/mpa-solver`.
- **MIT license**.
- **`CLAUDE.md` at the root** explaining the discipline (this brief is the v0 starting point — rewrite it as a discipline document after v0 lands, like the sibling repos have).
- **`dev_profile.json` gitignored** by default (host-profile output may end up here).
- **Pre-commit hook with gitleaks** recommended (`winget install gitleaks` on Windows; hook script at `.git/hooks/pre-commit` runs `gitleaks protect --staged --redact`). The user has standard tooling for this — point at it in `README.md` rather than installing autonomously.
- **`.gitignore`** must exclude build dirs (`build/`, `build-wasm/`, `cmake-build-*/`), CMake caches, IDE noise (`.vscode/`, `.idea/`, `*.swp`), `dev_profile.json`, and the Emscripten cache.
- **First commit message:** descriptive, names what was built. Co-author tag per the sibling pattern.
- **GitHub repo creation:** `gh repo create ronviers/mpa-solver --public --source=. --remote=origin --push --description "MPA universal two-mode kernel solver — minimal C++ numerical library, WASM-ready"`. `GH_TOKEN` is set in the user's environment; do not run `gh auth login`.

## 8. Integration target (informational — not your work)

Once v0 ships, the `mpa-auditor` repo (`H:\mpa-auditor`, public at `github.com/ronviers/mpa-auditor`) will:

1. Drop the WASM artifacts into `mpa-auditor/vendor/mpa-solver/`.
2. Rewrite `engines/character-engine.js` and `engines/discrete-engine.js` to import the WASM module and call `integrate()` instead of computing analytical templates.
3. The renderer animates the returned `Trajectory` arrays.

You do not implement that integration — the user will return to the auditor session to wire it up. Your deliverable is the standalone library + WASM artifacts in their own repo.

## 9. Acceptance checklist for v0

- [ ] Repo exists at `github.com/ronviers/mpa-solver`, public, MIT.
- [ ] Builds clean on a native compiler (gcc, clang, or MSVC) with `cmake .. && cmake --build . && ctest`.
- [ ] All five tests pass.
- [ ] WASM target builds clean with `emcmake cmake .. -DMPA_SOLVER_BUILD_WASM=ON && emmake make`, produces `mpa_solver.{js,wasm}` artifacts.
- [ ] `wrapper.js` exposes `loadMpaSolver(wasmUrl)` returning an object with `integrate()`. Demonstrated by a tiny HTML page (`examples/web/index.html`) that loads the WASM module, runs one integration, and prints the result to the page or console.
- [ ] `README.md` documents:
  - Build steps (native + WASM).
  - Public API (one paragraph plus a code example).
  - The cdv1 §"Universal two-mode kernel" reference.
  - Benchmark numbers from §5.4.
- [ ] `CLAUDE.md` at root explains discipline: scope (math only), deferred items, reproducibility commitment, sibling-repo conventions.

When all boxes are ticked, the user comes back to the `mpa-auditor` session with the WASM artifacts and the repo URL. Do not start that integration yourself.

## 10. References

- cdv1 §"Universal two-mode kernel" — the equation being integrated. [`mpa-atlas/framework/cdv1_compressed.md`](https://github.com/ronviers/mpa-atlas/blob/main/framework/cdv1_compressed.md).
- cdv1 §"gFDR signatures" — the downstream observable shape `χ(τ) vs C(0) − C(τ)` (informational only — not computed in v0).
- v9 §"Operators" and §"Composite catalogue" — discrete-mode shadow of the kernel; not implemented in v0 but the C/S/K/R operators are eventually built on top of the same dynamics.
- Existing sibling repos for conventions: `mpa-auditor` (browser observatory consuming this library), `mpa-relaxation` (Python finding-characterization that will eventually consume this library via pybind11), `mpa-engine` (frozen substrate-class repo, cited).
- Emscripten + embind: [emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html).
- Reproducibility-as-bit-identity is a load-bearing commitment of the broader project (auditor `reproducibility_hash` fields per contract 02); preserve it through every numerical choice.

---

**Build the smallest thing that satisfies §9. Resist scope creep. The next versions (v0.1 dynamic bath, v0.2 Caputo, v0.3 Python bindings) will come after v0 is in use and we know what the API actually needs to grow.**

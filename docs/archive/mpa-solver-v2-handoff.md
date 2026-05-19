# mpa-solver — v2 build handoff

**You are a fresh Claude Code session** continuing work on `github.com/ronviers/mpa-solver`. v0 shipped: RK4 + Euler–Maruyama with Lamb stationary closure, WASM build, 6 passing tests, ~4.25 ms / single trajectory, ~3.78 s / 1000-ensemble. The auditor is now consuming the WASM and animating real trajectories in `Window 1`.

v2 ships the rest of the mathematical apparatus the framework requires before the auditor can do its job. The discipline in `CLAUDE.md` stays load-bearing: **this library is a numerical kernel, not an observable library, not a substrate model.** v2 adds new kernel content and one *kernel-derived* observable family (gFDR) — but no substrate code, no I/O, no rendering.

---

## 1. What v2 ships

Five mathematical extensions and one new observable module. All additive to v0; v0 callers continue to work unchanged.

| # | Item | Why | Tier |
|---|---|---|---|
| 1 | **Dynamic-bath closure** | Promotes the bath occupancy B(t) to a dynamical coordinate. Mori–Zwanzig fast-bath limit `γ_B → ∞` must recover Lamb (test gates this). | T1 |
| 2 | **Non-reciprocal coupling** `γ_AB ≠ γ_BA` | v9 §Extension axes. Enables mentor-row dynamics (priority-queue oscillation, spatial Turing instability — substrate-conditional but the *kernel* must admit them). | T1 |
| 3 | **N-mode kernel** | Generalizes 2-mode to arbitrary `N`. Required for k_frust (needs N ≥ 3 closed chain), chimera, multi-mode pattern selection. Backward-compatible: N=2 reproduces v0 exactly. | T1 |
| 4 | **Milstein integrator** | Order-1.0 strong scheme. Euler–Maruyama (order 0.5) loses too much accuracy on noisy NESS trajectories long enough to produce clean gFDR signatures. Selectable via `Parameters::sde_scheme = { EulerMaruyama, Milstein }`. | T1 |
| 5 | **Caputo fractional memory** | cdv1 §"Universal two-mode kernel" non-Markovian closure. Mittag-Leffler kernel `Γ_AB(τ) = Γ_0 · E_{β_mem}(−(τ/τ_c)^{β_mem})`. Implement via **sum-of-exponentials approximation** (the standard practical approach): fit `E_β(−t^β) ≈ Σ_k w_k · exp(−λ_k · t)` for `K` auxiliary modes; each auxiliary mode is one ODE, so the integrator handles the history without convolution. | T1 |
| 6 | **`mpa::observables` module** | gFDR computation from ensemble trajectories: correlator `C(τ)`, response `χ(τ)`, parametric `(χ, ΔC)` locus, plus fitted invariants `X_c`, `X_r`, `α_s`, `P_s`, `N_f`. This is the *one* observable the kernel grows because it's intrinsic to the cdv1 prediction — every consumer wants it identically. Everything else stays in consumer-land. | T1 |
| 7 | **Python bindings (pybind11)** | `pip install ./bindings/python` produces `import mpa_solver` returning NumPy arrays. Required so `mpa-relaxation` can consume the same kernel its substrate experiments are testing against. | T1 |
| 8 | **Linearization at fixed points** | Numerical Jacobian + eigendecomposition at any state. Reports: `ω_RO`, `γ_RO`, `ζ` (damping), `Q` (cycles-of-headroom). Per cdv1 §Stability — these are the named observables for the c/s/r recovery profile. | T2 |
| 9 | **WASM SIMD128** | Single compiler flag (`-msimd128`). Catch2 perf benchmarks should drop ~2× on the hot RK4 path. | T2 |
| 10 | **OpenMP ensemble parallel** | One pragma over the ensemble loop; gated by `-DMPA_SOLVER_OPENMP=ON` (default ON for native, OFF for WASM). Target: 4× on a desktop CPU; preserve bit-identity-per-seed by binding each thread to one trajectory. | T2 |

**Explicitly deferred to v3:**

- RK45 adaptive stepping (Dormand–Prince).
- WebGPU compute shader path for massive ensembles.
- Streaming integration (step-by-step yield).
- Checkpoint/restart.
- Sensitivity analysis (∂trajectory/∂params).
- Stratonovich integration (Itô is sufficient for the framework's current claims).
- Multiplicative noise (additive is sufficient).
- Operator-event extraction from trajectories (consumer concern — auditor's discrete-engine).

If you reach for any of those, stop. They belong to a later session.

---

## 2. Math content

### 2.1 N-mode kernel

Generalize the v0 two-mode kernel to N modes indexed `i ∈ {0, ..., N-1}`:

```
∂ρ_i/∂t = (G_{0,i}^eff − L_i)·ρ_i − Σ_{j ≠ i} γ_{ij}·ρ_i·ρ_j + 𝒟_i[ρ; γ]
```

`γ_{ij}` is an `N × N` matrix (diagonal ignored or set to 0). **Symmetric for v0 backward-compat:** when `γ_{ij} == γ_{ji}` and `N == 2`, output must equal v0 byte-for-byte.

**Non-reciprocal mode** (`γ_{ij} ≠ γ_{ji}`): enabled by a flag, or simply by passing an asymmetric matrix. The kernel doesn't care; the consequences (Hopf, traveling waves, priority-queue oscillation) emerge from the dynamics.

**Lamb closure for N modes:**

```
G_{0,i}^eff = G_{0,i} / (1 + Σ_{j ≠ i} ρ_j / ρ_sat,i)
```

`ρ_sat` may be per-mode (`ρ_sat[N]`) or scalar (broadcasts). Default scalar 1.0.

### 2.2 Dynamic-bath closure

Bath occupancy `B(t) ∈ [0, 1]` is a dynamical coordinate; one extra ODE per closure invocation:

```
dB/dt = γ_B · (B_∞ − B) − Σ_i κ_i · ρ_i · B
```

Parameters:
- `γ_B` — bath relaxation rate (1/τ_bath).
- `B_∞` — equilibrium bath occupancy in the absence of modes.
- `κ_i` — mode-i pumping rate from the bath.

The kernel drift gains a bath-aware gain:

```
G_{0,i}^eff(B) = G_{0,i} · B
```

Replacing the Lamb saturation when `closure == DynamicBath`. The Lamb form is the `γ_B → ∞` adiabatic limit; this is part of the test gate.

### 2.3 Caputo fractional memory

For substrates with `β_mem < 1` (cdv1 §Pattern formation Wall-coupling posit), the cross-coupling becomes non-Markovian:

```
∂ρ_i/∂t = drift_i(ρ) − Σ_{j ≠ i} ∫₀^t Γ_{ij}(t − s) · ρ_i(s) · ρ_j(s) ds + ...
Γ_{ij}(τ) = Γ_0,ij · E_{β_mem}(−(τ/τ_c)^{β_mem})
```

`E_β` is the Mittag-Leffler function. β = 1 recovers exponential memory (Markovian/Lamb); β → 0 gives a power-law tail.

**Implementation: sum-of-exponentials approximation.** Replace `E_β(−t^β)` with `Σ_{k=1}^K w_k · exp(−λ_k · t)`. Each auxiliary mode is one auxiliary ODE:

```
dM_{ij,k}/dt = −λ_k · M_{ij,k} + ρ_i · ρ_j         (for k = 1..K)
∫₀^t Γ_{ij}(t-s) · ρ_i · ρ_j ds  ≈  Σ_k w_k · M_{ij,k}(t)
```

This converts the convolutional history integral into `K` ordinary ODEs that the existing RK4/Milstein machinery integrates with no special-case code. Recommended `K = 6–10`; weights `w_k` and rates `λ_k` precomputed from `(β_mem, τ_c)` once at integration start. Use the Beylkin–Monzón quadrature or the Yuan–Agrawal expansion — both have published tables; pick one and cite it in the source. **Do not invoke a Mittag-Leffler special-function library.** Sum-of-exponentials is faster, more portable, and the framework cares about the leading-order tail not the exact ML kernel.

Falsifier: at `β_mem = 1.0` the SoE approximation must reproduce the Lamb result to relative tolerance `1e-3`.

### 2.4 Milstein scheme

For an SDE `dρ = a(ρ)·dt + b(ρ)·dW`, the Milstein update is:

```
ρ(t + dt) = ρ(t) + a·dt + b·√dt·ξ + (1/2) · b · b' · dt · (ξ² − 1)
```

where `b' = db/dρ` and `ξ ∼ N(0,1)`. For additive noise (`b` constant), the correction term vanishes and Milstein reduces to Euler–Maruyama. The user-facing benefit of Milstein appears when noise is multiplicative (a v3 feature) — but v2 should ship the scheme now so the API is in place.

For v2 additive-noise paths, Milstein and EM produce identical output. The scheme selector exists for future multiplicative-noise work and for API completeness.

### 2.5 Positivity guard

Across all schemes, when `ρ_i` would go negative due to a large noise step or numerical artifact, clamp to `ρ_min = 1e-12`. The framework forbids `ρ < 0` (occupation density). Document the clamp in the trajectory metadata (`Trajectory::clamp_events` count).

---

## 3. gFDR observables module

New header `include/mpa_solver/observables.hpp`. Pure functions consuming `Trajectory` / `std::vector<Trajectory>` ensembles, returning POD result structs. No additional state.

### 3.1 Correlator `C(τ)`

```cpp
struct Correlator {
  std::vector<double> tau;
  std::vector<double> C_AA;      // <rho_A(t) rho_A(t+tau)> - <rho_A>^2, ensemble-averaged
  std::vector<double> C_BB;
  std::vector<double> C_AB;      // cross-correlator
  double mean_A;
  double mean_B;
};

Correlator correlator(const std::vector<Trajectory>& ensemble,
                      std::size_t equilibration_samples,
                      std::size_t n_tau);
```

Computation: drop the first `equilibration_samples` from each trajectory (NESS warm-up). For τ ∈ [0, ..., n_tau-1], compute the ensemble-and-time-averaged correlator. Use the FFT-free direct sum for now; if benchmarks justify, replace with Wiener–Khinchin via PocketFFT (header-only MIT — acceptable dependency).

### 3.2 Response `χ(τ)`

Two paths, selectable:

**(a) Direct perturbation.** Re-integrate each ensemble trajectory with the same seed, with one initial-condition perturbation `δρ_A(t=0) = ε`. Compute `χ_AA(τ) = ⟨ρ_A^perturbed(τ) − ρ_A^unperturbed(τ)⟩ / ε`. Cost: 2× ensemble cost. Implemented in v2.

**(b) Harada–Sasa.** Infer `χ` from entropy production `σ(τ)` and the velocity correlator. Cost: 1× ensemble. **Deferred to v3** — it requires the entropy-production framework's substrate-specific calibration, which is consumer territory. v2 ships path (a) only.

```cpp
struct Response {
  std::vector<double> tau;
  std::vector<double> chi_AA;
  std::vector<double> chi_BB;
  double perturbation_amplitude;
};

Response response_direct(const std::vector<Trajectory>& ensemble,
                         Parameters params,
                         State initial,
                         double t_max,
                         double dt,
                         std::size_t equilibration_samples,
                         std::size_t n_tau,
                         double perturbation_amplitude = 1e-3);
```

Note this function re-runs the integration internally — it takes `params + initial + integration spec` rather than `Trajectory ensemble`. This keeps the perturbation method seed-matched.

### 3.3 gFDR locus

The parametric plot the framework reads regimes from:

```cpp
struct GFDRLocus {
  std::vector<double> delta_C;     // C(0) - C(tau) for tau in [0, n_tau)
  std::vector<double> chi;         // chi(tau) matched index-for-index
  std::vector<double> tau;         // for hover/inspection
};

GFDRLocus gfdr_locus(const Correlator& c, const Response& r);
```

### 3.4 Fitted invariants

Per cdv1 §gFDR signatures table:

```cpp
struct GFDRInvariants {
  // X_c = lim_tau chi/(C(0)-C(tau)) in c-regime    -> 0
  double X_c;
  // X_r = lim_tau chi/(C(0)-C(tau)) in r-regime    -> 1
  double X_r;
  // alpha_s = slope of aging segment in s-regime
  double alpha_s;
  // P_s = lim_tau C(tau)/C(0)                       (plateau height)
  double P_s;
  // N_f = fraction of tau-window with chi < 0       (k_frust signature)
  double N_f;
  // bookkeeping
  std::string fitted_regime;   // best-fit regime label
  double fit_confidence;
};

GFDRInvariants fit_invariants(const GFDRLocus& locus);
```

Fit logic:
- Compute the slope of `chi(τ) vs (C(0)−C(τ))` in two windows (early-τ FDR slope, late-τ aging slope).
- If early slope ≈ 1 and late slope ≈ 1 → `r`-regime, `X_r = 1`.
- If both slopes ≈ 0 → `c`-regime, `X_c = 0`.
- If `chi` plateaus and the late slope ≠ 1 → `s`-regime, `α_s` = late slope, `P_s` = `C(τ→large)/C(0)`.
- If `chi(τ) < 0` for any τ window → `k_frust`, `N_f` = that fraction.

Document the windowing thresholds in code comments; do not expose them as parameters unless a consumer pushes back.

### 3.5 No fitting beyond invariants

`observables.hpp` does *not* try to detect regime boundaries, classify ensembles, or invoke domain heuristics. It computes the cdv1 named quantities and stops. Any further interpretation (e.g. "this looks like a Hebbian lock") is consumer-side.

---

## 4. Linearization (T2)

```cpp
#include <mpa_solver/linearization.hpp>

struct Spectrum {
  // Eigenvalues of the Jacobian at `state`. Complex; first.real() is the
  // dominant real part (governs stability).
  std::vector<std::complex<double>> eigenvalues;
  // Damping coefficient zeta of the dominant complex-conjugate pair.
  // < 1 underdamped (c), = 1 critical (s-edge), > 1 overdamped (r).
  double zeta;
  // Relaxation-oscillation frequency omega_RO (rad/time) — imag of the
  // dominant pair.
  double omega_RO;
  // Decay rate gamma_RO (1/time) — −real of the dominant pair.
  double gamma_RO;
  // Headroom Q = omega_RO / (2 * gamma_RO).
  double Q;
};

Spectrum linearize(State state, Parameters params);
```

Numerical Jacobian via central differences (`h = 1e-6` default; configurable). Eigendecomposition via a small in-tree QR — do not pull in Eigen unless benchmarks justify. For 2-mode the Jacobian is 2×2 and the analytical eigenvalues are trivial; for N>2 the QR is unavoidable.

**Falsifier:** at the cooperative fixed point of a 2-mode `γ_AB < 0`, `chit > 0` configuration, `Q` from this function must match the cdv1 analytical formula `Q = √(2L(e^chit − 1)/γ_s)` to relative tolerance `1e-3`. Test gates this.

---

## 5. API additions

All additions are extensions; the v0 API stays callable unchanged.

```cpp
// include/mpa_solver/types.hpp — additions

enum class Closure { Lamb, DynamicBath, Caputo };    // expanded
enum class SDEScheme { EulerMaruyama, Milstein };

struct Parameters {
  // v0 fields unchanged ...
  // additions:
  double gamma_BA = 0.0;          // if 0 (default), symmetric with gamma_AB
  bool   reciprocal = true;       // when true, gamma_BA = gamma_AB enforced
  SDEScheme sde_scheme = SDEScheme::Milstein;   // new default

  // Dynamic-bath closure parameters (used iff closure == DynamicBath)
  double gamma_B = 10.0;
  double B_inf   = 1.0;
  std::vector<double> kappa = {0.1, 0.1};  // per-mode pumping

  // Caputo closure parameters
  double beta_mem  = 1.0;         // 1.0 = exponential (Lamb-equivalent)
  double tau_c     = 1.0;
  std::size_t caputo_K = 8;       // number of SoE auxiliary modes
};

struct NModeParameters {
  // for arbitrary N
  std::vector<double> G0;          // size N
  std::vector<double> L;
  std::vector<std::vector<double>> gamma;  // N x N
  std::vector<double> rho_sat;     // size N, or size 1 (broadcasts)
  double D_noise = 0.0;
  Closure closure = Closure::Lamb;
  SDEScheme sde_scheme = SDEScheme::Milstein;
  std::uint64_t seed = 0;
  double beta_mem = 1.0;
  double tau_c    = 1.0;
  std::size_t caputo_K = 8;
};

struct NModeState {
  std::vector<double> rho;        // size N
  double bath = 1.0;              // for DynamicBath; ignored otherwise
};

struct NModeTrajectory {
  std::vector<double> t;
  std::vector<std::vector<double>> rho;   // shape: N x n_samples
  std::vector<double> bath;               // empty if not DynamicBath
  std::size_t clamp_events = 0;           // positivity-guard count
};
```

```cpp
// include/mpa_solver/integrate.hpp — additions

NModeTrajectory integrate_n(NModeState initial,
                            NModeParameters params,
                            double t_max,
                            double dt,
                            std::size_t sample_every = 1);

std::vector<NModeTrajectory> ensemble_n(NModeState initial,
                                         NModeParameters params,
                                         double t_max,
                                         double dt,
                                         std::size_t N_trajectories,
                                         std::size_t sample_every = 1);
```

**WASM bindings** (`bindings/wasm/glue.cpp`): expose `integrate_n`, `ensemble_n`, `correlator`, `response_direct`, `gfdr_locus`, `fit_invariants`, `linearize`. Embind vectors-of-vectors marshal to nested JS arrays / typed arrays; document the conversions in `wrapper.js`.

**Python bindings** (`bindings/python/`): pybind11 module surface mirrors the C++ headers. NumPy arrays for any sequence type. `setup.py` with scikit-build for CMake integration.

**JS wrapper (`bindings/wasm/wrapper.js`):** add four methods:

```js
solver.integrateN(state, params, tMax, dt, sampleEvery)
solver.ensembleN(state, params, tMax, dt, N, sampleEvery)
solver.observables.correlator(ensemble, equilibration, nTau)
solver.observables.response(params, initial, tMax, dt, equilibration, nTau, perturbation)
solver.observables.gfdrLocus(correlator, response)
solver.observables.fitInvariants(locus)
solver.linearize(state, params)
```

---

## 6. Tests

Add to `tests/`. Existing v0 tests must continue to pass byte-identically (the v0 backward-compat assertion).

### 6.1 `test_v0_backward_compat.cpp`

For a representative `(state, params, t_max, dt)` set, run v2's `integrate()` (2-mode path) and assert byte-identity with a captured v0 reference output (commit a small JSON fixture under `tests/fixtures/v0_reference_traj.json`). This is the load-bearing check that v2 doesn't accidentally drift the 2-mode kernel.

### 6.2 `test_n_mode_reduces_to_2.cpp`

`integrate_n` with `N=2` and parameters equivalent to v0's 2-mode call must produce identical output to `integrate()`.

### 6.3 `test_dynamic_bath_lamb_limit.cpp`

With `closure == DynamicBath` and `γ_B = 1e6` (fast bath), output must match `closure == Lamb` to relative tolerance `1e-3`. This is the Mori–Zwanzig fast-bath gate.

### 6.4 `test_caputo_markov_limit.cpp`

With `closure == Caputo` and `β_mem = 1.0`, the trajectory must match the Lamb-closure result to relative tolerance `1e-3` for any reasonable `K ≥ 6`.

### 6.5 `test_non_reciprocal_limit_cycle.cpp`

`γ_AB > 0`, `γ_BA < 0` (or opposite signs), above-threshold chit. The framework predicts a stable limit cycle of frequency `ω_pq ≈ √(|γ_AB · γ_BA| · ρ_A* · ρ_B*)`. Integrate for `t_max = 200`, detect the oscillation period, and assert it matches the analytical formula to relative tolerance 5%.

### 6.6 `test_gfdr_r_regime.cpp`

Deep r-regime configuration, deterministic `D_noise > 0` (small), ensemble of 200 trajectories. Compute `gfdr_locus`. Assert `X_r ≈ 1` to absolute tolerance 0.05 (equilibrium FDR holds; unit slope). This is the framework-signature gate.

### 6.7 `test_gfdr_c_regime.cpp`

Deep c-regime, same ensemble protocol. Assert `X_c ≈ 0` to absolute tolerance 0.05.

### 6.8 `test_gfdr_s_aging.cpp`

s-critical operating point with stochastic forcing. Run a long enough trajectory ensemble that the aging diagonal is statistically resolved. Assert `0.3 ≤ α_s ≤ 0.9` and `0.1 ≤ P_s ≤ 0.6`. The point is *not* to nail an exact number (substrate-conditional); the point is that the locus *has* an aging segment and the fitter recognises it.

### 6.9 `test_linearize_Q.cpp`

Cooperative 2-mode fixed point. Numerical `Q` from `linearize()` matches analytical `Q = √(2L(e^chit − 1)/γ_s)` (with `γ_s = 1` to match L) to relative tolerance `1e-3`.

### 6.10 `test_milstein_em_agreement.cpp`

For additive-noise paths (all v2 paths), Milstein and Euler–Maruyama must produce byte-identical output (the Milstein correction term is zero when `b' = 0`).

### 6.11 `test_reproducibility_v2.cpp`

Same as v0 reproducibility test but covering N-mode and all closures. Same `(state, params, t_max, dt, sample_every, seed)` → byte-identical output across runs.

### 6.12 `test_python_smoke.cpp` (Python side: `tests/python/test_smoke.py`)

Tiny pytest: `import mpa_solver; traj = mpa_solver.integrate_n(...)`; assert NumPy types, shape, finiteness. Build gate: only runs if Python bindings built.

---

## 7. Build

CMake additions:

- `MPA_SOLVER_BUILD_PYTHON=ON|OFF` (default OFF unless pybind11 found).
- `MPA_SOLVER_OPENMP=ON|OFF` (default ON for native, OFF for WASM).
- `MPA_SOLVER_SIMD=ON|OFF` (WASM only; adds `-msimd128`).

Native: `cmake .. -DCMAKE_BUILD_TYPE=Release -DMPA_SOLVER_BUILD_PYTHON=ON`.
WASM:   `emcmake cmake .. -DMPA_SOLVER_BUILD_WASM=ON -DMPA_SOLVER_SIMD=ON`.

No new mandatory dependencies. Optional:
- `pocketfft` (header-only MIT) gated on `MPA_SOLVER_USE_FFT=ON` (default OFF) — only invoked by the correlator if benchmarks justify.
- `pybind11` via `FetchContent` for Python bindings.

Compiler flags unchanged from v0; **`-ffast-math` remains forbidden.**

---

## 8. Reproducibility commitment (unchanged from v0, restated)

Bit-identity across runs is non-negotiable. Concretely:

- Two calls with identical `(state, params, t_max, dt, sample_every, seed)` produce byte-identical output. Tested per-closure, per-scheme, per-N.
- v0's exact 2-mode Lamb behavior is preserved. `test_v0_backward_compat.cpp` is the load-bearing check.
- Any future change that alters output requires a patch bump and a fixture refresh, documented in the commit.
- Multi-thread ensembles: each trajectory keeps its own thread-local `std::mt19937_64` seeded from `(params.seed, trajectory_index)`. No shared RNG state.

---

## 9. Performance budget

| Operation | Target (single-threaded, native, Release) |
|---|---|
| Single 2-mode trajectory, deterministic, 100k steps | ≤ 5 ms (v0 baseline) |
| Single 2-mode trajectory, Milstein, 100k steps | ≤ 5 ms |
| Single 4-mode trajectory, 100k steps | ≤ 12 ms |
| 1000-trajectory 2-mode ensemble, 100k steps each | ≤ 5 s (v0 baseline) |
| Same with OpenMP, 8 threads | ≤ 1 s |
| `correlator()` over 1000 trajectories × 10k samples × 256 τ values | ≤ 200 ms |
| `response_direct()` over 1000 trajectories | ≤ 10 s (2× ensemble cost) |
| WASM with `-msimd128`: single 2-mode trajectory | ≤ 3 ms |

Document measured numbers in `README.md` after the first benchmark run. Don't optimize past target.

---

## 10. Repo conventions (unchanged from v0)

- Public GitHub repo at `github.com/ronviers/mpa-solver`. MIT.
- Sibling-pattern conventions: `dev_profile.json` gitignored, gitleaks pre-commit recommended.
- Commit format: descriptive subject; co-authorship line per the project pattern.
- CLAUDE.md scope discipline applies: kernel + the *one* observable family that's intrinsic to the framework's central prediction. Nothing else.

---

## 11. Acceptance checklist for v2

- [ ] All 12 tests pass (v0's 6 + the 6 new gates).
- [ ] v0 backward-compatibility fixture matches byte-for-byte.
- [ ] Native build clean (gcc/clang/MSVC).
- [ ] WASM build clean; `mpa_solver.{js,wasm}` artifacts updated; `wrapper.js` exposes the new methods.
- [ ] Python build clean; `pip install ./bindings/python` works; `tests/python/test_smoke.py` passes.
- [ ] OpenMP ensemble parallel: speedup ≥ 3× on 8 cores measured and documented in `README.md`.
- [ ] WASM SIMD: speedup ≥ 1.5× on the hot RK4 path measured and documented.
- [ ] `README.md` documents all new API surface, all new closure choices, all new tests, and the v2 benchmarks alongside v0's.
- [ ] `CLAUDE.md` updated with: new deferred items (RK45 → v3, multiplicative noise → v3, etc.); new test counts; the v0-bit-identity discipline.

When done: ping back here with the GitHub URL, the version tag (`v2.0.0`), and the path to the refreshed WASM artifacts. The auditor session will re-vendor and wire the new APIs.

---

## 12. References

- cdv1 §"Universal two-mode kernel" — N-mode generalization, dynamic-bath closure, Caputo memory. [`mpa-atlas/framework/cdv1_compressed.md`](https://github.com/ronviers/mpa-atlas/blob/main/framework/cdv1_compressed.md).
- cdv1 §"gFDR signatures" — `X_c`, `X_r`, `α_s`, `P_s`, `N_f`, the parametric `(χ, ΔC)` plot.
- cdv1 §"Stability and attractor structure" — `ω_RO`, `γ_RO`, `ζ`, `Q`. The analytical formula for `Q` that `test_linearize_Q.cpp` checks against.
- v9 §"Extension axes" — non-reciprocal coupling, hierarchical kernel, higher-order frustration. v2's non-reciprocal and N-mode work cover the first two.
- Beylkin, G. & Monzón, L. — "Approximation by exponential sums revisited," for the Caputo SoE quadrature.
- Yuan, L. & Agrawal, O. P. — alternative SoE expansion for fractional kernels.
- v0 handoff: [`mpa-auditor/docs/mpa-solver-handoff.md`](https://github.com/ronviers/mpa-auditor/blob/main/docs/mpa-solver-handoff.md).

**Build the smallest thing that satisfies §11. The discipline says: this is the last big additive release for a while. v3 will be pure performance and tooling.**

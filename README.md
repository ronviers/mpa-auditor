# MPA Auditor

A browser-based scientific instrument that audits the MPA (Multi-Primitive Architecture) framework's predictions against empirical substrate data. Built as a fully instrumented observatory: three synchronized windows showing what the framework predicts, what the data shows, and — most importantly — the honest gap between them.

## Status

**Phase 0 — Specification complete.** No code yet. Contracts, theme, README, and Session 1 brief drafted.

## What this is

Three windows on every canvas:

1. **Window 1 — Predicted.** The framework's clean prediction. In Continuous mode (formerly "Character"): the Cugliandolo–Kurchan aging diagonal, the smooth Lyapunov surface. In Discrete mode (formerly "Structural"): the operator graph with $k_\text{frust}$ subgraphs highlighted.

2. **Window 2 — Empirical.** Real-world data, with full attribution displayed prominently. Surface-code traces, glass relaxation, active-matter trajectories, neuronal firing — whatever the user uploads.

3. **Window 3 — Delta.** The audit. Where they agree, where they disagree, what kind of disagreement it is, and what framework move (or extension axis, or posit) closes the gap. This is the scientifically load-bearing window.

Plus tabs along the top: gFDR Signatures, Phase Portrait (3D basin + trajectories), Operator Graph, Substrate Map, Audit Library.

## Architecture

Hub-and-spoke. Vanilla JavaScript ES modules. No build step, no framework.

```
SHELL (the hub)
├── Conductor (event bus + module registry)
├── Style Manager (theme tokens → CSS variables)
└── Layout Manager (windows, tabs, sliders)
        ↓ JSON contracts ↓
ENGINES (math)
├── Discrete Engine (operator algebra, k_frust)
├── Character Engine (chit, headroom, basin V)
├── Data Engine (CSV ingestion, validation)
└── Audit Engine (compares Window 1 vs Window 2)
        ↓ JSON contracts ↓
RENDERERS (pixels)
├── Plotly 2D (gFDR, recovery, power spectrum)
├── Three.js 3D (Lyapunov basin, trajectory spray)
├── Cytoscape (operator graph)
└── Observable Plot (substrate map)
```

Engines compute. Renderers draw. They never know about each other directly — the Event Bus routes everything via JSON contracts.

## The Contracts (immutable)

Eight JSON Schema files in `/contracts/`. **They are sacred.** Once Phase 0 is approved, contracts do not change. AI sessions that think a contract is wrong raise it as a question, not a code change.

| # | Contract | Purpose |
|---|----------|---------|
| 01 | StateRequest | Conductor → Engine: "compute a prediction for these parameters" |
| 02 | PredictedLocus | Engine → Window 1: math, equation, uncertainty, posit-grade flags |
| 03 | AuditDelta | Audit Engine → Window 3: the four miss categories, citation, recommendations |
| 04 | ModuleRegistration | Every module → Conductor: "I'm here, I do X, I listen for Y" |
| 05 | DataUpload | Data Engine → Window 2: empirical data + **mandatory provenance** |
| 06 | ErrorReport | Any module → Conductor: graceful failure |
| 07 | ThemeBundle | Style Manager → Renderers: tokens, regime palette, miss-category styling |
| 08 | SelectionChanged | Any module → Conductor: cross-window sync (time cursor, camera, substrate) |

## Load-bearing commitments

These shape the contracts and renderers. They are not negotiable.

**Provenance is sacred.** Every dataset carries full attribution — authors, DOI, license, BibTeX. Always displayed prominently in Window 2 and exported with every audit. The people who collected the data should be proud of how their work appears here.

**Uncertainty is structural.** Predictions carry confidence bands. Data carries error bars or explicit "no uncertainty reported." Posit-grade claims are marked. Nothing is silently faked.

**Units are explicit.** Every column declares its units. The Audit Engine refuses incompatible comparisons. No magic conversions.

**Reproducibility hashes.** Every prediction and audit carries a SHA-256 over its inputs. Bit-perfect replay is always possible.

**Uncertainty types render distinctly.** Out-of-scope regions hatch. Posit-grade predictions dash. $k_\text{frust}$ regions show topological tears in the Lyapunov surface, not smooth extrapolation. Confidence and lack of confidence are equally legible.

**Color-blind safe.** Regime classes are distinguishable by shape AND color, never color alone.

## The look is external

**The entire visual appearance of the instrument lives in [`styles/theme.json`](styles/theme.json).** Colors, fonts, type sizes, button heights, window minimums, animation timings, regime palette, miss-category styling — every visual decision is a value in that file.

Code never hardcodes a color, font, or size. The Style Manager loads `theme.json` at startup and converts each token into a CSS variable that the rest of the codebase references. To change the look, edit `theme.json` and reload the page. No build step, no code change.

Design references (palette swatches, mockups) live in [`design/`](design/). The current brand is **Imbric Systems** — see [`design/auditor-palette.png`](design/auditor-palette.png) and [`design/README.md`](design/README.md).

## Toolchain

Pinned in Phase 0; new tools require explicit roadmap update.

| Layer | Library | Why |
|-------|---------|-----|
| 2D charts (workhorse) | Plotly.js | Log-log one-liner, animation, free SVG export |
| 2D bespoke (substrate map) | Observable Plot | Modern grammar-of-graphics for irregular topology |
| 3D | Three.js + EffectComposer | Real shaders, bloom, particle systems |
| Graph | Cytoscape.js | Best layouts at our scale |
| Math computation | mathjs | Browser-native, low cognitive overhead |
| Math typography | KaTeX | Publication-grade LaTeX rendering |
| CSV parsing | PapaParse | Handles real-world CSV weirdness |
| Heavy numerics (reserved) | Pyodide | Real scipy if/when needed (Phase 5+) |

Loaded via CDN `<script>` tags. No npm, no bundler.

## Running it locally

```
python -m http.server 8000
```

Run that from inside `H:\mpa-auditor`, then open `http://localhost:8000` in a browser. `Ctrl+C` in the terminal stops it.

(A server is needed only because modern browsers block JavaScript modules and `fetch()` over `file://`. Python ships with a built-in static server — no `server.py` to write, no dependencies to install.)

### If the trajectory strip reads "solver: load failed…"

The C++ ODE kernel runs in your browser via WebAssembly. If it fails to load:

1. **Open the browser console** (F12). The `[solver-service]` lines name the actual error, the URL it tried, and (when possible) the HTTP status and Content-Type of `mpa_solver.wasm`.
2. **If the console says `WebAssembly is not defined`:** the issue is the *browser context*, not the server. The Auditor's WASM kernel cannot run in a sandboxed webview (some IDE preview panes, some embedded views). Open `http://localhost:8000` in a regular browser tab (Chrome / Firefox / Edge) and the trajectory will appear. Other causes: enterprise policy disabling WebAssembly (check `chrome://policy` or `edge://policy` for `WebAssemblyEnabled`); a privacy extension stripping the WebAssembly global (try an incognito / private window with extensions disabled).
3. **If `content-type` on the `.wasm` HEAD isn't `application/wasm`:** `python -m http.server` only sends the right MIME on Python ≥ 3.7. Run `python --version`; upgrade if needed. The page renders on old Python — only WebAssembly streaming compilation refuses.
4. **If the URL bar shows `file:///` not `http://`:** open the served URL. Browsers block ES modules and `fetch()` over `file://`.
5. **Hard refresh** with `Ctrl+Shift+R` to bypass any stale cache.
6. **Sanity check the artifacts exist:** `ls vendor/mpa-solver/` should show `mpa_solver.js`, `mpa_solver.wasm`, `wrapper.js`. If any are missing, `git pull` or re-vendor from the [`mpa-solver`](https://github.com/ronviers/mpa-solver) build output.
7. **Alternative server** that always sends correct MIME: `npx serve -p 8000` or `npx http-server -p 8000` (one-shot, no install). Use either if Python keeps refusing.

## Roadmap

The original 12-session plan ran sessions 0–4 to completion (spec, shell, both engines, first renderer) and folded sessions 2–4 into a single combined build. After that work shipped, [`mpa-solver`](https://github.com/ronviers/mpa-solver) v2 landed and is now driving real ODE trajectories through the Predicted pane. From here, the roadmap restructures into **M-sessions** — modular, file-scoped sessions that can run in parallel because each owns a disjoint set of files.

### Done

| # | Session | Visible result |
|---|---|---|
| 0   | Specification (contracts, theme, briefs) | Phase 0 documents |
| 0.1 | Imbric Systems palette + `design/` folder + theme externalization | Brand colors live across the instrument |
| 1   | Shell + Conductor | Page chrome, tabs, sliders, theme toggle, event bus |
| 1.1 | Settings dropdown, professional tab names, virtue-claim scrub | Clean header UI; no marketing-flavored display copy |
| 2 + 3 + 4 | Both engines + first Plotly renderer | Slider morphs the predicted locus |
| 2.1 + 3.1 + 4.1 | Window 1 framework-state display | Manifold, bifurcations, invariants, patterns, posits |
| 2.2 + 3.2 + 4.2 | `mpa-solver` v0 wired in | Real ODE trajectories live in Window 1 |
| 2.3 + 3.3 + 4.3 | `mpa-solver` v2 vendored | Numerical Q, ζ, ω_RO from real eigendecomposition |

### The three Predicted-pane modes

The Predicted pane answers three different researcher questions. They are distinct modes, built in sequence:

| Mode | Question | Status |
|---|---|---|
| **Explore** | "What does the framework predict at parameters X?" — free-dial chit / γ_AB, no data needed. | Exists today. |
| **Audit** | "What does the framework predict for *this* substrate, and what is the irreducible residual?" — parameters locked to the best-fit of loaded empirical data; the fit removes the "you dialed it wrong" contamination so the gap is attributable to the framework. | Needs the **Inversion Engine** (M-Inversion). |
| **Navigate** | "Given this substrate, what is my navigable design space — where does tuning end and redesign begin?" — fitted operating point plotted inside the substrate's *gamut* (RFC-S §2, the image of its RG trajectory), with τ_obs as a camera (RFC-S §1: auto-remap *is* the flow trajectory) and the five intents (RFC-S §3) as the design constraints. | **Phase 2.** Needs Inversion + driver-profile concept + the auto-remap rule (RFC-S Appendix B item 1 — *open in the spec itself*). Named now so contracts/architecture don't preclude it; contract 01's `parameters` object is `additionalProperties: true`, so τ_obs needs no contract change. |

The audit's teeth are in the *partial* fit: amplitudes (α_s, P_s, chit, γ_AB) are fit; structural predictions and cross-register identities (the s-regime exponent triality, the five posits) are **not** — they are checked against the fitted values. Fit everything and nothing can be falsified.

### M-sessions (predicted-pane modularization + dynamics-first visualization)

Each M-session owns its file set so they can fan out from M1 in parallel. M1 is the bottleneck — everything else needs the sub-architecture in place.

| # | Session | Files owned | Depends on | What ships |
|---|---|---|---|---|
| **M1** | Predicted-pane sub-architecture refactor | `renderers/prediction/**`; thin shim in `renderers/plotly-2d.js`; view-mode switcher in `index.html` | (gateway) | No visual change; 7 sub-displayers extracted; `predictionSubBus` exposed; drop-test confirms parallel sessions can land new displayers without cross-file edits |
| **M2** | Cobham Stack + Synchroscope | `renderers/prediction/displayers/cobham-stack.js`, `synchroscope.js` | M1 | Vertical pressure-gauge stack for heat-tax tower (shatters at Wall); circular phase-locking dial for mode coherence |
| **M3** | Ignition + Fraying Detonation | `renderers/prediction/displayers/ignition-control.js`; engines gain streaming-trajectory mode | M1 | "Ignite" button replays cold-start dynamics; "Run Fraying" plays the c→s→r collapse sequence as a 10-second movie |
| **M4** | Caputo Ghost Trails | `renderers/prediction/displayers/ghost-trails.js`; engines select Caputo closure in s-band | M1 | Memory-kernel-driven afterimages on the trajectory strip; s-regime aging visible as a smeared wake instead of an exponential tail |
| **M5** | Three.js Phase Portrait | `renderers/prediction/displayers/basin-3d.js`; GLSL shaders; Drain Whirlpool particle system; Flicker Shader bloom | M1 | Topological view: 3D Lyapunov surface with k_frust as actual geometric tears; viewport tumbling; particle trajectory spray |
| **M6** | gFDR observables wiring | `engines/character-engine.js`, `discrete-engine.js`, `renderers/prediction/displayers/gfdr-signature.js` | M1 | Analytical FDR locus replaced with ensemble-derived; debounced async; "computing..." indicator |

### Other windows + the audit pipeline (sub-architecture pattern propagates)

The audit pipeline has a strict dependency chain: **M6 (gFDR observables) → M7 (Data Engine) → M-Inversion (fit) → M8 (Audit Engine)**. The Inversion Engine scores candidate parameters by comparing the framework's gFDR locus against the empirical one, so it cannot land before M6.

| # | Session | Depends on | What ships |
|---|---|---|---|
| **M7** | Window 2 (Empirical) — Data Engine | independent of M1–M6 | CSV upload, validation, provenance handling; Empirical pane sub-architecture mirroring M1. **Producer side of cross-pane coupling:** publishes `SELECTION_CHANGED` (contract 08) on load carrying `substrate_class`; engines honor `substrate_class` / `selection` in the next `STATE_REQUEST` (contract 01 already carries these fields — no new contract). |
| **M-Inversion** | Engine fit module — empirical data → best-fit framework parameters | M6, M7 | Consumes `DataUpload` (contract 05), fits the *amplitudes* (α_s, P_s, chit, γ_AB) via solver `ensemble` + `observables`, emits a parameter-populated `STATE_REQUEST`. Enables **Audit mode**. No new contract — the fit produces a StateRequest the way the slider does. |
| **M8** | Window 3 (Audit) — Audit Engine + Audit Spark Gap | M-Inversion | Four miss categories; common-footing comparison (samples prediction at empirical points; `incompatible_units` guardrail per contract 03); Window 3 sub-architecture; spark-gap visualization between predicted and empirical curves |

### Phase 2 — Navigate mode

Once the audit pipeline is solid: the **Navigate** mode (RFC-S-grounded design-navigation surface). Substrate gamut display, τ_obs camera sweep (watch the substrate flow c→s→r along its RG trajectory; `k_frust` is τ_obs-invariant, so survival of the sweep proves it topological), the five intents as selectable design constraints. Blocked on the auto-remap rule, which RFC-S Appendix B item 1 leaves open — that spec question must close first, likely upstream in `mpa-atlas`.

### Later (existing roadmap items, sequence stable)

Cytoscape operator graph (Operator Graph tab); Observable Plot substrate map (Substrate Map tab); Audit Library + animation; persistence (LocalStorage audit trail); polish + accessibility audit + sonification.

## Session handoff discipline

The principle that makes mid-tier AI maintenance work:

- Each session edits **only** the files listed in its session brief
- Contracts are **immutable**; if a session needs to change one, raise it as a question
- Each session ends with an **acceptance test** that visibly passes
- Each session **logs** what it implemented in `README.md`'s Session Log below
- An agent never modifies the Conductor or another module's files

## Session Log

| # | Date | Session | Result | Notes |
|---|------|---------|--------|-------|
| 0 | 2026-05-13 | Specification | Contracts 01–08 drafted; theme.json; README; session-01 brief | Phase 0 complete |
| 0.1 | 2026-05-13 | Phase 0 refresh | Imbric Systems brand palette (The Void / Stone / Sideris); `design/` folder with `auditor-palette.png`; theme.json expanded with explicit typography/sizes/radii/shadows knobs; README "look is external" section | Driven by user palette and request to make the look-vs-code separation explicit |
| 1 | 2026-05-13 | Shell + Conductor | `index.html`; Conductor (Event Bus + Module Registry); Style Manager (loads `theme.json` → CSS variables); Layout Manager (tabs/slider/mode/theme wiring); `tokens.css`, `shell.css`; 8 engine + renderer stubs; 3 contract-shaped fixtures | CSS placed in `<head>` (not end of body as briefed) to avoid FOUC. `tokens.css` mirrors `theme.json` as FOUC-safe defaults; Style Manager overwrites on load so `theme.json` remains the single source of truth. |
| 1.1 | 2026-05-13 | Shell UI refinement | Tab rename: `Basin / Spray` → `Phase Portrait`, `Audit Gallery` → `Audit Library`. Header `Mode` and `Theme` buttons consolidated into a `Settings` dropdown with segmented controls (no more ghosted-mode appearance). Window-3 placeholder scrubbed of virtue-declaration ("honest gap" → "prediction-vs-data delta"). Local-server one-liner added near top of README. | Driven by user UI review: professional naming, segmented controls so neither toggle option reads as recessed, no declared virtues in display copy. |
| 2+3+4 | 2026-05-13 | Predictions live in Window 1 | **Character Engine** (continuous): chit → regime classification (deep_c / c_near_s / s_critical / r_near_s / deep_r), generates gFDR locus χ(τ) vs C(0)−C(τ), headroom Q, plateau height, α_s, regime equation. **Discrete Engine**: same gFDR locus per regime + toy 4-vertex operator graph + k_frust detection via signed-graph balance (parity of negative edges in the cycle) + operator counts in `discrete_state` for the Operator Graph tab. **Plotly 2D Renderer**: subscribes to `PREDICTION_READY` and `THEME_CHANGED` (contract 07); draws the locus in Window 1 with regime-coloured stroke and equilibrium-FDR reference line; regime badge + KaTeX equation in the prediction-meta strip. Style Manager now publishes full `ThemeBundle` (contract 07) and flattens `regime_palette` to CSS variables. Layout Manager coalesces slider events via `requestAnimationFrame` and exports `fireInitialState()` for a clean first paint. | Sessions 2/3/4 collapsed into one parallel build (user-preferred play). Both engines emit gFDR loci so Window 1 displays both modes from the start; the operator graph itself waits for Cytoscape (Session 8). Plotly + KaTeX loaded via CDN `defer` scripts (no build step). |
| 2.3+3.3+4.3 | 2026-05-13 | mpa-solver v2 vendored · numerical Q/ζ/ω_RO live | v2 of [`mpa-solver`](https://github.com/ronviers/mpa-solver/tree/v2.0.0) shipped (N-mode kernel, non-reciprocal coupling, DynamicBath + Caputo closures, Milstein SDE, gFDR observables module, linearization, OpenMP/SIMD, pybind11 bindings). Re-vendored WASM artifacts (85 KB .wasm; 4 KB wrapper). `math/solver-service.js` now exposes `linearize`, `integrateN`, `ensembleN`, and the `observables` namespace (`correlator`, `responseDirect`, `gfdrLocus`, `fitInvariants`). Both engines call `solver.linearize(finalState, params)` after each `integrate()` to obtain the numerical spectrum at the trajectory's settled state; `Q`, `ζ`, `ω_RO` in the invariants panel now read from the real eigendecomposition instead of an analytical proxy. gFDR observables wiring is intentionally deferred — 200-trajectory ensemble + response takes ~2 s per slider tick, needs debounced async to land cleanly. `window.solver` exposed for console experimentation. | Three v2 math caveats documented in [`vendor/mpa-solver/README.md`](vendor/mpa-solver/README.md): Caputo β=1 short-circuits to Lamb (framework convention); DynamicBath fast-bath limit is structural not byte-exact (single-bath vs per-mode bath math gap); `Q = 0` at unstable points by convention. All three were judgment calls flagged by the v2 build session — accepted as correct. |
| 2.2+3.2+4.2 | 2026-05-13 | mpa-solver wired in · live trajectories | Vendored [`mpa-solver`](https://github.com/ronviers/mpa-solver) WASM artifacts into `vendor/mpa-solver/` (31 KB .wasm + 34 KB embind glue + 1.4 KB JS wrapper). New `math/solver-service.js` singleton lazy-loads the module, exposes `integrate()` / `ensemble()` to engines. Both engines now call `solver.integrate()` per STATE_REQUEST to produce real ODE trajectories from the cdv1 universal two-mode kernel under Lamb stationary closure, attached to `continuous_state.trajectory` / `discrete_state.trajectory`. New **trajectory strip** in Window 1 above the prediction grid plots `ρ_A(t)` (Stone) and `ρ_B(t)` (Sideris) live from the solver's Float64Array output; strip header shows solver wall-clock cost and version. Solver benchmarks: 4.25 ms single trajectory, 3.78 s for 1000-trajectory ensemble — well within slider-scrub frame budget. Analytical FDR locus retained for now; ensemble-derived `C(τ)`, `χ(τ)` is a separate session (needs correlator math in JS). | First time the auditor is doing real numerics, not analytical templates. Slider scrub now drives an actual ODE integration (RK4) in WASM at ~5 ms/call. URL resolution anchored to `document.baseURI` so the solver-service path works regardless of which module imports it. |
| 2.1+3.1+4.1 | 2026-05-13 | Window 1 → framework-state display | Single FDR chart replaced with a multi-panel prediction pane exposing the framework's API surface: (1) **Regime manifold** heatmap over (chit × γ_AB) with regime tinting from `regime_palette`, transcritical (chit=0, laser threshold) and pitchfork (γ=0, cooperative/competitive) bifurcation curves overlaid, **k_frust hatched as actual `×` markers** (visible holes — N≥3 posit-extension in continuous, realized cycle obstruction in discrete), out-of-scope hatched diagonals where the 2-mode kernel breaks down, current operating point as crosshair; **click anywhere to jump there** via `MANIFOLD_PICK` → both sliders update. (2) **gFDR signature** as a sidekick inset for the current point, with y-range adapting to k_frust transient-negative response. (3) **Invariants list** (chit, γ_AB, G₀/L, Q, α_s, P_s, X_c, X_r, V_scalar, ε, β_mem, Wall %) with posit-grade items dashed-bordered and `posit` tagged. (4) **Pattern admissibility** (Hebbian / Independent / Mentor / Lotka–Volterra / Cooperative lock / k_frust / Chimera / Turing / MIPS) — load-bearing vs posit-extension visually distinct. (5) **Active-posits strip** showing which of the five leading-order posits are engaged at this point. Footer gains a **second slider** for γ_AB (Sideris-blue thumb), so both axes are explorable. Engines extended to produce manifold, bifurcation curves, tower/Wall state, invariants array, pattern admissibility, and active-posits within `continuous_state`/`discrete_state` (additionalProperties on those objects per contract 02). | Driven by user push: "we need to get serious" — show phases, topological holes, pattern formation, self-organization. The pane now reads the framework's structure for each (chit, γ_AB) point: regime manifold = phases; k_frust × markers = topological holes; pattern admissibility = which composites are alive here; posits strip = which leading-order assumptions are load-bearing here; bifurcation overlays = stability changes. Contracts unchanged — extensions live inside the `*_state` objects. |

## Naming notes

- The tool is **MPA Auditor**.
- The two modes are **Discrete** (formerly "Structural", maps to v9 operator algebra) and **Continuous** (formerly "Character", maps to cdv1 $\chi$, $Q$, $\mathcal{V}$).
- Where the project's prose elsewhere uses "character" for the framework concept (the chit variable, characteristic dynamics, etc.), that usage stays — we only renamed the *mode label*, not the framework concept.

## License

To be determined. Default assumption: source code under a permissive license (MIT or Apache-2.0); contributed datasets retain their original licenses as declared in their provenance blocks.

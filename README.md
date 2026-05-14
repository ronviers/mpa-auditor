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
| **M6** | gFDR observables wiring | `engines/character-engine.js`, `discrete-engine.js`, `renderers/prediction/displayers/gfdr-signature.js`, `math/ensemble-locus.js`, `math/debounce.js` | M1 | Analytical FDR locus replaced with ensemble-derived; debounced async; "computing..." indicator. **[Landed 2026-05-14 — Session Log M6. Ensemble locus shows in the r/s bands; the cooperative c-band ensemble diverges intrinsically, so it falls back to the analytical locus there — see the M6 log row.]** |

### Other windows + the audit pipeline (sub-architecture pattern propagates)

The audit pipeline has a strict dependency chain: **M6 (gFDR observables) → M7 (Data Engine) → M-Inversion (fit) → M8 (Audit Engine)**. The Inversion Engine scores candidate parameters by comparing the framework's gFDR locus against the empirical one, so it cannot land before M6.

| # | Session | Depends on | What ships |
|---|---|---|---|
| **M7** | Window 2 (Empirical) — Data Engine | independent of M1–M6 | CSV upload, validation, provenance handling; Empirical pane sub-architecture mirroring M1. **Producer side of cross-pane coupling:** publishes `SELECTION_CHANGED` (contract 08) on load carrying `substrate_class`; engines honor `substrate_class` / `selection` in the next `STATE_REQUEST` (contract 01 already carries these fields — no new contract). **[Thin slice landed 2026-05-14 — Session Log MDS: mock-fixture load + cross-pane coupling + a single Window 2 renderer. Still owed: real CSV path; Empirical pane sub-architecture.]** |
| **M-Inversion** | Engine fit module — empirical data → best-fit framework parameters | M6, M7 | Consumes `DataUpload` (contract 05), fits the *amplitudes* (α_s, P_s, chit, γ_AB) via solver `ensemble` + `observables`, emits a parameter-populated `STATE_REQUEST`. Enables **Audit mode**. No new contract — the fit produces a StateRequest the way the slider does. **[Thin slice landed 2026-05-14 — Session Log MDS: chit fit by grid search against the analytical locus. Still owed: ensemble-derived scoring (needs M6); the full α_s / P_s / γ_AB amplitude fit — γ_AB is unconstrained by a gFDR locus, see `docs/rfc-s-integration-notes.md` D1.]** |
| **M8** | Window 3 (Audit) — Audit Engine + Audit Spark Gap | M-Inversion | Four miss categories; common-footing comparison (samples prediction at empirical points; `incompatible_units` guardrail per contract 03); Window 3 sub-architecture; spark-gap visualization between predicted and empirical curves. Persists each `(DataUpload, AuditDelta)` pair — the basic write that M-Corpus builds on. **[Thin slice landed 2026-05-14 — Session Log MDS: full four-category classifier + common-footing comparison + a single Window 3 renderer. Still owed: Window 3 sub-architecture; spark-gap visualization; `(DataUpload, AuditDelta)` persistence; replace leading-order topology / scope heuristics.]** |
| **M-Corpus** | Substrate library — the instrument's accumulating evidence base | M7, M8 | The library that turns the auditor from a demo into a running test of the framework. **Load-bearing for Audit mode's universality check** — "is this substrate's fitted α_s consistent with its universality class?" is impossible without a corpus of prior class members. Two tiers, mirroring RFC-S §5's reference-substrate discipline: a *curated seed corpus* committed to the repo (surface-code QEC, glass relaxation — version-controlled permanent grounding) and a *user-contributed tier* in IndexedDB + JSON export, tier-2 until validated. Drives the Audit Library tab. Feeds back into M-Inversion / M8: the library both stores audit results and supplies the class-comparison baseline for the next audit. No new contract — a `(DataUpload, AuditDelta)` collection, both already contract-shaped. Could become the interactive face of [`mpa-relaxation`](https://github.com/ronviers/mpa-relaxation)'s manually-built substrate corpus rather than rebuilding it. |

### Phase 2 — Navigate mode

Once the audit pipeline is solid: the **Navigate** mode (RFC-S-grounded design-navigation surface). Substrate gamut display, τ_obs camera sweep (watch the substrate flow c→s→r along its RG trajectory; `k_frust` is τ_obs-invariant, so survival of the sweep proves it topological), the five intents as selectable design constraints. Blocked on the auto-remap rule, which RFC-S Appendix B item 1 leaves open — that spec question must close first, likely upstream in `mpa-atlas`.

### Later (existing roadmap items, sequence stable)

Cytoscape operator graph (Operator Graph tab); Observable Plot substrate map (Substrate Map tab); polish + accessibility audit + sonification. (The former "Audit Library + animation" and "persistence" items are subsumed by **M-Corpus** above — persistence is the substrate library's basic write path, and the Audit Library tab is its browser.)

## Session handoff discipline

The principle that makes mid-tier AI maintenance work:

- Each session edits **only** the files listed in its session brief
- Contracts are **immutable**; if a session needs to change one, raise it as a question
- Each session ends with an **acceptance test** that visibly passes
- Each session **logs** what it implemented in `README.md`'s Session Log below
- An agent never modifies the Conductor or another module's files
- Open architectural / design questions that surface mid-session are appended to [`docs/foundational-questions.md`](docs/foundational-questions.md) — so they are not lost between handoffs, and so a foundational session has a real agenda. When a question is resolved, the decision lands in [`docs/foundational-answers.md`](docs/foundational-answers.md) (contract shape, files, what's deferred) and the question gets an `ANSWERED` pointer. The pair are read together at session start: questions for what's still open, answers for the shape constraints on what you build — `foundational-answers.md` is revisable, not frozen

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
| M1 | 2026-05-14 | Predicted-pane sub-architecture refactor | Extracted 7 sub-displayers from `plotly-2d.js` into `renderers/prediction/displayers/`; sub-conductor + sub-layout-manager + view-mode switcher; drop-test confirms M2+ sessions can land new displayers without cross-file edits. | No visual changes; structural foundation for M2-M5. `plotly-2d.js` is now a ~60-line boot shim. Sub-conductor fans `PREDICTION_READY`/`THEME_CHANGED` in from the main bus as `SUB_*` events; `window.predictionSubBus` exposed for console debugging. `regime-manifold` still publishes `MANIFOLD_PICK` directly to the main bus (its consumer, Layout Manager, is a top-level module). Seam call: `meta-strip` carries all three view modes (it hosts the switcher); the other six are `taxonomic`-only — Kinematic/Topological views compose from M3/M5's own displayers. |
| M2 | 2026-05-14 | Cobham Stack + Synchroscope (+ engine extension) | Both engines extended inside `*_state`: `tower.u_per_level` / `tower.W_per_level` (Cobham wait-inflation, cdv1 §Load-handling — `u_n = ε_n` per the optimal-encoding posit, `W_{n+1} = W_0/[(1-u_n)(1-u_{n+1})]`) and a `phase_locking` block (`r`, `K_AB`, `Δω`, lock state, `ψ`; cdv1 §Phase-locking). Two new `taxonomic` displayers: **Cobham Stack** — vertical gauge stack over the 5 heat-tax tower levels, fill = utilisation `u_n`, readout = Cobham wait `W_n`, levels shatter (hatched) as `u → 1`; **Synchroscope** — circular phase-locking dial, needle = phase offset `ψ`, ring arc = Kuramoto `r`, in-phase / anti-phase / drift state. New `.dynamics-strip` below the prediction-grid (`index.html` + `shell.css`). | Combined engine-extension + M2 in one session — user chose the combined path over the M2 handoff's split-session recommendation, since both displayers' data was unbacked by the frozen engines. `Δω` is a fixed substrate-reference detuning: the symmetric kernel has intrinsic `Δω = 0`, so the Synchroscope reads phase-locking *capacity* (Arnold-tongue position), not a measured detuning. Cobham `W_0` normalised to 1 (`½Σλ_i⟨τ_i²⟩` is not derivable from the operating point) — `W_per_level` is read in multiples of baseline. Regression fix: the fixed-height dynamics-strip squeezed the `flex: 1` prediction-grid flat at narrow widths — added a `min-height` floor to `.prediction-grid` and switched `.window-body--prediction` to `overflow-y: auto` (scrolls only when the window is too short; no change at desktop width). Contracts 01/02 untouched — extensions live inside `continuous_state` / `discrete_state`. |
| MDS | 2026-05-14 | Mock-dataset slice — M7 + M-Inversion + M8 (thin, brought forward) | **Data Engine** (stub → real): loads the contract-05 fixture, light-validates, publishes `DATA_READY` + `SELECTION_CHANGED{substrate}`. New **Inversion Engine**: grid-search fits chit to the empirical gFDR locus (against `math/gfdr-model.js`, a new shared analytical forward model) and emits a parameter-populated `STATE_REQUEST` — the Predicted pane self-adapts, and the chit slider syncs to the fit via `layout-manager` (`wireFitSync`). **Audit Engine** (stub → real): full four-category classifier (`incompatible_units` / `posit_grade_pending` / `out_of_scope` / `topological_miss` / `numerical_miss` / `match`) with common-footing comparison (predicted locus sampled at empirical τ), emits `AUDIT_DELTA`. New **Window 2** renderer (mandatory provenance panel + empirical gFDR locus) and **Window 3** renderer (status, primary divergence, recommended-extension / scope-diagnosis, provenance echo). RFC-S tie-in: `docs/rfc-s-integration-notes.md` (7 discoveries) + RFC-S Appendix B item 4 (observable sufficiency). | User chose the deep options (real fit, full classifier) — these are *brought-forward slice versions* of M7 / M-Inversion / M8, **not their full form**. Named limitations: (1) the fit scores against the analytical gFDR locus, not the ensemble-derived one (gated on M6); (2) the gFDR locus depends on chit alone — γ_AB is **unconstrained** by a C(τ)/χ(τ) fit, reported as carried-through (RFC-S discovery D1); (3) topology / out-of-scope tests are leading-order heuristics; (4) Windows 2/3 are single thin renderers, not M1-style sub-architectures; (5) Data Engine loads the mock fixture only — no CSV path. Verified end-to-end in Chrome: load → fit (chit 0→0.15, s_critical) → audit (`topological_miss` — the fixture's diagonal χ-vs-ΔC disagrees with the fitted aging shape). `math/gfdr-model.js` is the canonical analytical forward model; character/discrete engines still carry pre-existing local copies (de-dup is a follow-up). Dev server switched to `http-server -c-1` (no-cache) — `python -m http.server` served stale modules across edits. |
| M6 | 2026-05-14 | gFDR observables wiring + slice-hardening (combined) | **M6:** the Predicted pane's gFDR signature is now ensemble-derived. Both engines paint the analytical locus synchronously for first paint (`*_state.locus_source: 'analytical'`, `ensemble_pending: true`), then — once the operating point settles — run the vendored solver's `ensemble → correlator → responseDirect → gfdrLocus` pipeline (`math/ensemble-locus.js`) and re-emit `PREDICTION_READY` with `locus_points` replaced and `locus_source: 'ensemble'`. Debounced (`math/debounce.js`, 350 ms) onto the settled point; a per-engine generation counter drops superseded ensemble runs (rapid scrub → only the last point computes). `gfdr-signature.js` reports the source in the panel subtitle (`· computing ensemble… / · ensemble / · analytical`). **Slice-hardening (§5 backlog):** (#4) both engines now import `vertexRegime / alphaS / plateauHeight / generateLocus` from the canonical `math/gfdr-model.js` — discrete keeps only its k_frust branch as a documented discrete-mode extension; (#1) engines echo `fit_provenance` / `substrate_class` into `*_state`, and the Audit Engine pairs prediction↔data by `fit_provenance.data_id` (not "latest seen") and ignores M6's follow-up refinements; (#2) the Audit Engine's out-of-scope threshold is now a per-`substrate_class` map (RFC-S §2 gamut stand-in for D3); (#3, thin) engines stamp an explicit `app_mode: 'audit' \| 'explore'`. | The M6 brief assumed "the math is vendored — M6 is just the async wiring." It is not quite that: the solver ships the *raw* correlator + *raw* direct-perturbation response and **deliberately leaves the FDT normalisation to the consumer** — its own `test_gfdr_regimes` comment flags the "1/T_eff factor" as "a downstream calibration concern". `responseDirect` returns the IC-perturbation *propagator* (which decays), not the integrated susceptibility, so the consumer-side construction is the Onsager / Cugliandolo-Kurchan normalisation: `ΔC_norm = ΔC/C(0)`, `χ_norm = 1 − χ/χ(0)` — equilibrium → the diagonal, FDT-violating regimes depart from it. Verified in Chrome: deep_r → clean diagonal, s_critical → aging departure, all bounded in [0,1]. **Known limitation:** the cooperative kernel has an unsaturated `+\|γ\|ρ_Aρ_B` feedback term — it runs away to ∞ deterministically above chit≈1 and the *stochastic ensemble* escapes into that runaway branch even at modest positive chit (incl. the fixture's fitted chit≈0.15). `computeEnsembleLocus` detects the divergence (non-finite C(0)) and throws; the engine catches it and keeps the analytical locus (`ensemble_error` set, subtitle shows `· analytical`). So the ensemble locus shows in the r/s bands; the cooperative c-band honestly falls back. Candidate upstream `mpa-solver` note: the positivity guard clamps ρ<0 but nothing clamps the runaway-positive cooperative branch. Source-confusion cleared: `H:\mpa-solver` **is** at `v2.0.0` (`git describe` confirms) — an earlier truncated dir-listing made it look like v0; the stale `docs/mpa-solver-handoff.md` (v0 build brief) now carries a superseded-banner pointing at `mpa-solver-v2-handoff.md`. Contracts 01/02 untouched — every new field rides `additionalProperties` on `*_state`. Audit cascade regression-free: load → fit → `topological_miss`, same as MDS. |
| 2.1+3.1+4.1 | 2026-05-13 | Window 1 → framework-state display | Single FDR chart replaced with a multi-panel prediction pane exposing the framework's API surface: (1) **Regime manifold** heatmap over (chit × γ_AB) with regime tinting from `regime_palette`, transcritical (chit=0, laser threshold) and pitchfork (γ=0, cooperative/competitive) bifurcation curves overlaid, **k_frust hatched as actual `×` markers** (visible holes — N≥3 posit-extension in continuous, realized cycle obstruction in discrete), out-of-scope hatched diagonals where the 2-mode kernel breaks down, current operating point as crosshair; **click anywhere to jump there** via `MANIFOLD_PICK` → both sliders update. (2) **gFDR signature** as a sidekick inset for the current point, with y-range adapting to k_frust transient-negative response. (3) **Invariants list** (chit, γ_AB, G₀/L, Q, α_s, P_s, X_c, X_r, V_scalar, ε, β_mem, Wall %) with posit-grade items dashed-bordered and `posit` tagged. (4) **Pattern admissibility** (Hebbian / Independent / Mentor / Lotka–Volterra / Cooperative lock / k_frust / Chimera / Turing / MIPS) — load-bearing vs posit-extension visually distinct. (5) **Active-posits strip** showing which of the five leading-order posits are engaged at this point. Footer gains a **second slider** for γ_AB (Sideris-blue thumb), so both axes are explorable. Engines extended to produce manifold, bifurcation curves, tower/Wall state, invariants array, pattern admissibility, and active-posits within `continuous_state`/`discrete_state` (additionalProperties on those objects per contract 02). | Driven by user push: "we need to get serious" — show phases, topological holes, pattern formation, self-organization. The pane now reads the framework's structure for each (chit, γ_AB) point: regime manifold = phases; k_frust × markers = topological holes; pattern admissibility = which composites are alive here; posits strip = which leading-order assumptions are load-bearing here; bifurcation overlays = stability changes. Contracts unchanged — extensions live inside the `*_state` objects. |

## Naming notes

- The tool is **MPA Auditor**.
- The two modes are **Discrete** (formerly "Structural", maps to v9 operator algebra) and **Continuous** (formerly "Character", maps to cdv1 $\chi$, $Q$, $\mathcal{V}$).
- Where the project's prose elsewhere uses "character" for the framework concept (the chit variable, characteristic dynamics, etc.), that usage stays — we only renamed the *mode label*, not the framework concept.

## License

To be determined. Default assumption: source code under a permissive license (MIT or Apache-2.0); contributed datasets retain their original licenses as declared in their provenance blocks.

# MPA Auditor

A browser-based scientific instrument that audits the MPA (Multi-Primitive Architecture) framework's predictions against empirical substrate data. Built as a fully instrumented observatory: three synchronized windows showing what the framework predicts, what the data shows, and — most importantly — the honest gap between them.

## Status

**Phase 0 — Specification complete.** No code yet. Contracts, theme, README, and Session 1 brief drafted.

## What this is

Three windows on every canvas:

1. **Window 1 — Predicted.** The framework's clean prediction. In Continuous mode (formerly "Character"): the Cugliandolo–Kurchan aging diagonal, the smooth Lyapunov surface. In Discrete mode (formerly "Structural"): the operator graph with $k_\text{frust}$ subgraphs highlighted.

2. **Window 2 — Empirical.** Real-world data, with full attribution displayed prominently. Surface-code traces, glass relaxation, active-matter trajectories, neuronal firing — whatever the user uploads.

3. **Window 3 — Delta.** The audit. Where they agree, where they disagree, what kind of disagreement it is, and what framework move (or extension axis, or posit) closes the gap. This is the scientifically load-bearing window.

Plus tabs along the top: gFDR Signatures, Basin/Spray (3D), Operator Graph, Substrate Map, Audit Gallery.

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

**The honest gap is visible.** Out-of-scope regions hatch. Posit-grade predictions dash. $k_\text{frust}$ regions show topological tears in the Lyapunov surface, not smooth extrapolation. Confidence and lack of confidence are equally legible.

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

Loaded via CDN `<script>` tags. No npm, no bundler. The whole project runs by opening `index.html`.

## Roadmap

Twelve sessions, each adding one module. Each session is a fresh Claude context loaded from its session brief.

| # | Session | What gets built | Visible result |
|---|---------|----------------|----------------|
| 0 | **Spec** (this phase) | Contracts, theme, README, session briefs | These documents exist |
| 1 | Shell + Conductor | HTML, Event Bus, Style Manager, all stub files | Webpage with tabs, 3 empty windows, slider, theme toggle |
| 2 | Discrete Engine | Operator algebra, $k_\text{frust}$ detection | Console shows operator-graph JSON |
| 3 | Character Engine | $\chi = \ln(G_0/L)$, headroom, basin scalar | Mode toggle switches engines |
| 4 | Plotly 2D Renderer | gFDR canvas in Window 1 | **First charts**, slider morphs locus |
| 5 | Data Engine | CSV upload, validation, provenance handling | Window 2 populates from real data |
| 6 | Audit Engine | Four miss categories, visualization directives | Window 3 shows the delta — core feature live |
| 7 | Three.js Basin | Lyapunov surface with tears, spray particles | Basin/Spray tab works |
| 8 | Cytoscape Graph | Operator graph synced to Window 1 | Operator Graph tab works |
| 9 | Substrate Map | Observable Plot 2D substrate map | Substrate Map tab works |
| 10 | Gallery + Animation | "Famous wrongs" gallery, fraying playback | Animation play button |
| 11 | Persistence | LocalStorage audit trail, JSON exports | Every audit becomes a permanent entry |
| 12 | Polish + Falsifier Badges | KaTeX everywhere, accessibility audit, sonification | The instrument is mature |

Sessions 1–6 give you a working scientific instrument. Sessions 7–12 build the full observatory.

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
| 1 | _pending_ | Shell + Conductor | _not yet built_ | Waiting for go-ahead |

## Naming notes

- The tool is **MPA Auditor**.
- The two modes are **Discrete** (formerly "Structural", maps to v9 operator algebra) and **Continuous** (formerly "Character", maps to cdv1 $\chi$, $Q$, $\mathcal{V}$).
- Where the project's prose elsewhere uses "character" for the framework concept (the chit variable, characteristic dynamics, etc.), that usage stays — we only renamed the *mode label*, not the framework concept.

## License

To be determined. Default assumption: source code under a permissive license (MIT or Apache-2.0); contributed datasets retain their original licenses as declared in their provenance blocks.

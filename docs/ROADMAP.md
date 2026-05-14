# Roadmap — mpa-auditor

**The plan.** This is the authoritative forward-looking roadmap. It is *edited in place* — a session flips its row from planned to landed; it is not regenerated.

It is one of four session-continuity documents. A session reads all four at start:

| Document | Role | Lifecycle |
|---|---|---|
| **`docs/ROADMAP.md`** (this file) | The **plan** — what is built, what is next, in what order. | Stable; edited in place. |
| **`README.md` → `## Session Log`** | The **history** — one row per session, what shipped. | Append-only; never rewritten. |
| **`docs/foundational-questions.md` + `foundational-answers.md`** | The **shape constraints** — what each thing must look like (contract shape, file locations), and the open architectural questions. *Not* the sequence. | Append + correct. |
| **`docs/next-session-handoff.md`** | The **baton** — a fresh slice of the three above plus the immediate next-step detail. | The only regenerated, disposable document; rewritten every session. |

The handoff's *recommended next pick* is always confirmed with the user before scoping — that confirmation is the human backstop against roadmap drift.

---

## Status (2026-05-14)

**The audit pipeline is complete end to end.** The dependency chain was M6 → M7 → M-Inversion → M8; all four links shipped. The cascade `FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA → (Window 3 render + IndexedDB persist)` runs verified in Chrome.

**Next up: M-Corpus** — the typed substrate-library manifest. It is unblocked (it needed M7 + M8) and it is the visible payoff of the whole typed-structure effort: the auditor stops *showing* predictions and becomes a running test of the framework's API surface.

---

## Done

The detailed per-session record is `README.md` → `## Session Log`. Condensed:

| Phase | Sessions | Result |
|---|---|---|
| Phase 0 | 0, 0.1 | Contracts 01–08, `theme.json`, Imbric Systems palette, session briefs |
| Shell | 1, 1.1 | Conductor (event bus + module registry), Style/Layout managers, page chrome, Settings dropdown |
| Engines + first renderer | 2+3+4, 2.1+3.1+4.1 | Both engines; Window 1 framework-state display (regime manifold, invariants, patterns, posits) |
| Solver | 2.2+3.2+4.2, 2.3+3.3+4.3 | `mpa-solver` v0 → v2 vendored; real ODE trajectories, numerical Q / ζ / ω_RO from eigendecomposition |
| M1 | M1 | Predicted-pane sub-architecture (`renderers/prediction/`) — 7 sub-displayers, sub-conductor, drop-test |
| M2 | M2 | Cobham Stack + Synchroscope displayers; engine `tower` + `phase_locking` blocks |
| MDS | MDS | Mock-dataset slice — thin brought-forward M7 + M-Inversion + M8 |
| M6 | M6 | gFDR observables ensemble-derived; `math/ensemble-locus.js`, `math/debounce.js`; slice-hardening #1–4 |
| M-Inversion proper | M-Inversion proper | Two-stage chit fit (analytical localise → ensemble refine), phase-locking γ_AB fit, framework-consistent fixture |
| M7 proper | M7 proper | Real CSV ingestion (PapaParse), per-column metadata (§Q1), declaration-first gap-detection (§Q9), Empirical-pane sub-architecture, `tier` / `validation` (§Q3+Q5) |
| M8 proper | M8 proper | Window 3 sub-architecture, spark-gap visualization, audit domain + `silenced_regions` (§Q4), `(DataUpload, AuditDelta)` IndexedDB persistence, slot-aware readings (§Q6), tier + declaration-trail echo |
| Q11 tidy | Q11 tidy | Contracts schema-authoritative (§Q11); contracts 03/05 top-level extension surface opened; `version_context` grading stamp (§Q10) |

### The three Predicted-pane modes

The Predicted pane answers three different researcher questions — distinct modes, built in sequence:

| Mode | Question | Status |
|---|---|---|
| **Explore** | "What does the framework predict at parameters X?" — free-dial chit / γ_AB, no data needed. | **Done** — exists today. |
| **Audit** | "What does the framework predict for *this* substrate, and what is the irreducible residual?" — parameters locked to the best-fit of loaded empirical data, so the gap is attributable to the framework, not to dialing. | **Done** — the M-Inversion → M8 pipeline. The audit's teeth are in the *partial* fit: amplitudes (α_s, P_s, chit, γ_AB) are fit; structural predictions and cross-register identities are checked against the fitted values, never fit. |
| **Navigate** | "Given this substrate, what is my navigable design space — where does tuning end and redesign begin?" — fitted operating point inside the substrate's *gamut* (RFC-S §2), τ_obs as a camera (RFC-S §1), the five intents (RFC-S §3) as design constraints. | **Phase 2** — see below. |

---

## Next up

### M-Corpus — the typed substrate-library manifest *(recommended next)*

**Depends on:** M7 + M8 (both done). **Unblocked.**

The library that turns the auditor from a demo into a running test of the framework. M-Corpus is a *typed manifest* (`foundational-answers.md` §Q6), not a flat list — Substrate-Class × Substrate-Instance × API-Slot, derived from cdv1's *"API surface, not closed theory"* framing (~20 coupling-parameter slots, each a posited functional form + a sharp falsifier). Load-bearing for Audit mode's universality check ("is this substrate's fitted α_s consistent with its universality class?" — impossible without a corpus of prior class members).

Two tiers, mirroring RFC-S §5's reference-substrate discipline: a *curated seed corpus* committed to the repo (version-controlled permanent grounding) and a *user-contributed tier* in IndexedDB + JSON export, tier-2 until validated. Drives the Audit Library tab. No new contract — a `(DataUpload, AuditDelta)` collection, both already contract-shaped; the `audit-store` IndexedDB write (M8) is the basic write it builds on.

**Prerequisite — an API-manifest curation session** (§11): extract `corpus/api-manifest.json` + `corpus/substrate-classes.json` from cdv1 §"Open items". The natural collapse-bundle is curation + M-Corpus proper. M-Inversion proper's `fit_provenance` and M8's `slot_context` / `slot_reading` are already the slot-aware hooks M-Corpus reads.

The detailed brief is in `docs/next-session-handoff.md` §4.

### M3 / M4 / M5 — dynamics visualization

Independent of the audit pipeline, parallelizable, "show" not scientifically load-bearing. Each owns its file set so they fan out from M1.

| # | Session | Files owned | What ships |
|---|---|---|---|
| **M3** | Ignition + Fraying Detonation | `renderers/prediction/displayers/ignition-control.js`; engines gain streaming-trajectory mode | "Ignite" button replays cold-start dynamics; "Run Fraying" plays the c→s→r collapse sequence as a ~10-second movie |
| **M4** | Caputo Ghost Trails | `renderers/prediction/displayers/ghost-trails.js`; engines select Caputo closure in s-band | Memory-kernel-driven afterimages on the trajectory strip; s-regime aging visible as a smeared wake |
| **M5** | Three.js Phase Portrait | `renderers/prediction/displayers/basin-3d.js`; GLSL shaders; Drain Whirlpool particle system; Flicker Shader bloom | Topological view: 3D Lyapunov surface with k_frust as actual geometric tears; viewport tumbling; particle trajectory spray |

### §12 — About panel + Check-for-update

The first concrete instance of §11's scoping discipline (`foundational-answers.md` §12). `renderers/about-panel/` + `check-update.js` + a generated `build-info.js` + `scripts/generate-build-info.js`. Renderer-territory plus new build tooling; self-contained, small-to-medium.

### Smaller owed items

Tracked in `docs/next-session-handoff.md` §5; can fold into a session or stand alone:
- **Topology shape-class test** — still leading-order; M8 sharpened the out-of-scope test but the topology classifier needs cdv1's gFDR shape catalogue (M-Corpus's posited-forms *are* that catalogue).
- **The double-audit** — the Audit Engine emits two `AUDIT_DELTA`s per load (pre-existing); M-Corpus dedups at read time, or a session debounces the engine.
- **Q8 conditioning-detection** — `foundational-answers.md` §Q8; the conditioning-carrying `fitted_params` object is the forward shape.
- **Full α_s / P_s amplitude fit** — M-Inversion proper fit chit + γ_AB only.
- **D4 — audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; the full version is M1-territory.
- **#5 — name the implicit inversion intent** — the Inversion Engine minimises L2 locus residual, an unnamed RFC-S §3 intent.

---

## Phase 2 — Navigate mode

Once the audit pipeline is solid (it now is): the **Navigate** mode — an RFC-S-grounded design-navigation surface. Substrate gamut display, τ_obs camera sweep (watch the substrate flow c→s→r along its RG trajectory; `k_frust` is τ_obs-invariant, so survival of the sweep proves it topological), the five intents as selectable design constraints. **Blocked on the auto-remap rule**, which RFC-S Appendix B item 1 leaves open — that spec question must close first, upstream in `mpa-atlas`.

---

## Later

Cytoscape operator graph (Operator Graph tab); Observable Plot substrate map (Substrate Map tab); polish + accessibility audit + sonification. (The former "Audit Library + animation" and "persistence" roadmap items are subsumed by M-Corpus — persistence is the substrate library's basic write path, the Audit Library tab is its browser.)

---

## Ecosystem questions (tracked, not scheduled)

Open architectural questions about the auditor's place in the wider `mpa-*` ecosystem — tracked in `docs/foundational-questions.md`, to be resolved before the work they gate:

- **Q12** — does `mpa-central`'s characterized substrate library become the auditor's curated seed corpus (via a curation session, across the §11 file-import boundary)?
- **Q13** — does the auditor's inversion fit produce / consume RFC-C calibration records (a producer/consumer seam with `mpa-view`, neither instrument embedded in the other)?

Both bear on M-Corpus's seed-corpus sourcing and `fit_provenance`'s forward shape — worth a foundational read before or alongside M-Corpus.

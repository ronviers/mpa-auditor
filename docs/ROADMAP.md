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

## Status (2026-05-15)

Audit pipeline complete end to end (M6 → M7 → M-Inversion → M8). API manifest curated — 22 slots × 12 classes at `corpus/`.

**Operating commitments** (motivation lives in `docs/foundational-answers.md`; not re-explained here):

- **The auditor assumes perfect data.** Data-prep is `mpa-conform`'s concern (sibling repo).
- **Ingestion contract: `declaration_bundle.json` only.** No raw-CSV path.
- **Audit runs forward-only.** No backward-map inversion.
- **`fit_provenance` is the calibration artifact.** No RFC-C records produced or consumed.

Recommended next on the auditor side: **M-Corpus proper**. The `mpa-conform` fork is its own thing — see `docs/mpa-conform-bootstrap.md`.

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
| API-manifest curation | API-manifest curation | `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes); cdv1 §"Open items" + receipts §"Substrate-instancing claims" extraction; cross-references symmetric (no orphans). Per `foundational-answers.md` §§Q6 / §§11 |

### The three Predicted-pane modes

The Predicted pane answers three different researcher questions — distinct modes, built in sequence:

| Mode | Question | Status |
|---|---|---|
| **Explore** | "What does the framework predict at parameters X?" — free-dial chit / γ_AB, no data needed. | **Done** — exists today. |
| **Audit** | "What does the framework predict for *this* substrate, and what is the irreducible residual?" — parameters locked to the best-fit of loaded empirical data, so the gap is attributable to the framework, not to dialing. | **Done** — the M-Inversion → M8 pipeline. The audit's teeth are in the *partial* fit: amplitudes (α_s, P_s, chit, γ_AB) are fit; structural predictions and cross-register identities are checked against the fitted values, never fit. |
| **Navigate** | "Given this substrate, what is my navigable design space — where does tuning end and redesign begin?" — fitted operating point inside the substrate's *gamut* (RFC-S §2), τ_obs as a camera (RFC-S §1), the five intents (RFC-S §3) as design constraints. | **Phase 2** — see below. |

---

## Next up

### M-Corpus proper — the typed substrate-library manifest *(recommended next)*

**Depends on:** M7 + M8 (both done) + API-manifest curation (done 2026-05-15). **Fully unblocked.**

The library that turns the auditor from a demo into a running test of the framework. M-Corpus is a *typed manifest* (`foundational-answers.md` §Q6), not a flat list — Substrate-Class × Substrate-Instance × API-Slot. The manifest and class registry are now committed at `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes). Load-bearing for Audit mode's universality check ("is this substrate's fitted α_s consistent with its universality class?" — impossible without a corpus of prior class members).

Two tiers, mirroring RFC-S §5's reference-substrate discipline: a *curated seed corpus* committed to the repo (version-controlled permanent grounding) and a *user-contributed tier* in IndexedDB + JSON export, tier-2 until validated. Drives the Audit Library tab. No new contract — a `(DataUpload, AuditDelta)` collection, both already contract-shaped; the `audit-store` IndexedDB write (M8) is the basic write it builds on.

**Now to build:** `engines/corpus-engine.js` (loads manifest + classes at init, exposes lookup / slot-coverage queries / tier-gated aggregation reading `audit-store`), and the Audit Library tab `renderers/audit-library/` (the slot × instance matrix). M-Inversion proper's `fit_provenance` and M8's `slot_context` / `slot_reading` are already the slot-aware hooks M-Corpus reads.

The detailed brief is in `docs/next-session-handoff.md` §4.

### Bundle-import migration — switch Window 2 to declaration-bundle-only ingestion

**Blocked on:** `mpa-conform` shipping its first signed `declaration_bundle.json`.

Switch the auditor's ingestion contract to bundle-only. M7 proper's data-prep half (CSV parsing in `upload-control.js`, gap detection in `data-engine.js`, the gap-prompt loop, declaration-form UI) becomes dead code and is removed. The display half (`provenance-panel.js`, `empirical-locus.js`, `data-summary.js`, tier badge) stays — it renders bundle contents.

Files: `renderers/empirical/displayers/upload-control.js` (rewrite to bundle import), `renderers/empirical/displayers/gap-prompt.js` (delete), `engines/data-engine.js` (replace CSV ingestion + gap-detection paths with bundle validation), `index.html` (drop-zone copy update). Sub-architecture stays.

Schema: validate against `mpa-conform/schema/declaration-bundle.v0.1.json` (versioned by `mpa-conform`; the auditor consumes per the declared schema version).

### (c) Forward-translation-field projection at sweep time

**Blocked on:** `mpa-conform` shipping its first driver profile (curator path's first deliverable).

Wire the Inversion Engine's sweep loop to read `driver_profile.translation_field` from the corpus when the declared substrate-class has one. Identity fallback for `unclassified` and substrates without a profile (today's implicit behaviour).

Files: `engines/inversion-engine.js` (per-candidate projection step in the sweep loop), `engines/corpus-engine.js` (expose `getDriverProfile(classId)`).

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

## Ecosystem — resolved questions

Q12 + Q13 ANSWERED (2026-05-14). Auditor-facing commitments inherited from these, already restated under *Status*: audit forward-only, ingestion bundle-only, `fit_provenance` is the calibration artifact, no RFC-C records.

Motivation, full architecture, and the `mpa-atlas` recommendation (fold RFC-C into RFC-S §4) live in `docs/foundational-answers.md` §Q12 / §Q13. Not re-explained here.

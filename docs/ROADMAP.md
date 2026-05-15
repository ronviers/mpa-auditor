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

**The audit pipeline is complete end to end.** The dependency chain was M6 → M7 → M-Inversion → M8; all four links shipped. The cascade `FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA → (Window 3 render + IndexedDB persist)` runs verified in Chrome.

**API-manifest curated (2026-05-15).** `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes) committed, extracted per `foundational-answers.md` §§Q6 / §§11 from cdv1 §"Open items" + cdv1_receipts.md §"Substrate-instancing claims." Bidirectionally cross-referenced; zero asymmetry, zero orphans.

**Architectural decision (2026-05-15): `mpa-conform` sibling repo.** The conform tool §Q12 names gets its concrete home — a sibling to `mpa-auditor`, `mpa-solver`, `mpa-atlas`. Two paths through one repo: curator (grind cells → driver profiles + DataUploads → committed seed-corpus) and researcher (raw data → signed `declaration_bundle.json` → auditor imports). **Singular data-prep path: the auditor accepts declaration bundles only — no raw-CSV ingestion exists or will exist.** Clean data = zero-length traversal through `mpa-conform`; messy data = LLM-assisted prep. `mpa-conform` is agentic; `mpa-auditor` stays pure-static. Bootstrap brief at `docs/mpa-conform-bootstrap.md`; foundational doc at `foundational-answers.md` §Q12 correction note (2026-05-15).

**Two parallel tracks now live:**

- **M-Corpus proper** *(mpa-auditor)* — `engines/corpus-engine.js` + Audit Library tab; reads the manifest committed 2026-05-15 + the `audit-store` IndexedDB writes. Fully unblocked.
- **`mpa-conform` bootstrap** *(new repo)* — repo creation + curator-path post-processor as the first concrete deliverable. Pre-requisite for any researcher upload work beyond MDS fixtures.

Both are next-up; either can run first or they can be parallelised (independent codebases).

**Foundational (2026-05-14):** Q12 + Q13 resolved (docs-only). The load-bearing decision: **the audit runs forward-only** — MPA projects its prediction into the researcher's native coordinates and correlates there (matched-filter, not heterodyne down-conversion); the ill-posed backward map is never invoked. RFC-C dissolves into RFC-S §4, and the substrate library is built by a curation session. See *Ecosystem questions* below and `docs/foundational-answers.md` §Q12 / §Q13.

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

### `mpa-conform` bootstrap *(new sibling repo — parallel track to M-Corpus proper)*

**Depends on:** nothing on the auditor side; the architecture decision (`foundational-answers.md` §Q12 correction note, 2026-05-15) is the only prerequisite. **Unblocked.**

A sibling repo to `mpa-auditor`, `mpa-solver`, `mpa-atlas`. The conform tool §Q12 names — until now nothing but a hand-wave; now a real address. Two paths through one repo:

- **Curator path** — reads `mpa-central/library/*.json` grind cells + cdv1 substrate-conditional rules → produces driver profiles (RFC-S §4 shape) + per-cell DataUploads (contract-05 shape) → commits to `mpa-auditor/seed-corpus/` via PR. The first concrete deliverable.
- **Researcher path** — ingestion porch for raw researcher data → signed `declaration_bundle.json` the researcher imports into the auditor. LLM-assisted: unit normalisation, column disambiguation, ẋ-choice menu, substrate-class inference, windowed-correlator over raw time-series. May vendor its own MCP server. Agentic; the auditor stays pure-static.

The bootstrap brief at `docs/mpa-conform-bootstrap.md` is the fork-point handoff: scope, first-session deliverable, contract with the auditor, what depends on it.

**Why this is its own track:** the auditor currently survives MDS fixtures end to end and the M-Corpus engine has manifest + class registry to consume. Real researcher uploads cannot land until `mpa-conform` exists. M-Corpus proper and `mpa-conform` bootstrap are independent codebases on independent rails; either can be next, or they can run in parallel.

### Forward-only audit data path — the two gaps `mpa-conform` and `mpa-auditor` share

The forward-only architecture (§Q13) cleanly factors into two missing implementation pieces. Naming both here so neither drifts.

| Gap | What | Where it lives |
|---|---|---|
| **(a) Windowed-correlator** | Raw time-series → empirical (τ, C(τ), χ(τ)) family across τ_obs windows. Substrate-neutral signal processing — same math as the grind's `multi_window_fdr_iter` minus the simulation. | `mpa-conform` (researcher path runs it before signing the bundle; curator path runs it over grind cells). The auditor never runs it — declaration bundles arrive with canonical (τ, C, χ) already extracted. |
| **(c) Forward-translation-field projection at sweep time** | At each canonical (chit, γ_AB) candidate, project through the substrate-class's forward translation field to produce a prediction in the researcher's observation coordinates. Today the inversion engine implicitly assumes identity (works for canonical-FDR fixtures, breaks for substrate-native uploads). | `mpa-auditor`'s Inversion Engine — reads `driver_profile.translation_field` from the corpus when the declared class has one; falls back to direct `math/gfdr-model.js` call for `unclassified` and substrates without a driver profile (today's behaviour). |

(b) — the canonical (chit, γ_AB) sweep — already exists in M-Inversion proper. Not a gap.

The user-facing **data-prep phase** (click `Import bundle` → empirical pane settled → trigger sweep) lives entirely in `mpa-conform`; the auditor's contribution to data-prep shrinks to "validate bundle signature, render contents." Window 2's gap-prompt / declaration-form machinery migrates to `mpa-conform` when the new repo lands.

### M-Corpus proper — the typed substrate-library manifest *(recommended next on the mpa-auditor side)*

**Depends on:** M7 + M8 (both done) + API-manifest curation (done 2026-05-15). **Fully unblocked.**

The library that turns the auditor from a demo into a running test of the framework. M-Corpus is a *typed manifest* (`foundational-answers.md` §Q6), not a flat list — Substrate-Class × Substrate-Instance × API-Slot. The manifest and class registry are now committed at `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes). Load-bearing for Audit mode's universality check ("is this substrate's fitted α_s consistent with its universality class?" — impossible without a corpus of prior class members).

Two tiers, mirroring RFC-S §5's reference-substrate discipline: a *curated seed corpus* committed to the repo (version-controlled permanent grounding) and a *user-contributed tier* in IndexedDB + JSON export, tier-2 until validated. Drives the Audit Library tab. No new contract — a `(DataUpload, AuditDelta)` collection, both already contract-shaped; the `audit-store` IndexedDB write (M8) is the basic write it builds on.

**Now to build:** `engines/corpus-engine.js` (loads manifest + classes at init, exposes lookup / slot-coverage queries / tier-gated aggregation reading `audit-store`), and the Audit Library tab `renderers/audit-library/` (the slot × instance matrix). M-Inversion proper's `fit_provenance` and M8's `slot_context` / `slot_reading` are already the slot-aware hooks M-Corpus reads.

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

## Ecosystem questions — resolved 2026-05-14

Q12 and Q13 (the auditor's place in the wider `mpa-*` ecosystem) were resolved in a foundational session. Both are `ANSWERED` in `docs/foundational-questions.md`; the decisions are in `docs/foundational-answers.md` §Q12 / §Q13.

- **Q12** — `mpa-central`'s library *and* published datasets become the seed corpus, built by a curation session (§11). Conform = characterization producing the RFC-S §4 driver profile; the auditor never runs the grind. One tool, two operators (curator → committed; researcher → signed declaration bundle).
- **Q13** — RFC-C dissolves into RFC-S §4; the auditor's **forward-only** fit is the operative calibration. `fit_provenance` is the artifact — it does not converge toward an RFC-C record shape.

**The load-bearing architectural decision: the audit runs forward-only.** MPA projects into the researcher's native coordinates and correlates there (matched-filter, not heterodyne down-conversion); the ill-posed backward map (substrate-native → canonical) is never invoked. The forward map is well-posed; the backward map is where Q8 conditioning, RFC-S Appendix B item 4, and rank-deficiency all live. M-Inversion proper's analytical-localise → ensemble-refine already implements this — the pivot is a commitment, not a rewrite. Consequences: M-Corpus's canonical parameters come from the **forward-sweep search index** (not from inverting data); the conform tool builds only the **forward half** of the translation field; Q8 conditioning is recharacterized as a visible residual-landscape feature, not an inversion-instability problem; and **scale management (τ_obs) is logically prior to the forward projection** — τ_obs is a declared observer-fact that selects the canonical frame, not a swept substrate-unknown (`foundational-answers.md` §Q13, "Order of operations").

An `mpa-atlas` recommendation — fold RFC-C into RFC-S §4, re-point §4's per-experiment level to forward-projection-comparison, relocate the measurement rituals to `reference-drivers/` — is logged in `foundational-answers.md` §Q13. It routes through the §11 → RFC-S Appendix B pipeline, *not* an auditor-side edit; it awaits a deliberate `mpa-atlas` session.

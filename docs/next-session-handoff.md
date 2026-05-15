# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes the post-API-manifest-curation handoff.

**First move:** confirm the next-session pick with the user (§3). The repo now sits at a junction — two parallel tracks are unblocked, and a third "fork" option creates a sibling repo entirely. The rest of this brief details each.

**Before scoping anything:** read `foundational-answers.md` §11 — the scoping discipline. The auditor consumes static outputs of agentic and curation processes; it does not host them. The §Q12 correction note (2026-05-15) makes this concrete by naming `mpa-conform` as the sibling repo that owns agentic data-prep work. The auditor stays pure-static; raw researcher data never crosses the file-import boundary.

**Also read `foundational-answers.md` §Q12 (with correction note) + §Q13:** the audit runs **forward-only**, scale management is *logically prior* to the forward projection (τ_obs is a declared observer-fact, not a swept substrate-unknown), and **the singular data-prep path is `mpa-conform`** — the auditor accepts `declaration_bundle.json` and only that.

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight JSON contracts in `/contracts/` — schema files are authoritative. Each contract has a designated extension surface; build sessions ride extension surfaces, never edit contracts.

**The audit pipeline is complete end to end.** The cascade `FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA → (Window 3 render + IndexedDB persist)` runs verified in Chrome for MDS fixtures.

**The API manifest is curated.** `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes) committed. Bidirectionally cross-referenced; zero asymmetry, zero orphans. M-Corpus proper now reads these.

**The `mpa-conform` architectural decision (2026-05-15)** — docs-only, no code:
- The conform tool (§Q12) gets a real home as a sibling repo to `mpa-auditor`, `mpa-solver`, `mpa-atlas`.
- Two paths through one repo: **curator** (grind cells → driver profiles + DataUploads → committed seed-corpus) and **researcher** (raw data → signed `declaration_bundle.json` → auditor imports).
- **Singular data-prep path**: the auditor accepts declaration bundles only. No raw-CSV ingestion exists or will. Clean data is a zero-length traversal through `mpa-conform`; messy data is the same path with LLM-assist. No second rail.
- `mpa-conform` is agentic (LLM, MCP server-vendoring possible); `mpa-auditor` stays pure-static. File-import boundary preserved.
- Bootstrap brief: [`docs/mpa-conform-bootstrap.md`](mpa-conform-bootstrap.md) (self-contained; fresh session for kicking off the repo can read it cold).

**Shipped (most recent first):**
- **`mpa-conform` decision** *(this session, docs-only)* — foundational-answers §Q12 correction note; ROADMAP sibling-repo + data-path gaps section; README scoping-discipline + Session Log row; this handoff regenerated; `mpa-conform-bootstrap.md` written.
- **API-manifest curation** *(prior session, commit `332b3b4`)* — `corpus/api-manifest.json` + `corpus/substrate-classes.json` extracted from cdv1 §"Open items" + receipts §"Substrate-instancing claims."
- **Foundational Q12+Q13** *(commit `3ebfca0`)* — RFC-C dissolution; forward-only audit architecture.
- **Q11 tidy** *(commit `fdbaf71`)* — contracts schema-authoritative; `version_context` grading stamp.
- **M8 proper** *(commit `3e87562`)* — Window 3 sub-architecture; audit domain + slot-aware readings; IndexedDB persistence.
- **M7 proper** *(commit `7f44f45`)* — CSV ingestion, declaration-first gap-detection, Empirical sub-architecture, tier + validation.
- *(earlier: M-Inversion proper, M6, MDS, M1/M2, engines, shell — see Session Log in `README.md`.)*

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

**The two load-bearing data-path gaps (per §Q13's forward-only architecture):**
- **(a) Windowed-correlator** — raw time-series → empirical (τ, C, χ) family across τ_obs windows. **Routed to `mpa-conform`** (researcher path runs it before signing the bundle; curator path runs it over grind cells). The auditor never runs it.
- **(c) Forward-translation-field projection at sweep time** — at each candidate (chit, γ_AB), project through `driver_profile.translation_field` to predict the observable in the researcher's coordinates. **Stays in `mpa-auditor`** — part of the sweep, not data-prep. Today the Inversion Engine assumes identity (works for canonical-FDR fixtures, breaks for substrate-native).

---

## 2. The roadmap, honestly

The audit pipeline is **done**. The API manifest is **curated**. Two tracks are now live:

- **`mpa-auditor` track** — M-Corpus proper (engine + Audit Library tab reading the manifest); plus the (c) forward-translation-field projection at sweep time when needed.
- **`mpa-conform` track** — new sibling repo, bootstrap session creates it + ships the curator-path post-processor as the first concrete deliverable. The (a) windowed-correlator lives here.

The tracks are **independent codebases on independent rails**. Either can be next; they can be parallelised. Smaller items (M3/M4/M5, §12 About panel, Q8 conditioning-detection) remain owed; none of them are unblocking real research uploads.

---

## 3. Pick the next session

| Option | Repo | What it is | Why / why not |
|---|---|---|---|
| **`mpa-conform` bootstrap** *(fork)* | new repo `H:\mpa-conform` | Create the sibling repo. Scaffold: README, CLAUDE.md, foundational-answers / questions stubs, scoping-discipline note pointing back to the auditor's §11. First concrete deliverable: the **curator-path post-processor** reading `mpa-central/library/*.json` grind cells → emitting driver profiles + per-cell DataUploads → committed to `mpa-auditor/seed-corpus/` via PR. Brief: [`docs/mpa-conform-bootstrap.md`](mpa-conform-bootstrap.md). | Unblocks every researcher-facing audit beyond MDS fixtures. The architectural decision is made; the repo is overdue. Best taken by a fresh session in the new repo (the brief is self-contained for that). |
| **M-Corpus proper** *(auditor recommended)* | `mpa-auditor` | `engines/corpus-engine.js` + Audit Library tab `renderers/audit-library/`. Reads `corpus/api-manifest.json` + `corpus/substrate-classes.json` (committed 2026-05-15) + `audit-store` IndexedDB writes. | The visible payoff of the typed-structure effort on the auditor side. Independent of `mpa-conform` — works against existing MDS fixtures. Mid-sized session; can run in parallel with the conform-bootstrap session in another repo. |
| M-Corpus engine only | `mpa-auditor` | Just `engines/corpus-engine.js` + `window.corpusEngine`. Defer the Audit Library tab. | Smaller, de-risks the engine. Defers the user-visible payoff. |
| (c) forward-translation-field projection | `mpa-auditor` | Wire the Inversion Engine's sweep loop to read `driver_profile.translation_field` from the corpus when available; identity fallback for `unclassified`. | Worthwhile but blocked on `mpa-conform` having shipped at least one driver profile to be useful. Pre-emptive implementation is acceptable (the identity fallback exists today) but doesn't move the needle until conform lands. |
| §12 About panel | `mpa-auditor` | `renderers/about-panel/` + `check-update.js` + generated `build-info.js` + `scripts/generate-build-info.js`. First concrete instance of §11. | Self-contained, small-to-medium, renderer + build tooling. Good if you want a clean bounded session. |
| Q8 conditioning-detection | `mpa-auditor` | `degenerate_r_band` / `saturated_cooperative` / `non_monotonic_sliver` detection at fit time; enrich `fit_provenance.fitted_params` from flat strings to the conditioning object (§Q8). | Small; pairs naturally with M-Corpus. |

The user's pattern is to collapse sequential sessions when they share momentum. The two top rows are *independent repos* — running them in parallel is the natural play. If you'd rather sequence, the fork session is the more upstream-critical track (research uploads are blocked on it).

---

## 4. Detailed brief — M-Corpus proper

[unchanged from previous handoff — included verbatim for self-containedness]

**Read first.** `foundational-answers.md` §Q6 (the typed manifest), §Q3+Q5 (tier gates aggregation, not audit), §Q10 + correction note (`version_context` grading stamp), §Q11 (schema-authoritative), §11 + §Q12 correction note (curation-session discipline; `mpa-conform` is the home for future curation work, but the manifest is already on disk).

**Inputs (already committed, do NOT re-extract).**
- `corpus/api-manifest.json` — 22 slot entries. Each: `{ id, name, cdv1_ref, receipts_ref, observable, posited_form, falsifier, applicable_classes }`.
- `corpus/substrate-classes.json` — 12 class entries. Each: `{ id, name, cdv1_refs, v9_refs, class_conditions[{statement, falsifier}], applicable_slots, gamut, examples }`.
- Cross-references bidirectionally consistent.

**The M-Corpus engine.**
1. `engines/corpus-engine.js` — module + singleton. At init: fetch the two corpus JSONs, store as in-memory maps keyed by id. Expose `getSlot(id)` / `getClass(id)` / `listSlots()` / `listClasses()`, `getSlotsForClass(classId)` / `getClassesForSlot(slotId)`, `aggregateByClass(classId, { includeUserTier = false })` reading `window.auditStore.list()`. Expose `window.corpusEngine`.
2. Subscribe to audit-store updates if a reactive surface is needed, otherwise poll-on-render.

**The Audit Library tab.**
3. `renderers/audit-library/` — sub-architecture if it gets thick (mirror M1 / M7 / M8). API-manifest-rows × substrate-instance-columns matrix grouped by class. Each cell: an `AuditDelta` with slot-aware category. Empty cells = no instance covers this slot for this class. Tier badge on each cell; user-tier excluded from class aggregation by default, toggle to include.
4. Tab wiring: the `Audit Library` tab already exists in `index.html`; bind into the existing tab structure. M1's `renderers/prediction/` is the architectural template.

**Watch.** The `audit-store` persists **two** records per fixture/CSV load — pre-existing double-audit. M-Corpus must dedup by `(data_id, latest timestamp)` at read time.

**Watch 2.** `fit_provenance.substrate_class_id` currently defaults to `'unclassified'`. Until `mpa-conform` lands and bundles carry declared substrate-classes, aggregation queries will return empty results for user uploads. M-Corpus surfaces this honestly — empty cells are legitimate.

**Files likely owned:** `engines/corpus-engine.js` (new), `renderers/audit-library/**` (new), thin wiring in `index.html` / `core/layout-manager.js` for the tab. **Do NOT touch:** `corpus/**`, `contracts/**`, M1 / M7 / M8 sub-architectures, other engines' core logic, `vendor/**`, `audit-store.js`.

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end; console clean.
2. Manifest + class registry load at init (`window.corpusEngine.listSlots().length === 22`, `listClasses().length === 12`).
3. Load a fixture, audit lands in its slot cell with slot-aware category.
4. Tier gating works.
5. Append an M-Corpus Session Log row to `README.md`; flip the M-Corpus row in `docs/ROADMAP.md`; commit + push; report SHA; regenerate handoff.

---

## 5. Backlog — what is still owed

**From M8 proper:**
- **Topology shape-class test is still leading-order.** M8 sharpened the out-of-scope test (MSE scoped to audit domain); the topology classifier (LS-slope thresholds + regime cross-check) is unchanged. cdv1's gFDR shape catalogue now exists via the manifest — `gfdr-regime-migration` + `alpha-s-aging-diagonal` slots carry the posited forms; could pair with M-Corpus or be its own session.
- **Double-audit.** Pre-existing (MDS); M-Corpus dedups at read time, or a later session debounces the engine.

**From the API-manifest curation:**
- **`substrate_class_id` wiring through `DataUpload → fit_provenance`.** Currently defaults to `'unclassified'`. **Becomes a non-issue once `mpa-conform` lands** — the declaration bundle carries declared substrate-class explicitly. Until then, M-Corpus aggregations are honestly empty for user uploads.
- **Gamut values are leading-order seeds.** Refined as instances land — `mpa-conform`'s curator path is where refinement happens.

**Owed since earlier:**
- **#5 — name the implicit inversion intent.** Inversion Engine minimises L2 locus residual — unnamed RFC-S §3 intent (closest to I5). Name before any intent-selection UI.
- **Q8 conditioning-detection** — §Q8; conditioning-carrying `fitted_params` object is the forward shape, not yet built. Recharacterized by §Q13's forward-only decision as a residual-landscape feature.
- **Full α_s / P_s amplitude fit** (M-Inversion proper fit chit + γ_AB only).
- **D4 audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; full version is M1-territory.
- **§12 About panel + Check-for-update** — its own session.

**Upstream (not the auditor's to resolve — `foundational-answers.md` §11):**
- **Q7 + Q8b** — cooperative-kernel saturation through two observables. `mpa-atlas` RFC-S Appendix B item.
- **Q8c** — non-monotonicity of r(γ_AB) in the well-conditioned sliver.
- **RFC-C / RFC-S recommendation** (§Q13) — fold RFC-C into RFC-S §4. Routes through §11 → RFC-S Appendix B pipeline.

---

## 6. Solver findings — still load-bearing

`H:\mpa-solver` is at `v2.0.0` (auditor vendors v2 WASM in `vendor/mpa-solver/`). Three things still in force:

1. **Solver leaves FDT normalisation to the consumer — by design.** `math/ensemble-locus.js` does Onsager / Cugliandolo–Kurchan normalisation.
2. **`fit_invariants()` operates on the un-normalised locus** — its `X_r / X_c / α_s` are unreliable as-shipped. The auditor doesn't call it.
3. **Cooperative kernel has an unsaturated runaway branch.** Surfaces reliably as `gfdr-locus-hybrid`. Correct behaviour, not a bug. The spec question (Q7/Q8b) is for `mpa-atlas`.

---

## 7. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at `H:\mpa-auditor\.claude\launch.json`. Do NOT use `python -m http.server`.
- **Verify in Chrome.** Preview MCP (`preview_start` name `mpa-auditor`). Two gotchas: (1) `preview_screenshot` times out intermittently — fall back to `preview_eval`; (2) `preview_eval` with `await new Promise(setTimeout)` waits times out — fire events in one eval, inspect state in separate evals.
- `window.bus` (main event bus); `window.solver` (WASM surface); `window.empiricalSubBus` / `window.auditSubBus` / `window.predictionSubBus`; `window.auditStore` (`.list()` / `.clear()`). After M-Corpus proper: `window.corpusEngine`.
- **Plotly displayer gotcha:** never hand-clear a plot div's `innerHTML` before `Plotly.react`. Use `Plotly.react` in-place; `Plotly.purge` for empty state.
- No build step. Plotly + KaTeX + PapaParse via CDN; solver vendored as WASM.

---

## 8. References

- `docs/ROADMAP.md` — **the plan**. Read first for sequence and parallel tracks.
- `docs/mpa-conform-bootstrap.md` — **the fork handoff** for kicking off the new sibling repo.
- `README.md` — architecture, Session Log (most recent: `mpa-conform architectural decision`, `API-manifest curation`, `Foundational Q12+Q13`, `M8 proper`, `M7 proper`, `M-Inversion proper`), Session handoff discipline.
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — Q1–Q13 all ANSWERED. §Q12 has a correction note dated 2026-05-15 carrying the `mpa-conform` decision. §Q13 carries the forward-only architecture. §11 has been updated to name `mpa-conform` in the sibling-repos table + the curation-time-work and upstream-of-researcher-upload subsections.
- `docs/rfc-s-integration-notes.md` — 7 RFC-S discoveries from the slice.
- `docs/mpa-solver-v2-handoff.md` — current solver scope.
- `corpus/api-manifest.json` + `corpus/substrate-classes.json` — the M-Corpus inputs.
- `engines/audit-store.js`, `engines/audit-engine.js`, `engines/data-engine.js` — the engine surfaces M-Corpus reads / writes to.
- `renderers/empirical/` + `renderers/audit/` — sub-architecture templates.
- `H:\mpa-atlas\framework\cdv1_compressed.md` — framework spec. `H:\mpa-atlas\CLAUDE.md` — thin-RFC discipline. `H:\mpa-central\library\grind_library.py` + `LIBRARY_SPEC.md` — the substrate-side characterization that `mpa-conform`'s curator path will consume.

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

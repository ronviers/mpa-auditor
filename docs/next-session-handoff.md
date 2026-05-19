# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor).

**First move:** confirm the next-session pick with the user (§3).

**Read before scoping:** `docs/ROADMAP.md` Status section. The operating commitments are there. The auditor assumes perfect data; data-prep lives in `mpa-conform`. Motivation in `docs/foundational-answers.md` §Q12 / §Q13 / §11 — read those only if the session needs the *why* (most don't).

---

> ## ⚠ Containment notice — 2026-05-18
>
> **The body of this handoff (sections 1–8 below) predates conform v0.3 and dangerously specifies v0.2 as the bundle-import migration target.** Stop, read this section, then read the body with these corrections applied.
>
> **What changed since this handoff was last refreshed:**
>
> - **conform shipped v0.3 schema** (2026-05-18). Every reference to `declaration-bundle.v0.2.json` in the body below should read `v0.3.json`. **Bundle-import migration target is v0.3, not v0.2.** Schema at [`H:/mpa-conform/schema/declaration-bundle.v0.3.json`](../../mpa-conform/schema/declaration-bundle.v0.3.json).
>
> - **v0.3 added a calibration apparatus to `audit_delta`** carrying three fields the auditor's badging logic must consume:
>   - `fit_diagnostics` — raw signals: `residual_final`, `regime_confidence`, `predictor_gap`, `source`, `n_passes`.
>   - `diagnostic_percentiles` — where this fit sits in the substrate's known-good distribution (`p50`, `p90`, `p99`, …).
>   - `cross_path_disagreement` — `|chit_two_stage − chit_lens_solver_prior|` in chit units.
>
>   User-tunable thresholds are **global** (e.g. `p90 = yellow`, `p99 = red`; `> 0.3 chit = warn`), **NOT per-substrate**. Per-substrate baseline absorption is by design — the auditor sees substrate-relative percentiles, not raw scale. See [`H:/mpa-central/SYSTEM_OVERVIEW.md`](../../mpa-central/SYSTEM_OVERVIEW.md) §5.
>
> - **Five attempts at a single calibration-free per-fit confidence scalar all failed structurally** (v1 raw thresholds, v2 normalized thresholds, statistical bootstrap σ, Laplace σ, polished Laplace σ). The solvers' robustness mechanisms intentionally produce fits that don't expose any single analytical structure to peg confidence against. The three-primitive split (per-substrate baselines + cross-path agreement + raw forensics) is the operating salvage. **Do not try a sixth metric.** If outbound research returns a calibration-free framing, that's a v0.4 migration question — not an in-place metric swap. Full framing at [`H:/mpa-conform/docs/open_fit_confidence_framing.md`](../../mpa-conform/docs/open_fit_confidence_framing.md).
>
> - **mpa-lens-solver shipped v1.0, v1.2, and (2026-05-18) bootstrap dispatch + cdv1 `CHARACTER_FRAMING.md`.** The auditor doesn't import lens-solver directly (file-import boundary holds), but `fit_provenance.audit_delta.fit_diagnostics.source` now carries `lens_solver_prior` / `lens_solver_bootstrap` / `two_stage_inversion` — badging may want to acknowledge source (bootstrap-source fits have characteristically wider diagnostic distributions than prior-source fits; per-source-per-substrate baselines are the resolution). The character-framing doc names the QEC chi-scale question's long-term home as a TranslationField shape extension — **not** something the auditor should preprocess or per-substrate-dial.
>
> - **#5 (name the implicit inversion intent), Q8 conditioning-detection, full α_s / P_s amplitude fit** — all migrated to conform per the original plan when the auditor stops fitting. After bundle-import migration lands, the auditor *reads* these from `fit_provenance` rather than computing them.
>
> **Authoritative current state**: [`H:/mpa-conform/docs/next-session-handoff.md`](../../mpa-conform/docs/next-session-handoff.md) (regenerated 2026-05-18). [`H:/mpa-central/SYSTEM_OVERVIEW.md`](../../mpa-central/SYSTEM_OVERVIEW.md) §5 documents the v0.3 confidence apparatus end-to-end.
>
> **Recommendation:** treat the body below as historical context for *auditor-side architecture* (M-Corpus shape, Audit Library tab structure, sub-architecture template, dev environment, watch-items). Treat its specific *schema-version numbers and migration-target language* as out of date. The bundle-import migration brief in §2/§3/§5 needs reshaping against v0.3 before that session is taken — open the conform v0.3 schema and walk audit_delta consumption end-to-end before writing migration code.

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight JSON contracts in `/contracts/` — schema authoritative.

**Audit pipeline complete end to end.** Cascade verified in Chrome against MDS fixtures.

**API manifest curated.** `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes). M-Corpus proper reads these.

**The auditor assumes perfect data.** Ingestion contract is `declaration_bundle.json` only; data-prep lives in `mpa-conform` (shipped — v0.2 as of 2026-05-16 at [`github.com/ronviers/mpa-conform`](https://github.com/ronviers/mpa-conform)).

**Cross-repo state, most recent first:**
- `mpa-conform` v0.2 schema + scale-solver consumption (2026-05-16) — `declaration-bundle.v0.2.json` ships; `fit_provenance` required + tightened (carries `fitted_params` + `predicted_locus` + `audit_delta` + scale-solver v1.0.0 stamps). 60 v0.2 bundles + 3 driver profiles at `H:/mpa-conform/output/seed-corpus/`. **Bundle-import migration is now to v0.2 schema, and reads `fit_provenance` instead of running local inversion** (per `H:/mpa-central/SUITE_BLOCK_IN.md`: viewers consume, don't refit).
- `mpa-scale-solver` Python v1.0.0 shipped (2026-05-16). Consumed by conform.
- `mpa-conform` v0.1 bootstrap (2026-05-15) — sibling repo created; 60-cell seed corpus + 3 driver profiles staged.

**Shipped auditor-side, most recent first** (full per-session record: `README.md` → Session Log):
- API-manifest curation *(commit `332b3b4`)*
- Foundational Q12+Q13 *(commit `3ebfca0`)*
- Q11 tidy *(commit `fdbaf71`)*
- M8 proper *(commit `3e87562`)*
- M7 proper *(commit `7f44f45`)*
- *(earlier: M-Inversion proper, M6, MDS, M1/M2, engines, shell.)*

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

**Both previously-blocked auditor sessions are now unblocked.** `mpa-conform` has shipped bundles AND driver profiles. Bundle-import migration (to v0.2 schema) + (c) forward-translation-field projection are both ready to take.

---

## 2. The roadmap, honestly

Three live tracks on the auditor side; choose by what you want to move:

- **M-Corpus proper** — typed substrate-library manifest tab. Recommended next; independent of any other repo. The detailed brief is §4.
- **Bundle-import migration** — switch Window 2 to `declaration_bundle.v0.2.json` ingestion + read `fit_provenance` instead of running local inversion. Unblocked. Owns: `engines/data-engine.js`, `engines/inversion-engine.js` (thin reader rewrite), `renderers/empirical/displayers/upload-control.js` (rewrite to bundle import), `renderers/empirical/displayers/gap-prompt.js` (delete). See `ROADMAP.md` for the full file list and v0.1-vs-v0.2 reader split.
- **(c) Forward-translation-field projection at sweep time** — Inversion Engine's sweep loop reads `driver_profile.translation_field` from the corpus when available. Now that 3 driver profiles exist at conform's output, this lands cleanly. Owns: `engines/inversion-engine.js`, `engines/corpus-engine.js` (needs `getDriverProfile(classId)` — overlaps with M-Corpus engine).

Smaller items (M3/M4/M5, §12 About panel, Q8 conditioning-detection) remain owed; none unblocking.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **M-Corpus proper** *(recommended)* | `engines/corpus-engine.js` + Audit Library tab `renderers/audit-library/`. Reads `corpus/api-manifest.json` + `corpus/substrate-classes.json` + `audit-store` IndexedDB writes. | The visible payoff of the typed-structure effort. Independent of every other repo. Mid-sized session. Detailed brief in §4. |
| **Bundle-import migration** | Strip M7's data-prep half (CSV/gap-detection/declaration-form UI); add bundle import + v0.2 schema validation; rewrite Inversion Engine as `fit_provenance` reader. | The cleanest "viewers consume, don't refit" move per SUITE_BLOCK_IN. Removes a lot of code. Medium-sized. Pairs naturally with M-Corpus (both touch the empirical/audit data flow). |
| **(c) Forward-translation-field projection** | Sweep loop reads `driver_profile.translation_field`; identity fallback for `unclassified`. | Small-to-medium. Needs `corpus-engine.js` to exist (which M-Corpus brings) — schedule after M-Corpus, or combine. |
| M-Corpus engine only | Just `engines/corpus-engine.js` + `window.corpusEngine`. Defer the Audit Library tab. | Smaller, de-risks the engine. Defers the user-visible payoff. |
| §12 About panel | `renderers/about-panel/` + `check-update.js` + generated `build-info.js` + `scripts/generate-build-info.js`. First concrete instance of §11. | Self-contained, small-to-medium. Good if you want a clean bounded session. |
| Q8 conditioning-detection | `degenerate_r_band` / `saturated_cooperative` / `non_monotonic_sliver` detection at fit time; enrich `fit_provenance.fitted_params` from flat strings to the conditioning object (§Q8). | Small. **Note: after bundle-import migration lands, this would happen in mpa-conform, not here** — the auditor stops doing the fit. Either do it now in the auditor (it ports cleanly later) or wait and do it in conform. |

The user's pattern is to collapse sequential sessions when they share momentum. **M-Corpus + (c) Forward-translation-field projection is a natural pair** — both want `corpus-engine.js`. **M-Corpus + Bundle-import migration is the other natural pair** — both touch the audit data flow and Bundle-import landing simplifies M-Corpus's "tier-2 user uploads" surface.

---

## 4. Detailed brief — M-Corpus proper

**Read first.** `foundational-answers.md` §Q6 (the typed manifest), §Q3+Q5 (tier gates aggregation, not audit), §Q10 + correction note (`version_context` grading stamp), §Q11 (schema-authoritative). §11 + §Q12 correction note carry the curation-session discipline (relevant only if you wonder where the manifest came from; the manifest is already on disk).

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

**Watch 2.** Before Bundle-import migration ships, `fit_provenance.substrate_class_id` defaults to `'unclassified'` and aggregation queries return empty cells for user uploads. M-Corpus surfaces this honestly — empty cells are legitimate. After Bundle-import migration ships, bundles carry their declared `substrate_class` and this resolves.

**Files likely owned:** `engines/corpus-engine.js` (new), `renderers/audit-library/**` (new), thin wiring in `index.html` / `core/layout-manager.js` for the tab. **Do NOT touch:** `corpus/**`, `contracts/**`, M1 / M7 / M8 sub-architectures, other engines' core logic, `vendor/**`, `audit-store.js`.

**Acceptance test.** Serve the repo (§7), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end; console clean.
2. Manifest + class registry load at init (`window.corpusEngine.listSlots().length === 22`, `listClasses().length === 12`).
3. Load a fixture, audit lands in its slot cell with slot-aware category.
4. Tier gating works.
5. Append an M-Corpus Session Log row to `README.md`; flip the M-Corpus row in `docs/ROADMAP.md`; commit + push; report SHA; regenerate handoff.

---

## 5. Backlog — what is still owed

**Auditor-side work owed:**
- **Bundle-import migration** — unblocked. v0.2 schema + `fit_provenance` reader. See §3 and `ROADMAP.md`.
- **(c) Forward-translation-field projection at sweep time** — unblocked. See §3.
- **Topology shape-class test is still leading-order.** M8 sharpened the out-of-scope test (MSE scoped to audit domain); the topology classifier (LS-slope thresholds + regime cross-check) is unchanged. cdv1's gFDR shape catalogue now exists via the manifest — `gfdr-regime-migration` + `alpha-s-aging-diagonal` slots carry the posited forms.
- **Double-audit.** Pre-existing (MDS); M-Corpus dedups at read time, or a later session debounces the engine.
- **#5 — name the implicit inversion intent.** Inversion Engine minimises L2 locus residual — unnamed RFC-S §3 intent (closest to I5). Name before any intent-selection UI. **Note:** after bundle-import migration ships, this question moves to mpa-conform (the auditor stops doing the fit).
- **Q8 conditioning-detection** — §Q8; conditioning-carrying `fitted_params` object is the forward shape. Same migration note: lands in conform after bundle-import.
- **Full α_s / P_s amplitude fit** — M-Inversion proper fit chit + γ_AB only. Same migration note.
- **D4 audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; full version is M1-territory.
- **§12 About panel + Check-for-update** — its own session.

**Upstream (not the auditor's to resolve — `foundational-answers.md` §11):**
- **Q7 + Q8b** — cooperative-kernel saturation through two observables. `mpa-atlas` RFC-S Appendix B item.
- **Q8c** — non-monotonicity of r(γ_AB) in the well-conditioned sliver.
- **RFC-C / RFC-S recommendation** (§Q13) — fold RFC-C into RFC-S §4. Routes through §11 → RFC-S Appendix B pipeline.

**Cross-repo deferred** (`H:/mpa-central/DEFERRED.md`): mpa-central library data + `grind_library.py` refresh for the new RFC-S / conform / solver / auditor process. Surfaces in this repo eventually (the substrate corpus the auditor reads ultimately derives from those library cells), but not auditor-session-shaped.

---

## 6. Solver findings — still load-bearing

`H:\mpa-solver` is at `v2.0.0` (auditor vendors v2 WASM in `vendor/mpa-solver/`). Three things still in force:

1. **Solver leaves FDT normalisation to the consumer — by design.** `math/ensemble-locus.js` does Onsager / Cugliandolo–Kurchan normalisation.
2. **`fit_invariants()` operates on the un-normalised locus** — its `X_r / X_c / α_s` are unreliable as-shipped. The auditor doesn't call it.
3. **Cooperative kernel has an unsaturated runaway branch.** Surfaces reliably as `gfdr-locus-hybrid`. Correct behaviour, not a bug. The spec question (Q7/Q8b) is for `mpa-atlas`.

**Note:** mpa-solver Python bindings don't build on Windows (no MSVC). A spawned task tracks the MSVC install + binding build; once it lands, mpa-conform's local `observables.py` / `gfdr_model.py` get replaced with `import mpa_solver` shims, eliminating the gFDR-model duplication that currently lives in three repos.

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
- `README.md` — architecture, Session Log, Session handoff discipline.
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — Q1–Q13 all ANSWERED. §Q12 has the `mpa-conform` decision (now shipped at v0.2). §Q13 carries the forward-only architecture. §11 names `mpa-conform` in the sibling-repos table.
- `docs/rfc-s-integration-notes.md` — 7 RFC-S discoveries from the slice.
- `corpus/api-manifest.json` + `corpus/substrate-classes.json` — the M-Corpus inputs.
- `engines/audit-store.js`, `engines/audit-engine.js`, `engines/data-engine.js` — the engine surfaces M-Corpus reads / writes to.
- `renderers/empirical/` + `renderers/audit/` — sub-architecture templates.
- `H:\mpa-conform\schema\declaration-bundle.v0.2.json` — bundle schema for the Bundle-import migration. `fit_provenance` is the load-bearing field; viewers consume it, don't refit.
- `H:\mpa-conform\output\seed-corpus\` — 60 v0.2 bundles + 3 driver profiles, ready to consume.
- `H:\mpa-atlas\framework\cdv1_compressed.md` — framework spec. `H:\mpa-atlas\CLAUDE.md` — thin-RFC discipline.
- `H:\mpa-central\SUITE_BLOCK_IN.md` — program-wide structural commitment (compute layer vs viewer layer; "viewers consume, don't refit").
- `H:\mpa-central\DEFERRED.md` — cross-repo parking lot.
- **Archived:** `docs/archive/mpa-conform-bootstrap.md` (conform shipped), `docs/archive/mpa-solver-handoff.md` (v0, superseded), `docs/archive/mpa-solver-v2-handoff.md` (v2 shipped).

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

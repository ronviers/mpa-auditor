# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor).

**First move:** confirm the next-session pick with the user (§3).

**Read before scoping:** `docs/ROADMAP.md` Status section. The operating commitments are there. The auditor assumes perfect data; data-prep is `mpa-conform`'s concern. Motivation lives in `docs/foundational-answers.md` §Q12 / §Q13 / §11 — read those only if the session needs the *why* (most don't).

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight JSON contracts in `/contracts/` — schema authoritative.

**Audit pipeline complete end to end.** Cascade verified in Chrome against MDS fixtures.

**API manifest curated.** `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes). M-Corpus proper reads these.

**The auditor assumes perfect data.** Ingestion contract is `declaration_bundle.json` only; data-prep lives in `mpa-conform` (sibling repo, not yet created — see `docs/mpa-conform-bootstrap.md`).

**Shipped, most recent first** (full per-session record: `README.md` → Session Log):
- `mpa-conform` architectural decision + roadmap tidy *(this session, docs-only)*
- API-manifest curation *(commit `332b3b4`)*
- Foundational Q12+Q13 *(commit `3ebfca0`)*
- Q11 tidy *(commit `fdbaf71`)*
- M8 proper *(commit `3e87562`)*
- M7 proper *(commit `7f44f45`)*
- *(earlier: M-Inversion proper, M6, MDS, M1/M2, engines, shell.)*

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

**Two auditor-side sessions are blocked on `mpa-conform`:** Bundle-import migration (rip out M7's data-prep half) and (c) Forward-translation-field projection at sweep time. Both fall out naturally once `mpa-conform` ships its first bundle + first driver profile respectively. See `docs/ROADMAP.md`.

---

## 2. The roadmap, honestly

Two tracks live; either can be next or they can be parallelised (independent codebases):

- **`mpa-auditor` track** — M-Corpus proper now; Bundle-import migration + (c) when `mpa-conform` ships its first artifacts.
- **`mpa-conform` track** — new sibling repo, fork session. Brief: `docs/mpa-conform-bootstrap.md`.

Smaller items (M3/M4/M5, §12 About panel, Q8 conditioning-detection) remain owed; none unblocking.

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

**Watch 2.** Until Bundle-import migration ships (blocked on `mpa-conform`), `fit_provenance.substrate_class_id` defaults to `'unclassified'` and aggregation queries return empty cells for user uploads. M-Corpus surfaces this honestly — empty cells are legitimate.

**Files likely owned:** `engines/corpus-engine.js` (new), `renderers/audit-library/**` (new), thin wiring in `index.html` / `core/layout-manager.js` for the tab. **Do NOT touch:** `corpus/**`, `contracts/**`, M1 / M7 / M8 sub-architectures, other engines' core logic, `vendor/**`, `audit-store.js`.

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end; console clean.
2. Manifest + class registry load at init (`window.corpusEngine.listSlots().length === 22`, `listClasses().length === 12`).
3. Load a fixture, audit lands in its slot cell with slot-aware category.
4. Tier gating works.
5. Append an M-Corpus Session Log row to `README.md`; flip the M-Corpus row in `docs/ROADMAP.md`; commit + push; report SHA; regenerate handoff.

---

## 5. Backlog — what is still owed

**Auditor-side work owed:**
- **Topology shape-class test is still leading-order.** M8 sharpened the out-of-scope test (MSE scoped to audit domain); the topology classifier (LS-slope thresholds + regime cross-check) is unchanged. cdv1's gFDR shape catalogue now exists via the manifest — `gfdr-regime-migration` + `alpha-s-aging-diagonal` slots carry the posited forms.
- **Double-audit.** Pre-existing (MDS); M-Corpus dedups at read time, or a later session debounces the engine.
- **#5 — name the implicit inversion intent.** Inversion Engine minimises L2 locus residual — unnamed RFC-S §3 intent (closest to I5). Name before any intent-selection UI.
- **Q8 conditioning-detection** — §Q8; conditioning-carrying `fitted_params` object is the forward shape, not yet built.
- **Full α_s / P_s amplitude fit** (M-Inversion proper fit chit + γ_AB only).
- **D4 audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; full version is M1-territory.
- **§12 About panel + Check-for-update** — its own session.

**Blocked on `mpa-conform`:**
- **Bundle-import migration** — see `ROADMAP.md`. Strips M7's data-prep half; replaces with bundle import.
- **(c) Forward-translation-field projection at sweep time** — see `ROADMAP.md`. Reads `driver_profile.translation_field`; identity fallback today.

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

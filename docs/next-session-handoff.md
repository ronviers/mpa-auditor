# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes the pre-M-Corpus Q11-tidy handoff — the M7-proper, M8-proper, Q11-tidy, and Q12+Q13 foundational sessions all shipped (commits `7f44f45`, `3e87562`, `fdbaf71`, foundational-answers-only); and the **API-manifest curation** shipped this session.

**First move:** confirm the next-session pick with the user (§3). The rest of this brief details the *recommended* pick (M-Corpus proper, now fully unblocked); the others are sketched.

**Before scoping anything:** read `foundational-answers.md` §11 — the scoping discipline. The auditor consumes static outputs of agentic and curation processes; it does not host them. When tempted to add an agentic capability *inside* the auditor, route it to a curation session (output = committed JSON), an upstream tool (output = a signed declaration bundle), or an adjacent repo (`mpa-atlas` / `mpa-solver`).

**Also read `foundational-answers.md` §Q12 + §Q13 — they carry a load-bearing architectural decision:** the audit runs **forward-only**. MPA projects its prediction into the researcher's native coordinates and correlates there (matched-filter, not heterodyne down-conversion); the ill-posed backward map (substrate-native → canonical) is never invoked. M-Inversion proper's analytical-localise → ensemble-refine already implements this — it is a commitment, not a rewrite. Consequences for the recommended pick: M-Corpus's canonical parameters come from the **forward-sweep search index**, not from inverting data; conditioning is a residual-landscape feature, not an inversion-instability problem; RFC-C is dissolved — the auditor produces/consumes no calibration records, `fit_provenance` is the artifact.

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight JSON contracts in `/contracts/` — **the schema files are authoritative** (they are the coordination substrate of the multi-session model; see `foundational-answers.md` §Q11). A build session never edits a contract; if one looks wrong, raise a question — only a foundational session resolves it. Each contract has a designated **extension surface** where sessions add fields without a contract edit: contract 01's `parameters`, contract 02's `*_state` objects, and the now-open top level of contracts 03 and 05.

**The audit pipeline is complete end to end.** The dependency chain was M6 → M7 → M-Inversion → M8; all four links shipped.

**The API manifest is curated and committed.** `corpus/api-manifest.json` (22 slots) and `corpus/substrate-classes.json` (12 classes) extracted this session from cdv1 §"Open items" + cdv1_receipts.md §"Substrate-instancing claims." Per `foundational-answers.md` §§Q6 / §§11. **No engine code touched** — M-Corpus proper now builds the engine that reads these.

**Shipped (in order):**
- **M1** — Predicted-pane sub-architecture (`renderers/prediction/`).
- **M2** — `cobham-stack.js` + `synchroscope.js` displayers.
- **Mock-dataset slice (MDS)** — thin brought-forward M7 + M-Inversion + M8.
- **M6** — gFDR observables wiring + slice-hardening #1–4; `math/ensemble-locus.js`, `math/debounce.js`.
- **M-Inversion proper** — two-stage chit fit (analytical localise → ensemble refine), phase-locking γ_AB fit, framework-consistent fixture.
- **M7 proper** — real PapaParse CSV ingestion, per-column metadata (§Q1), declaration-first gap-detection (§Q9), `tier` / `validation` (§Q3+Q5), Empirical-pane sub-architecture.
- **M8 proper** — Window 3 sub-architecture, audit domain (§Q4 — `validity_range` ∩ coverage), `spark_gap` + `slot_context` / `slot_reading` (§Q6), `tier` + `declaration_trail` echo, `engines/audit-store.js` IndexedDB persistence keyed by `audit_id`.
- **Q11 tidy** — schema authoritative (§Q11); contracts 03/05 top-level extension opened; `version_context` grading stamp (§Q10's correction note).
- **Foundational Q12+Q13** — RFC-C dissolution; forward-only audit architecture (docs-only).
- **API-manifest curation** *(this session)* — `corpus/api-manifest.json` + `corpus/substrate-classes.json` extracted from cdv1 §"Open items" + receipts §"Substrate-instancing claims."

**The cascade** (works end to end, verified in Chrome):
`FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA → (Window 3 render + IndexedDB persist)`.

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

---

## 2. The roadmap, honestly

The audit pipeline is **done**. The API manifest is **curated**. What remains splits cleanly:

- **M-Corpus proper** — the engine + Audit Library tab that reads `corpus/*.json` and the `audit-store` IndexedDB writes. **Fully unblocked** — the curation just shipped, the audit pipeline is in place. This is the thing that "turns the auditor from a demo into a running test of the framework" (`foundational-answers.md` §Q6).
- **M3 / M4 / M5** — dynamics visualization. Independent, parallelizable, "show" not load-bearing.
- **§12 About panel** — now eligible. Renderer-territory + new build tooling.
- **Smaller owed items** — Q8 conditioning-detection, the full α_s / P_s amplitude fit, D4 audit-mode-as-first-class-app-state, the topology shape-class test. See §5.

The curation half is now sitting on disk waiting to be read; M-Corpus proper is the smallest deliverable that makes the curation visible to a researcher.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **M-Corpus proper (recommended)** | Build `engines/corpus-engine.js` that loads `corpus/api-manifest.json` + `corpus/substrate-classes.json` at init, exposes manifest / class lookup, slot-coverage queries, tier-gated aggregation reading the `audit-store` IndexedDB store; build the Audit Library tab `renderers/audit-library/` — the API-manifest-rows × substrate-instance-columns matrix. | The visible payoff of the typed-structure effort. **Mid-sized.** The curation is done (`corpus/*.json` is the input); the engine side is well-specified by §Q6 + §Q3+Q5. Natural collapse-bundle: engine + Audit Library tab in one session — the user's known play. |
| M-Corpus engine only | Just `engines/corpus-engine.js` + console-exposed `window.corpusEngine`. Stop before the Audit Library tab. | Smaller, de-risks the engine; defers the user-visible payoff. |
| M3 / M4 / M5 — dynamics viz | Ignition control, Caputo ghost trails, Three.js phase portrait. | "Show," not scientifically load-bearing. A change of pace; doesn't advance the science. |
| §12 About panel | `renderers/about-panel/` + `check-update.js` + a generated `build-info.js` + `scripts/generate-build-info.js`. The first concrete instance of §11. | Self-contained, small-to-medium, renderer + build tooling. Good if you want a clean bounded session. |
| Q8 conditioning-detection slice | Detect `degenerate_r_band` / `saturated_cooperative` / `non_monotonic_sliver` at fit time; enrich `fit_provenance.fitted_params` from flat strings to the conditioning-carrying object (`foundational-answers.md` §Q8). | Small, makes the phase-locking γ_AB fit honest. Pairs naturally with M-Corpus (the conditioning state feeds the slot-status display). |

The user has repeatedly chosen to collapse sequential sessions — the recommended row already is a bundle (engine + Audit Library tab). If you'd rather scope tighter, the engine alone is the clean unit.

---

## 4. Detailed brief — M-Corpus proper

**Read first.** `foundational-answers.md` §Q6 (the typed manifest — Substrate-Class × Substrate-Instance × API-Slot, the slot-aware audit categories, the Audit Library tab structure, the files), §Q3+Q5 (tier gates *aggregation*, not audit), §Q10 + its correction note (the grading-context stamp — `AuditDelta.version_context` exists, read it for staleness detection), §Q11 (schema-authoritative; ride the open extension surfaces), §§11 (curation-session discipline). And the two curated files at `corpus/api-manifest.json` and `corpus/substrate-classes.json` — these are the inputs.

**Inputs (already committed, do NOT re-extract).**
- `corpus/api-manifest.json` — `{ _meta, slots: [...] }`. 22 entries. Each slot: `{ id, name, cdv1_ref, receipts_ref, observable, posited_form, falsifier, applicable_classes }`.
- `corpus/substrate-classes.json` — `{ _meta, classes: [...] }`. 12 entries. Each class: `{ id, name, cdv1_refs, v9_refs, class_conditions: [{ id, statement, falsifier }], applicable_slots, gamut: { chit_range, tau_obs_constraint, out_of_scope_residual_threshold }, examples }`.
- Cross-references are bidirectionally consistent — every `slot.applicable_classes[k]` appears in that class's `applicable_slots`, and vice versa. The validator that confirmed this lives in the API-manifest-curation Session Log row (re-runnable if you touch the JSONs; do not need to re-run if you don't).

**The M-Corpus engine.**
1. `engines/corpus-engine.js` — module + singleton. At init: `fetch('corpus/api-manifest.json')` and `fetch('corpus/substrate-classes.json')`, store as in-memory maps keyed by id. Expose:
   - `getSlot(id)` / `getClass(id)` / `listSlots()` / `listClasses()` — registry lookups.
   - `getSlotsForClass(classId)` / `getClassesForSlot(slotId)` — coverage queries.
   - `aggregateByClass(classId, { includeUserTier = false })` — read `window.auditStore.list()`, filter to records whose `data.substrate_class === classId` (or whose `fit_provenance.substrate_class_id === classId`), dedup by `(data_id, latest timestamp)` (the double-audit, see Watch below), gate user-tier on the flag (§Q3+Q5), return slot-keyed map of latest-audit-per-slot.
   - Expose `window.corpusEngine` for console inspection.
2. **Wiring:** subscribe to the audit-store updates if a reactive surface is needed, otherwise polled-on-read is fine — the Audit Library tab will pull on render.

**The Audit Library tab.**
3. `renderers/audit-library/` — sub-architecture if it gets thick (mirror M1 / M7 / M8). Layout: API-manifest-rows × substrate-instance-columns matrix, grouped/filtered by class. Each cell renders an `AuditDelta` with its slot-aware category (`match` / `numerical_miss` / `topological_miss` / `posit_grade_pending` / `out_of_scope` / `incompatible_units`) — the same enum as contract 03, just read through the slot lens per §Q6. Empty cells = no instance covers this slot for this class. Tier badge (`curated` / `user_unvalidated`) on each cell; user-tier excluded from class aggregation by default, behind a toggle.
4. Tab wiring: the `Audit Library` tab already exists in `index.html` (tabs along the top — see README "What this is"); the renderer just needs to bind into the existing tab structure. Check `core/layout-manager.js` for the tab registration pattern; M1's `renderers/prediction/` is the architectural template.

**Watch.** The `audit-store` persists **two** records per fixture/CSV load — the pre-existing `handleDataReady` + `handlePredictionReady` double-audit (distinct `audit_id`s, same `data_id`). M-Corpus must dedup by `(data_id, latest timestamp)` at read time — do not assume one audit per dataset. (Alternatively, a small audit-engine debounce could collapse the double-audit at the source — but that touches the verified cascade; prefer the read-time dedup unless you're confident.)

**Watch 2.** Substrate-class assignment for `audit-store` records: currently `fit_provenance.substrate_class_id` defaults to `'unclassified'` (the M-Inversion-proper forward-compat field, §Q6). M7-proper's declaration form collects a declared class — when a researcher declares a class, it should propagate to `fit_provenance.substrate_class_id`. Check this is wired (it may have been left as `'unclassified'` always); if not, the wiring is a thin fix in `engines/inversion-engine.js` reading from `DataUpload.substrate_class` (or wherever M7-proper landed it). Not M-Corpus's mainline but it makes the aggregation queries actually return non-empty results for user uploads.

**Files likely owned:** `engines/corpus-engine.js` (new), `renderers/audit-library/**` (new), a thin shim or wiring in `index.html` / `core/layout-manager.js` for the Audit Library tab. **Do NOT touch:** `corpus/**` (curation output — only a future curation session edits these), `contracts/**`, the M1 / M7 / M8 sub-architectures, the other engines' core logic, `vendor/**`, `audit-store.js` (read it, don't edit it).

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end; console clean.
2. The API manifest + class registry load at init (`window.corpusEngine.listSlots().length === 22`, `listClasses().length === 12`).
3. Load a fixture, let it audit — the Audit Library tab shows the audit landing in its slot cell, with the slot-aware category.
4. Tier gating works — user-tier audits are excluded from class aggregation by default, included behind the toggle.
5. Append an M-Corpus Session Log row to `README.md`; flip the M-Corpus row in `docs/ROADMAP.md`; commit with the co-author tag, push, report the SHA. Write the superseding handoff.

---

## 5. Backlog — what is still owed

**From M8 proper:**
- **The topology shape-class test is still leading-order.** M8 proper sharpened the *out-of-scope* test (MSE scoped to the audit domain) but left the topology classifier (`shapeClass` — LS-slope thresholds 0.7 / 0.2 + the regime cross-check) unchanged. A real replacement now has cdv1's gFDR shape catalogue available *via the manifest* — `gfdr-regime-migration` and `alpha-s-aging-diagonal` slots carry the posited forms; could pair with M-Corpus or be its own session.
- **The double-audit.** Pre-existing (MDS); M-Corpus dedups at read time, or a later session debounces the engine.

**From M7 proper:**
- The declaration-form column-mapping caveat in Window 3 lists each mapping separately ("the tau column mapping, the C column mapping, …") — cosmetic; could dedup to "the column mapping" if it bothers anyone.

**From the curation (this session):**
- **`substrate_class_id` wiring through `DataUpload → fit_provenance`.** See §4 "Watch 2." Currently the field defaults to `'unclassified'`; M-Corpus aggregation queries need it populated to return non-empty results. Thin fix in `engines/inversion-engine.js`.
- **Gamut values are leading-order seeds.** Each class's `gamut.chit_range` / `tau_obs_constraint` / `out_of_scope_residual_threshold` was set by reading cdv1 + receipts; M-Corpus / future curation refines as instances land.

**Owed since earlier:**
- **#5 — name the implicit inversion intent.** The Inversion Engine minimises L2 locus residual — an unnamed RFC-S §3 intent (closest to I5). Name it before any intent-selection UI.
- **Q8 conditioning-detection** — `foundational-answers.md` §Q8; the conditioning-carrying `fitted_params` object is the forward shape, not yet built. **Recharacterized by §Q13's forward-only decision:** conditioning is no longer an inversion-instability problem — it is a visible feature of the forward-sweep residual landscape (flatness / multivaluedness), read off directly. The `conditioning` enum and `ambiguity_set` still ride `fit_provenance`; they are now *observations of the sweep*, not diagnostics of a backward map.
- **The full α_s / P_s amplitude fit** (M-Inversion proper fit chit + γ_AB only).
- **D4 audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; the full version is M1-territory.
- **§12 — the About panel + Check-for-update** — its own session; `foundational-answers.md` §12.

**Upstream (not the auditor's to resolve — `foundational-answers.md` §§11):**
- **Q7 + Q8b** — the cooperative-kernel saturation question, seen through *two* observables. Goes to `mpa-atlas` as one RFC-S Appendix B item.
- **Q8c** — non-monotonicity of r(γ_AB) in the well-conditioned sliver; wants its own observable-design conversation.
- **The RFC-C / RFC-S recommendation** (`foundational-answers.md` §Q13) — fold RFC-C into RFC-S §4, re-point §4's per-experiment level to forward-projection-comparison, relocate the measurement rituals to `reference-drivers/`. Routes through the §§11 → RFC-S Appendix B pipeline; *not* an auditor-side edit. Logged, awaiting a deliberate `mpa-atlas` session.

---

## 6. Solver findings — still load-bearing

`H:\mpa-solver` **is at `v2.0.0`** (the auditor vendors the v2 WASM in `vendor/mpa-solver/`). Three things still in force:

1. **The solver leaves FDT normalisation to the consumer — by design.** `math/ensemble-locus.js` does the Onsager / Cugliandolo–Kurchan normalisation (`ΔC_norm = ΔC/C(0)`, `χ_norm = 1 − χ_AA(τ)/χ_AA(0)`). Reuse it; don't re-derive.
2. **`fit_invariants()` operates on the un-normalised locus** — its `X_r / X_c / α_s` are unreliable as-shipped. The auditor doesn't call it.
3. **The cooperative kernel has an unsaturated runaway branch.** `+|γ_AB|·ρ_A·ρ_B` is a positive quadratic feedback the Lamb closure does not saturate; the ensemble diverges in the cooperative band. This is correct behaviour, handled by the guard in `computeEnsembleLocus` and the sane-bounds check in the Inversion Engine. Surfaces reliably as `gfdr-locus-hybrid`. The *spec* question (should cdv1 saturate the cross-term?) is Q7/Q8b for `mpa-atlas`. **If you touch the ensemble path, expect cooperative-band divergence — that is correct, not a bug.**

---

## 7. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at `H:\mpa-auditor\.claude\launch.json`. Do **not** revert to `python -m http.server` — it serves stale ES modules across edits. `.claude/` is untracked (intentional per the machine `CLAUDE.md`); re-check `launch.json` exists at session start.
- **Verify in Chrome.** Use the preview MCP (`preview_start` with name `mpa-auditor`). Two gotchas seen earlier: (1) `preview_screenshot` times out intermittently while the page is fine — fall back to `preview_eval` DOM inspection. (2) **`preview_eval` with `await new Promise(setTimeout)` waits times out** — the cascade's WASM ensemble work blocks the event loop and the eval's RPC can't resolve. Fire `FILE_DROPPED` in one eval (returns immediately), then inspect state in *separate* evals — the natural gap between tool calls is enough for the cascade. `window.bus` is the event bus; `window.solver` the WASM surface; `window.empiricalSubBus` / `window.auditSubBus` / `window.predictionSubBus` the sub-bus registries; `window.auditStore` the IndexedDB read surface (`.list()` / `.clear()`). After M-Corpus proper, `window.corpusEngine` should expose the corpus surface too.
- **Plotly displayer gotcha (learned earlier):** never hand-clear a plot div's `innerHTML` before `Plotly.react` — Plotly's internal state outlives the nuked DOM and the next `react` renders nothing. `Plotly.react` updates in place by design; `Plotly.purge` for the empty state. All four current plot displayers (`gfdr-signature`, `empirical-locus`, `spark-gap`) follow this now.
- No build step. Plotly + KaTeX + PapaParse via CDN; solver vendored as WASM.

---

## 8. References

- `docs/ROADMAP.md` — **the plan** (edited in place each session). Read it first for the full sequence and where M-Corpus proper sits.
- `README.md` — architecture, Session Log (read the `API-manifest curation`, `Foundational Q12+Q13`, `M8 proper`, `M7 proper`, `M-Inversion proper`, `M6`, `MDS` rows), `## Session handoff discipline`.
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — a pair, read together at session start. **Q1–Q13 all ANSWERED.** `foundational-answers.md` is the *shape constraint* on M-Corpus outputs — **§Q6 is the M-Corpus design, §§11 is the curation-session discipline, §Q11 is the contract-authority discipline, §Q12 + §Q13 carry the forward-only architecture.**
- `docs/rfc-s-integration-notes.md` — the 7 RFC-S discoveries from the slice.
- `docs/mpa-solver-v2-handoff.md` — current solver scope. (`docs/mpa-solver-handoff.md` is the v0 brief — superseded.)
- `corpus/api-manifest.json` (22 slots) + `corpus/substrate-classes.json` (12 classes) — **the curation output this session shipped.** M-Corpus reads these.
- `engines/audit-store.js` — the IndexedDB `(DataUpload, AuditDelta)` store M-Corpus reads. `engines/audit-engine.js` — the four-category classifier + audit domain + slot-aware readings. `engines/data-engine.js` — the CSV ingestion + gap-detection path.
- `renderers/empirical/` + `renderers/audit/` — the M7 / M8 sub-architectures (mirror M1's `renderers/prediction/`); read one as the pattern for `renderers/audit-library/`.
- `H:\mpa-atlas\framework\cdv1_compressed.md` — the framework spec the API manifest was extracted from (§"Open items"). `H:\mpa-atlas\framework\cdv1_receipts.md` §"Substrate-instancing claims" — the formalised falsifiers. `H:\mpa-atlas\CLAUDE.md` — thin-RFC discipline; read it before touching `mpa-atlas` (M-Corpus does not touch mpa-atlas).

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

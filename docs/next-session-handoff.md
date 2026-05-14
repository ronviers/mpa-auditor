# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes the M7-proper handoff — M7 proper, M8 proper, and a pre-M-Corpus Q11 tidy all shipped this session (commits `7f44f45`, `3e87562`, `fdbaf71`).

**First move:** confirm the next-session pick with the user (§3). The rest of this brief details the *recommended* pick (M-Corpus, with its prerequisite curation session); the others are sketched.

**Before scoping anything:** read `foundational-answers.md` §11 — the scoping discipline. The auditor consumes static outputs of agentic and curation processes; it does not host them. When tempted to add an agentic capability *inside* the auditor, route it to a curation session (output = committed JSON), an upstream tool (output = a signed declaration bundle), or an adjacent repo (`mpa-atlas` / `mpa-solver`).

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight JSON contracts in `/contracts/` — **the schema files are authoritative** (they are the coordination substrate of the multi-session model; see `foundational-answers.md` §Q11). A build session never edits a contract; if one looks wrong, raise a question — only a foundational session resolves it. Each contract has a designated **extension surface** where sessions add fields without a contract edit: contract 01's `parameters`, contract 02's `*_state` objects, and — resolved by Q11 this session — the now-open top level of contracts 03 and 05. The hand-rolled `validate()` functions are a deliberate thin lagging subset; schema wins on disagreement. **M-Corpus adds more fields to contract 03's top level — that surface is now officially open, ride it; do not add a contract.**

**The audit pipeline is now complete end to end.** The dependency chain was M6 → M7 → M-Inversion → M8; all four links shipped.

**Shipped:**
- **M1** — Predicted-pane sub-architecture: `renderers/prediction/`.
- **M2** — `cobham-stack.js` + `synchroscope.js` displayers.
- **Mock-dataset slice (MDS)** — thin, brought-forward M7 + M-Inversion + M8.
- **M6** — gFDR observables wiring + slice-hardening #1–4. `math/ensemble-locus.js`, `math/debounce.js`.
- **M-Inversion proper** — two-stage chit fit (analytical localise → ensemble refine), phase-locking γ_AB fit, the framework-consistent fixture.
- **M7 proper** *(this session — `7f44f45`)* — real PapaParse CSV ingestion alongside the unchanged mock-fixture path; per-column metadata (`coverage_range` / `validity_range` / `range_source`, §Q1); the declaration-first gap-detection pass (§Q9 — typed `DECLARATION_GAPS`, blocking vs advisory gaps, `DECLARATION_PROVIDED` answers append to `declaration_trail`); `tier` / `validation` (§Q3+Q5); the Empirical-pane sub-architecture (`renderers/empirical/` — sub-conductor, sub-layout-manager, five displayers); `wireUploadZone` removed from `layout-manager.js` (the `upload-control` displayer owns the zone now).
- **M8 proper** *(this session — `3e87562`)* — the Audit Engine echoes `tier` + `declaration_trail` onto `AuditDelta`, computes the **audit domain** (§Q4 — `validity_range` ∩ coverage, with `silenced_regions`), scopes shape/slope/MSE to the in-domain rows, and attaches `spark_gap` + `slot_context` / `slot_reading` (§Q6). The Window 3 sub-architecture (`renderers/audit/` — sub-conductor, sub-layout-manager, four displayers: `verdict-panel`, `spark-gap`, `divergence-panel`, `provenance-echo`). New `engines/audit-store.js` persists every `(DataUpload, AuditDelta)` pair to IndexedDB keyed by `audit_id` — **the basic write M-Corpus builds on.**
- **Q11 tidy** *(this session — `fdbaf71`)* — pre-M-Corpus: Q11 resolved (schema authoritative, validators lag; contracts 03/05 top-level `additionalProperties` corrected `false → true`, 01/02 checked and left untouched). The Audit Engine now stamps `version_context: { cdv1, audit_engine, solver }` on every `AuditDelta` (§Q10's grading-context stamp; shipped as `version_context` to dodge the name collision with contract 03's required `framework_version` *string* — §Q10 carries a correction note). **M-Corpus reads `version_context` to surface staleness — it exists, it is populated.**

**The cascade** (works end to end, verified in Chrome):
`FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA → (Window 3 render + IndexedDB persist)`. Verified: default fixture → `topological_miss`, framework-consistent fixture → `match`; a real CSV upload → `tier: 'user'` + declaration trail + Window 3 caveat; a declared narrow `validity_range` → the out-of-window row is silenced (`below_validity`) and the spark gap re-renders on the in-domain support.

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

---

## 2. The roadmap, honestly

The audit pipeline (M1, M2, MDS, M6, M-Inversion proper, M7 proper, M8 proper) is **done**. What remains splits cleanly:

- **M-Corpus** — the typed manifest / substrate library. **Now unblocked** (needed M7 + M8). This is the thing that "turns the auditor from a demo into a running test of the framework" (`foundational-answers.md` §Q6). The `audit-store` IndexedDB write is sitting there waiting to be read. M-Corpus needs the API manifest first — that is a *curation session* (§11), its own small piece producing `corpus/api-manifest.json` from cdv1 §"Open items".
- **M3 / M4 / M5** — dynamics visualization. Independent, parallelizable, "show" not load-bearing.
- **The §12 About panel** — now eligible (it was sequenced after M7 proper). Renderer-territory + new build tooling.
- **Smaller owed items** — Q8 conditioning-detection, the full α_s / P_s amplitude fit, D4 audit-mode-as-first-class-app-state. See §5.

`foundational-answers.md` §Q6 is the *shape constraint* for M-Corpus and was written precisely so the earlier sessions' outputs ingest cleanly. M-Inversion proper's `fit_provenance` and M8's `slot_context` / `slot_reading` are the slot-aware hooks M-Corpus reads — they exist, they are populated, they are waiting.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **API-manifest curation + M-Corpus (recommended)** | A curation session extracts `corpus/api-manifest.json` + `corpus/substrate-classes.json` from cdv1 §"Open items" (`foundational-answers.md` §Q6 — ~20 coupling-parameter slots, each a posited form + sharp falsifier); then M-Corpus proper builds `engines/corpus-engine.js` (manifest, class lookup, slot-coverage queries, tier-gated aggregation) reading the `audit-store` IndexedDB writes, and the Audit Library tab (`renderers/audit-library/` — the manifest × instance matrix). | The visible payoff of the whole typed-structure effort, and the audit pipeline now feeds it directly. **Big.** The curation half needs careful cdv1 reading (`H:\mpa-atlas\framework\cdv1_compressed.md`); the engine half is well-specified by §Q6. Natural collapse-bundle: curation session + M-Corpus proper, the user's known play. |
| API-manifest curation only | Just the curation half above — produce the two committed JSON files, stop. | Small, de-risks the cdv1 extraction before committing to the engine. A good split if you'd rather not bundle. |
| M3 / M4 / M5 — dynamics viz | Ignition control, Caputo ghost trails, Three.js phase portrait. Independent, parallelizable. | "Show," not scientifically load-bearing. A change of pace; doesn't advance the science. |
| §12 About panel | `renderers/about-panel/` + `check-update.js` + a generated `build-info.js` + `scripts/generate-build-info.js`. The first concrete instance of §11 (`foundational-answers.md` §12). | Self-contained, small-to-medium, renderer + build tooling. Good if you want a clean bounded session. |
| Q8 conditioning-detection slice | Detect `degenerate_r_band` / `saturated_cooperative` / `non_monotonic_sliver` at fit time; enrich `fit_provenance.fitted_params` from flat strings to the conditioning-carrying object (`foundational-answers.md` §Q8). | Small, makes the phase-locking γ_AB fit honest. Pairs naturally with M-Corpus (the conditioning state feeds the slot-status display). |

The user has repeatedly chosen to collapse sequential sessions — the recommended row already is a bundle (curation + M-Corpus proper). If you'd rather scope tighter, the curation session alone is the clean unit.

---

## 4. Detailed brief — API-manifest curation + M-Corpus

**Read first.** `foundational-answers.md` §Q6 (the typed manifest — Substrate-Class × Substrate-Instance × API-Slot, the slot-aware audit categories, the Audit Library tab structure, the files), §11 (curation sessions write committed JSON; the auditor reads it — no runtime agentic calls), §Q3+Q5 (tier gates *aggregation*, not audit), §Q10 + its correction note (the grading-context stamp — `AuditDelta.version_context` now exists, read it for staleness detection), §Q11 (contracts are schema-authoritative; ride the open extension surfaces, do not add a contract). And `H:\mpa-atlas\framework\cdv1_compressed.md` §"Open items" + §"Methodological imperatives" (the "API surface, not closed theory" framing the manifest derives from) — **read `H:\mpa-atlas\CLAUDE.md` first if you touch anything in `mpa-atlas`; you only need to *read* cdv1 here, not edit it.**

**The curation half.**
1. `corpus/api-manifest.json` — one entry per cdv1 coupling-parameter slot (~20), each `{ id, name, cdv1_ref, observable, posited_form, falsifier, applicable_classes }` per §Q6's `api_slot` shape. Build-time manual extraction, committed.
2. `corpus/substrate-classes.json` — the class registry (`substrate_class` shape: `id`, `name`, `cdv1_refs`, `class_conditions` with falsifiers, `applicable_slots`, `gamut`). Seed it with the classes cdv1 actually names.

**The M-Corpus half.**
3. `engines/corpus-engine.js` — loads the manifest + class registry at init; exposes manifest lookup, class lookup, slot-coverage queries, and tier-gated aggregation (curated-by-default, user-tier behind a toggle, per §Q3+Q5). Reads the `audit-store` IndexedDB store (`window.auditStore` exists; `audit-store.js` is `engines/audit-store.js`) — that store already holds `{ audit_id, data_id, timestamp, tier, status, data, audit }` records.
4. The **Audit Library tab** — `renderers/audit-library/` (sub-architecture if it gets thick), the API-manifest-rows × substrate-instance-columns matrix. Each cell is an `AuditDelta` with its slot-aware category. This is the visible payoff.

**Watch.** The `audit-store` persists **two** records per fixture/CSV load — the pre-existing `handleDataReady` + `handlePredictionReady` double-audit (distinct `audit_id`s, same `data_id`). M-Corpus must dedup by `(data_id, latest timestamp)` at read time — do not assume one audit per dataset. (Alternatively, a small audit-engine debounce could collapse the double-audit at the source — but that touches the verified cascade; prefer the read-time dedup unless you're confident.)

**Files likely owned:** `corpus/**` (new), `engines/corpus-engine.js` (new), `renderers/audit-library/**` (new), a thin shim or wiring in `index.html` for the Audit Library tab. **Do NOT touch:** `contracts/**`, the M1 / M7 / M8 sub-architectures, the other engines' core logic, `vendor/**`, `audit-store.js` (read it, don't edit it).

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end; console clean.
2. The API manifest + class registry load at init; `corpus-engine` exposes them.
3. Load a fixture, let it audit — the Audit Library tab shows the audit landing in its slot cell, with the slot-aware category.
4. Tier gating works — user-tier audits are excluded from class aggregation by default, included behind the toggle.
5. Append an M-Corpus Session Log row to `README.md`; flip the M-Corpus row in `docs/ROADMAP.md` (the roadmap lives there now, edited in place); commit with the co-author tag, push, report the SHA. Write the superseding handoff.

---

## 5. Backlog — what is still owed

**From M8 proper:**
- **The topology shape-class test is still leading-order.** M8 proper sharpened the *out-of-scope* test (MSE scoped to the audit domain) but left the topology classifier (`shapeClass` — LS-slope thresholds 0.7 / 0.2 + the regime cross-check) unchanged. A real replacement needs cdv1's gFDR shape catalogue — its own session, or M-Corpus-adjacent (the manifest's posited-forms are the catalogue).
- **The double-audit.** See §4 "Watch." Pre-existing (MDS); now visible because audits persist. M-Corpus dedups at read time, or a later session debounces the engine.

**From M7 proper:**
- The declaration-form column-mapping caveat in Window 3 lists each mapping separately ("the tau column mapping, the C column mapping, …") — cosmetic; could dedup to "the column mapping" if it bothers anyone.

*(Q11 and the `framework_version`/`version_context` stamping were the pre-M-Corpus tidy — both shipped in `fdbaf71`; no longer owed.)*

**Owed since earlier:**
- **#5 — name the implicit inversion intent.** The Inversion Engine minimises L2 locus residual — an unnamed RFC-S §3 intent (closest to I5). Name it before any intent-selection UI.
- **Q8 conditioning-detection** — `foundational-answers.md` §Q8; the conditioning-carrying `fitted_params` object is the forward shape, not yet built.
- **The full α_s / P_s amplitude fit** (M-Inversion proper fit chit + γ_AB only).
- **D4 audit-mode as first-class app state** — M6 landed a thin `app_mode` stamp; the full version is M1-territory (`layout-manager` / `index.html`).
- **§12 — the About panel + Check-for-update** — its own session; `foundational-answers.md` §12.

**Upstream (not the auditor's to resolve — `foundational-answers.md` §11):**
- **Q7 + Q8b** — the cooperative-kernel saturation question, seen through *two* observables. Goes to `mpa-atlas` as one RFC-S Appendix B item.
- **Q8c** — non-monotonicity of r(γ_AB) in the well-conditioned sliver; wants its own observable-design conversation.

---

## 6. Solver findings — still load-bearing

`H:\mpa-solver` **is at `v2.0.0`** (the auditor vendors the v2 WASM in `vendor/mpa-solver/`). Three things still in force (unchanged from the M-Inversion-proper handoff):

1. **The solver leaves FDT normalisation to the consumer — by design.** `math/ensemble-locus.js` does the Onsager / Cugliandolo-Kurchan normalisation (`ΔC_norm = ΔC/C(0)`, `χ_norm = 1 − χ_AA(τ)/χ_AA(0)`). Reuse it; don't re-derive.
2. **`fit_invariants()` operates on the un-normalised locus** — its `X_r / X_c / α_s` are unreliable as-shipped. The auditor doesn't call it.
3. **The cooperative kernel has an unsaturated runaway branch.** `+|γ_AB|·ρ_A·ρ_B` is a positive quadratic feedback the Lamb closure does not saturate; the ensemble diverges in the cooperative band. This is correct behaviour, handled by the guard in `computeEnsembleLocus` and the sane-bounds check in the Inversion Engine. Surfaces reliably as `gfdr-locus-hybrid`. The *spec* question (should cdv1 saturate the cross-term?) is Q7/Q8b for `mpa-atlas`. **If you touch the ensemble path, expect cooperative-band divergence — that is correct, not a bug.**

---

## 7. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at `H:\mpa-auditor\.claude\launch.json`. Do **not** revert to `python -m http.server` — it serves stale ES modules across edits. `.claude/` is untracked (intentional per the machine `CLAUDE.md`); re-check `launch.json` exists at session start.
- **Verify in Chrome.** Use the preview MCP (`preview_start` with name `mpa-auditor`). Two gotchas seen this session: (1) `preview_screenshot` times out intermittently while the page is fine — fall back to `preview_eval` DOM inspection. (2) **`preview_eval` with `await new Promise(setTimeout)` waits times out** — the cascade's WASM ensemble work blocks the event loop and the eval's RPC can't resolve. Fire `FILE_DROPPED` in one eval (returns immediately), then inspect state in *separate* evals — the natural gap between tool calls is enough for the cascade. `window.bus` is the event bus; `window.solver` the WASM surface; `window.empiricalSubBus` / `window.auditSubBus` / `window.predictionSubBus` the sub-bus registries; `window.auditStore` the IndexedDB read surface (`.list()` / `.clear()`). Exercise the fixtures via `bus.publish('FILE_DROPPED', { source: 'mock_fixture', fixture: 'default' | 'consistent' })`, or a CSV via `bus.publish('FILE_DROPPED', { source: 'csv', filename, text, declarations })`.
- **Plotly displayer gotcha (learned this session):** never hand-clear a plot div's `innerHTML` before `Plotly.react` — Plotly's internal state outlives the nuked DOM and the next `react` renders nothing. `Plotly.react` updates in place by design; `Plotly.purge` for the empty state. All four current plot displayers (`gfdr-signature`, `empirical-locus`, `spark-gap`) follow this now.
- No build step. Plotly + KaTeX + PapaParse via CDN; solver vendored as WASM.

---

## 8. References

- `docs/ROADMAP.md` — **the plan** (the roadmap moved here from the README this session; edited in place). Read it first for the full sequence and where M-Corpus sits.
- `README.md` — architecture, Session Log (read the `M8 proper`, `M7 proper`, `M-Inversion proper`, `M6`, `MDS` rows), `## Session handoff discipline`.
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — a pair, read together at session start. **Q1–Q11 all ANSWERED.** `foundational-answers.md` is the *shape constraint* on M-Corpus outputs — **§Q6 is the M-Corpus design, §11 is the curation-session discipline, §Q11 is the contract-authority discipline.**
- `docs/rfc-s-integration-notes.md` — the 7 RFC-S discoveries from the slice.
- `docs/mpa-solver-v2-handoff.md` — current solver scope. (`docs/mpa-solver-handoff.md` is the v0 brief — superseded.)
- `engines/audit-store.js` — the IndexedDB `(DataUpload, AuditDelta)` store M-Corpus reads. `engines/audit-engine.js` — the four-category classifier + audit domain + slot-aware readings. `engines/data-engine.js` — the CSV ingestion + gap-detection path.
- `renderers/empirical/` + `renderers/audit/` — the M7 / M8 sub-architectures (mirror M1's `renderers/prediction/`); read one as the pattern for `renderers/audit-library/`.
- `H:\mpa-atlas\framework\cdv1_compressed.md` — the framework spec the API manifest derives from (§"Open items"). `H:\mpa-atlas\CLAUDE.md` — thin-RFC discipline; read it before touching `mpa-atlas`.

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

# Foundational answers — Q1–Q6 — mpa-auditor

**What this is.** Resolutions for Q1–Q6 in [`foundational-questions.md`](foundational-questions.md), written so a session implementing M-Inversion proper / M7 proper / M8 proper / M-Corpus can act on them directly. Each answer states the decision, where it rides in the contracts, the files it touches, and what is deliberately deferred. Read alongside [`next-session-handoff.md`](next-session-handoff.md) and [`rfc-s-integration-notes.md`](rfc-s-integration-notes.md).

**Revisable — not frozen.** This is a *shape constraint*, written ahead of the sessions it constrains, so it can be wrong in ways only implementation reveals. If a session hits real friction with a decision here, it appends a dated correction note to the relevant `§Qn` (and updates the `ANSWERED` line in `foundational-questions.md` to point at it) — it does **not** silently diverge, and it does **not** rigidly comply against the evidence. The doc is a living record of the best current shape, not a contract.

**The frame.** Work backward from a researcher arriving with data. They have a time-series, they know what it's of, they want to know what the framework says about it. The auditor's job is to make that round-trip honest — fit what's fittable, audit what's auditable, fence what isn't, and never silently fake the parts that aren't there yet. The load-bearing commitments (provenance sacred, uncertainty structural, units explicit, reproducibility hashes, no silent faking) ride every step below; the answers are what makes each step tractable without breaking them.

---

## 0. The researcher's path — the workflow the answers serve

A researcher with data follows this path. Each step names which Q resolves the relevant design call.

1. **Arrive.** Browser, no install. Auditor lands with empty Window 2 and Window 1 in Explore mode.
2. **Orient.** The **Audit Library tab** (Q6) shows the API manifest — substrate classes the framework has named, the empirical coupling parameters each class is expected to instance, with sharp falsifiers. The researcher can see, *before uploading anything*, whether their substrate has a class entry or whether they're contributing to a class-genesis case.
3. **Upload.** The Empirical pane accepts a CSV (M7 proper) or JSON (MDS path). Mandatory: provenance per contract 05. Mandatory: declared substrate-class — `unclassified` is a real option (Q6). Optional: declared validity-range per column (Q1).
4. **Validate.** The Data Engine computes `coverage_range` per column from the rows, accepts declared `validity_range`, defaults the latter to the former with a `range_source` honesty flag (Q1). Units are checked against the substrate-class's expected observables (Q6). The dataset gets `tier: 'user'` and `validation.status: 'user_unvalidated'` (Q3, Q5).
5. **Fit.** The Inversion Engine looks up which API slots the declared class instances (Q6) and which observables the data covers. It fits only the parameters the observables constrain — anything unconstrained carries through with `unconstrained` flagged (per D1 for γ_AB).
6. **Audit.** The Audit Engine compares predicted vs empirical over the intersection of (empirical `validity_range`) ∩ (framework in-gamut for this substrate-class) (Q4). Outside that intersection, the audit is silent — `silenced_regions` carries the reason. Inside, the classifier returns slot-aware miss categories (Q6).
7. **Read the delta.** Window 3 shows the audit with tier badging (Q3, Q5) — user-contributed deltas carry an "unvalidated baseline" caveat through to exports. The slot-aware miss category points the researcher at whether they've hit a `numerical_miss` (canonical-extension opportunity), a `topological_miss` (falsifier hit on this substrate), or `posit_grade_pending` (more data needed).
8. **Persist.** The `(DataUpload, AuditDelta)` pair lands in M-Corpus under the user-tier. Available to revisit, export, and (if curated later) be promoted to the seed corpus.

---

## Q1 — Empirical range as first-class field

**Resolution.** Yes, as **per-column metadata** riding `additionalProperties` on contract 05. Two distinct ranges per numeric column:

```
column_metadata: {
  name, units,                            // contract 05 spec
  coverage_range: [min, max],             // values the data samples — Data Engine computes on load
  validity_range:  [min, max],            // where measurement methodology is valid — declared
  n_samples,                              // for downstream weighting
  range_source:   'declared' | 'computed' // honesty marker
}
```

`coverage_range` is always computed from the rows on load (single source of truth: the data). `validity_range` is declared; defaults to `coverage_range` with `range_source: 'computed'` if not declared — the honesty marker makes the default visible.

**Why two ranges.** A glass-relaxation correlation might sample τ ∈ [10 ms, 1000 s] (coverage) while instrument resolution makes τ < 100 ms noise. The audit should silence below 100 ms, not at 10 ms. Conflating the two is exactly the "no silent faking" failure.

**Files.**
- `engines/data-engine.js` — compute coverage on load, accept declared validity from contract-05 payload, attach `column_metadata` to `DATA_READY`.
- Contract 05 itself — **no edit**; rides existing `additionalProperties`.
- `renderers/empirical-pane/...` (M7 proper) — surface `validity_range` visibly so the researcher can see what's being audited.

**Out of scope.** Validity-range *inference* from declared instrument metadata. Useful future affordance, but the declared-or-default rule is enough now and avoids inference rules that would themselves need auditing.

---

## Q4 — Outside the empirical domain: extrapolate or refuse

**Resolution.** **Predict-and-display, audit-and-silence.** The three windows have distinct jobs:

- **Window 1 (Predicted)** keeps predicting wherever the framework claims scope. The framework's own in-gamut/out-of-gamut hatching (RFC-S §2; D3) governs its silence — not the empirical data.
- **Window 2 (Empirical)** shows only empirical data, with `validity_range` visible.
- **Window 3 (Audit)** lives in the intersection (empirical `validity_range`) ∩ (framework in-gamut for this substrate-class). Outside: silent, not extrapolated.

**Contract 03 additions** (ride `additionalProperties`):

```
audit_domain: {
  tau: [min, max],
  reason: 'intersection of empirical validity_range and substrate-class gamut'
}
silenced_regions: [
  { tau: [a, b], reason: 'below_validity' | 'above_coverage' | 'out_of_gamut_substrate_class' }
]
```

**Three reasons are distinct and must not be conflated.** `below_validity` / `above_coverage` are data-side (Q1 territory). `out_of_gamut_substrate_class` is framework-side (D3, RFC-S §2). A region can be silenced for one, two, or all three reasons; the audit honest-reports each.

**Files.**
- `engines/audit-engine.js` — compute intersection, emit `audit_domain` + `silenced_regions` on `AUDIT_DELTA`.
- `renderers/audit-pane/...` (M8 proper) — render `silenced_regions` as hatched bands in the spark-gap visualization, with the reason on hover.

**Out of scope.** Per-substrate-class gamut threshold tuning (D3's recommendation). Once Q6's manifest exists, the threshold reads from there per class. Until then, M6's per-`substrate_class` map continues to stand in.

---

## Q3 + Q5 — Curated vs user-contributed: parity at engine level, fenced at status level

**Resolution.** Same math, different downstream status.

- **Audit math (engine level):** identical for curated and user-contributed. Same observables, same classifier, same common-footing comparison. No special-casing in the engines. This is the load-bearing parity claim — it keeps the user tier a real audit, not theatre.
- **Tier (status level):** rides every contract that already carries provenance. Curated data carries `tier: 'curated'`. User data carries `tier: 'user'` and `validation: { status: 'user_unvalidated', ... }`. Tier echoes through `DATA_READY → AUDIT_DELTA`.
- **Downstream gating:** the tier flag gates *aggregation*, not audit. M-Corpus class-statistics (e.g. "what α_s do glassy substrates instance?") aggregate over `tier: 'curated'` by default; a toggle lets the researcher include user-tier with the unvalidated caveat carried into the export.
- **Promotion path:** manual curation only — a curation session validates a user-tier dataset and promotes it. No auto-promotion on any heuristic.

**Contract 05 additions** (ride `additionalProperties`):

```
tier: 'curated' | 'user'
validation: {
  status: 'curated' | 'user_unvalidated' | 'user_promoted',
  reviewed_by?: string,
  reviewed_at?:  ISO8601,
  notes?: string
}
```

**Contract 03 (AuditDelta) additions:** `tier` echoes through (already echoes provenance per D6 — this is a thin extension).

**Files.**
- `engines/data-engine.js` — set tier on load (curated for seed corpus, user for upload).
- `engines/audit-engine.js` — echo tier into AuditDelta.
- `renderers/empirical-pane/provenance.js` (M7 proper) — tier badge visible.
- `renderers/audit-pane/...` (M8 proper) — "unvalidated baseline" caveat threaded through Window 3 and any export.

**Out of scope.** The curation workflow itself (who reviews, what reviewing means, sign-off mechanics). M-Corpus territory; depends on whether the corpus lives in-repo, in IndexedDB, or via a future server-backed sync. The flag and the gating live regardless of which path; the workflow that flips the flag is downstream.

---

## Q2 — Provenance + metadata sourcing: build-time bake, with optional runtime verify

**Resolution.** Three-tier split:

- **Curated seed corpus — build-time bake.** A curation session uses MCP tooling (DataCite, Crossref, Zenodo APIs) to resolve DOIs and populate `seed-corpus/{substrate-id}/provenance.json` files. Committed to the repo. The auditor reads them as static assets at runtime — **no runtime network calls for curated data**.
- **User-contributed — declared in the upload form.** Mandatory: authors, license, citation. DOI optional. The "no silent faking" commitment lands here as `validation.status: 'user_unvalidated'` *regardless of how complete the declaration is*. Declaration is necessary but not sufficient for trust.
- **Optional runtime DOI verification (Phase 2, not blocking M7 proper).** If the user provides a DOI, the auditor *may* hit DataCite from the browser (CORS-permissive) and render a visible "verified against DataCite" badge. **Verification produces a badge, not a tier upgrade.** Failure to verify renders a "could not verify" badge, not an error.

**The MCP scope rule (load-bearing).** The auditor itself does not call MCP at runtime — MCP lives only in the dev/curation environment. This is what keeps the browser app a pure-static deliverable. The curation session is where MCP lives; the auditor reads its outputs.

**Files.**
- `seed-corpus/{substrate-id}/provenance.json` — committed metadata, one per curated substrate.
- `seed-corpus/{substrate-id}/data.json` — the dataset itself, contract-05 shaped.
- `seed-corpus/index.json` — registry the Data Engine reads at init.
- `engines/data-engine.js` — bootstrap loads the seed corpus index at init.
- DOI-verification affordance — sketch the UI position but gate behind a feature flag; do not implement in M7 proper.

**Out of scope.** Federated / server-backed corpora; live mirror of an external corpus; auto-pull at runtime. All Phase-2+.

---

## Q6 — Substrate library shape, derived from Character's API surface

**Resolution.** M-Corpus is a **typed manifest**, not a flat list. The structure derives from cdv1's *"API surface, not closed theory"* framing (§"Methodological imperatives") and its "Open items" section — ~20 empirical coupling parameters, each paired with a posited functional form and a sharp falsifier. Each entry is a *slot* the corpus exists to fill.

### The three types

**Substrate-Class** — a universality class with class-level conditions. Examples: "CK-aging glassy substrates," "surface-code QEC," "Toner–Tu active-matter populations," "Rescorla–Wagner behavioural substrates."

```
substrate_class: {
  id: 'ck-glassy',
  name: 'Cugliandolo-Kurchan aging glassy substrates',
  cdv1_refs: ['§gFDR signatures', '§Universal two-mode kernel'],
  v9_refs:   ['§Fluctuation-dissipation signatures'],
  class_conditions: [
    { id: 'common-exponent', statement: '...', falsifier: '...' }
  ],
  applicable_slots: ['s-aging-diagonal', 'caputo-beta-mem', 'plateau-height'],
  gamut: {
    chit_range: [-inf, 0],
    tau_obs_constraint: '...',
    out_of_scope_residual_threshold: 0.05    // per-class, replacing M6's stand-in
  }
}
```

**Substrate-Instance** — a specific dataset claimed to lie in a class.

```
substrate_instance: {
  id: 'glass-supercooled-orthoterphenyl-2023',
  class_id: 'ck-glassy',
  data_ref:       'seed-corpus/glass-ot-2023/data.json',
  provenance_ref: 'seed-corpus/glass-ot-2023/provenance.json',
  tier: 'curated',
  observable_coverage:  ['s-aging-diagonal', 'plateau-height'],
  class_conditions_met: ['common-exponent'],
  fit_history: [...]
}
```

**API-Slot** — one of cdv1's empirical coupling parameters.

```
api_slot: {
  id: 's-aging-diagonal',
  name: 'CK s-regime aging-diagonal slope α_s',
  cdv1_ref:     '§gFDR signatures',
  receipts_ref: 'cdv1_receipts.md §4',
  observable:    'gFDR-locus',
  posited_form:  '...',
  falsifier:     '...',
  applicable_classes: ['ck-glassy', 'surface-code-qec']
}
```

### The API manifest

`corpus/api-manifest.json` derived from cdv1 §"Open items" — one entry per slot, ~20 total. The list is on hand; the extraction is mechanical and committed once.

### Slot-aware audit categories

Contract 03's existing categories sharpen when read through a slot — **no contract change, just sharper renderings of the same enum**:

| Category | Slot-aware reading |
|---|---|
| `match` | Slot's leading-order posited form holds on this substrate. |
| `numerical_miss` | Slot's predicted *value* is off — canonical-extension opportunity (cdv1's "substrate-thermodynamic derivation of exact functional form"). |
| `topological_miss` | Slot's predicted *structure* is wrong — falsifier hit on this substrate. |
| `posit_grade_pending` | Not enough observable coverage to grade the slot. |
| `out_of_scope` | Substrate-class conditions don't hold for this instance — slot silent. |
| `incompatible_units` | Pre-classifier guardrail. |

### Audit Library tab structure

API-manifest rows × substrate-instance columns. Each cell: an `AuditDelta`, with slot-aware category, residual, and contributing-data tier. Empty cells = no instance covers this slot for this class. **This is the visible payoff of the typed structure** — at a glance, which slots are filled, which are empty, which class-genesis cases exist.

### Files (M-Corpus session)

- `corpus/api-manifest.json` — derived from cdv1 §"Open items." Build-time manual extraction, committed.
- `corpus/substrate-classes.json` — the class registry.
- `corpus/instances/{id}/...` — seed instances.
- `engines/corpus-engine.js` — exposes manifest, class lookup, slot-coverage queries, aggregation with tier gating.
- `renderers/audit-library/...` — the manifest × instance matrix view.

### What this changes for sessions *before* M-Corpus

The whole point of fixing the shape now is that earlier sessions don't paint themselves into a corner. Specifically:

**M-Inversion proper** (next session per the handoff) should **not** implement the manifest — but should write its `fit_provenance` in a slot-aware way the manifest can ingest later:

- `fit_provenance.fitted_params` — which canonical-representation parameters were constrained (e.g. `chit`) vs carried through (e.g. `γ_AB: 'unconstrained_by_gfdr_locus_d1'`).
- `fit_provenance.observable_used` — which observable the fit scored against: `'gfdr-locus-analytical'`, `'gfdr-locus-ensemble'`, `'gfdr-locus-hybrid'` — the §4 design decision becomes the value of this field.
- `fit_provenance.substrate_class_id` — stamped (defaults to `'unclassified'`).

Three string fields, no new contract — rides `parameters.additionalProperties` on contract 01 where `fit_provenance` already lives per MDS. They make the eventual ingest into M-Corpus instance records mechanical.

**M7 proper** — the upload form accepts a declared substrate-class (with `'unclassified'` as a real option) and the column-metadata stanza from Q1. The Empirical pane sub-architecture leaves room for the class-and-coverage display.

**M8 proper** — the slot-aware miss-category readings (above) replace the current category-only readings in Window 3. The mapping is mechanical: the Audit Engine knows which slot it scored against (from `observable_used` and `substrate_class_id`), so the slot-aware reading falls out — no new classification logic needed.

### Out of scope for this answer

The actual extraction of the API manifest from cdv1 §"Open items" — its own small session producing `corpus/api-manifest.json` from the ~20-entry list. Could pair with slice-hardening #7 (framework-consistent fixture), since both need the same manifest reading.

---

## Cross-cutting: what M-Inversion proper specifically picks up

The recommended next session (per `next-session-handoff.md` §4) honors these answers as forward-compatible structure, **without** implementing the downstream sessions. The full M-Inversion brief is in the handoff; the additions from this doc are narrow:

1. **`fit_provenance` writes three slot-aware string fields** (per Q6): `fitted_params`, `observable_used`, `substrate_class_id`. No new contract.
2. **The §4 cooperative-band scoring decision is recorded in `fit_provenance.observable_used`.** The hybrid / restrict / out-of-gamut choice becomes the value of this field, so later audits can read exactly which scoring path the fit took. Self-documenting under audit.
3. **No M-Corpus, no manifest, no class registry in this session.** Those are M-Corpus territory. M-Inversion's job is to make its outputs *consumable* by them — three string fields, not a refactor.
4. **The §4 framework question for `mpa-atlas`** — does cdv1 §"Universal two-mode kernel" intend the cooperative cross-term to saturate? — is logged as **Q7** in `foundational-questions.md` regardless of which scoring path is chosen. Per RFC-S Appendix B item 4 (D1), it deserves to be a tracked spec question.

---

## How to update foundational-questions.md after this lands

Append the `ANSWERED` markers per the existing workflow rule ("one-line resolution + a pointer to where the decision landed"):

```
### Q1 — How does the auditor learn an empirical dataset's *range* / domain?
**ANSWERED** (YYYY-MM-DD, M-Inversion-proper or earlier) — Per-column metadata
(`coverage_range`, `validity_range`, `range_source`) riding `additionalProperties`
on contract 05. See `docs/foundational-answers.md` §Q1.

### Q2 — Where does dataset provenance + range metadata come from?
**ANSWERED** — Build-time bake for seed corpus (MCP curation), user-declared for the
user tier, optional runtime DOI-verify badge as Phase 2. See `docs/foundational-answers.md` §Q2.

### Q3 — Should the empirical pane facilitate user-declared ranges / data?
**ANSWERED** — Yes; user tier carries `tier: 'user'` + `validation.status: 'user_unvalidated'`.
Audit math is identical to curated; tier gates downstream aggregation only.
See `docs/foundational-answers.md` §Q3+Q5.

### Q4 — Outside the empirical domain: does the Audit Engine extrapolate or refuse?
**ANSWERED** — Predict-and-display, audit-and-silence. AuditDelta carries `audit_domain`
and `silenced_regions` (three distinct reasons). See `docs/foundational-answers.md` §Q4.

### Q5 — Seed corpus vs user-contributed tier: audit parity?
**ANSWERED** — Parity at engine level, fencing at status level. See `docs/foundational-answers.md` §Q3+Q5.
```

And append the new open question that M-Inversion proper will surface:

```
### Q6 — Substrate library shape (Character's API surface)
**ANSWERED** — M-Corpus is a typed manifest (Substrate-Class × Substrate-Instance × API-Slot)
derived from cdv1's "Open items" coupling-parameter list. Slot-aware audit categories.
See `docs/foundational-answers.md` §Q6.

### Q7 — Does cdv1's universal two-mode kernel intend the cooperative cross-term to saturate?
M6 discovered the unsaturated `+|γ_AB|·ρ_A·ρ_B` runaway branch (M6 Session Log; rfc-s-integration-notes
context for §4 of next-session-handoff). M-Inversion proper works around it via the chosen
scoring path. Framework question for `mpa-atlas`. **Status:** open; promoted by M-Inversion proper.
```

---

## What is *not* in this document

Resist "while I'm here." This doc resolves Q1–Q6 at the level of contract shape, file location, and downstream-consumer compatibility. It does **not**:

- Pre-write any session's implementation. M-Inversion proper, M7 proper, M8 proper, and M-Corpus each get their own briefs.
- Edit any contract. Every addition rides existing `additionalProperties` patterns.
- Touch M1's sub-architecture, the engines' core logic, or `vendor/**`.
- Implement the API manifest. That's its own small session producing `corpus/api-manifest.json` from cdv1 §"Open items."

Each future session reads this doc as the *shape constraint* on its outputs, not as a checklist of work to do. The session's own brief defines its scope; this doc tells it what shape its outputs need to be in so the next session inherits cleanly.

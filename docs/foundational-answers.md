# Foundational answers — mpa-auditor

**What this is.** Resolutions for Q1–Q10 in [`foundational-questions.md`](foundational-questions.md), plus the project's scoping discipline (§11) and the first feature that instances it (§12) — written so a session implementing M-Inversion proper / M7 proper / M8 proper / M-Corpus can act on them directly. Each answer states the decision, where it rides in the contracts, the files it touches, and what is deliberately deferred. Read alongside [`next-session-handoff.md`](next-session-handoff.md) and [`rfc-s-integration-notes.md`](rfc-s-integration-notes.md).

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

## Q8 — Phase-locking r conditioning: coverage is not constraint

**Resolution.** Slice-hardening #6 gave γ_AB the phase-locking observable D1 called for, and on the framework-consistent fixture (#7) the Inversion Engine recovers γ_AB exactly. But building that fixture during M-Inversion proper verification surfaced that **the observable covers the γ_AB axis without constraining it across most of the gamut.** Q8 is three distinct sub-problems with three different statuses:

- **8a — r-band degeneracy.** Where the modes decay to ρ ≈ 0 (the whole r-band), √(ρ_A ρ_B) → 0, so K_AB → 0 and r → 0 for *every* γ_AB. This is a real epistemic constraint, not a formula defect — you cannot measure coupling between modes that are not there. The response is to **mark** it, not fix it: it is Q4's `silenced_regions` idea extended from the τ-domain to the *parameter*-domain (parameter-silencing). γ_AB carries `conditioning: 'degenerate_r_band'` and the audit refuses to grade it there.
- **8b — cooperative-band saturation.** K_AB pins to 1 across most of the cooperative band because ρ_A·ρ_B blows up under the unsaturated cooperative kernel — i.e. 8b *is* Q7, seen through a second observable. If `mpa-atlas` adds a saturating term to the cooperative cross-term (Q7), 8b dissolves with it. The two should go to `mpa-atlas` **together**: the same spec gap shows up in both the gFDR locus (Q7) and the phase-locking r (8b), in two distinct measurement registers — which sharpens the case for a saturating term rather than weakening it.
- **8c — non-monotonicity in the well-conditioned sliver.** Even with the runaway fixed, r(γ_AB) is non-monotonic in the thin well-conditioned band (around chit ≈ 0.2, γ_AB ∈ [-0.3, -0.05] in verification) — it has a local minimum, so one measured r can be consistent with two γ_AB values. This is structural to r as an observable and survives any kernel fix. It is the genuinely new question, and it wants its own observable-design conversation: ambiguity-set reporting, a coupling-sweep observable (dr/dγ at several γ_AB resolves the branch by slope), or a manifold slice.

**The RFC-S framing this sharpens.** D1 framed the obligation as observable-**coverage** — every canonical axis must be covered by some observable. Q8 shows coverage is not enough: an observable that exists but is degenerate / saturated / non-monotonic across most of its range covers an axis without constraining it. The obligation for RFC-S Appendix B item 4 is **observable-conditioning**, not just observable-coverage — the reference-output set must jointly constrain every axis *with adequate conditioning across the gamut*, and the driver profile should carry the conditioning state per axis per region.

**What M-Inversion proper actually shipped, and the forward shape.** M-Inversion proper does **not** detect conditioning — it fits and reports. `fit_provenance` shipped flat (see the §Cross-cutting correction note): `fitted_params` is a map of string flags, `observable_used` is a per-parameter map, plus `gamma_residual`. The #7 fixture sidesteps Q8 by carrying the *exact* forward-model r, so the fit recovers γ_AB cleanly — a real measured r would be a weak constraint, and nothing in the current code would say so.

The forward shape — for whoever builds conditioning-detection (its own slice; an M-Corpus-adjacent or M8-adjacent session) — enriches each `fitted_params` entry from a string flag to an object:

```
fit_provenance.fitted_params.gamma_AB: {
  value:        -0.15,
  observable:   'phase-locking-r',
  conditioning: 'well_conditioned' | 'degenerate_r_band'
              | 'saturated_cooperative' | 'non_monotonic_sliver',
  ambiguity_set?: [-0.15, -0.07]   // present only when conditioning indicates branching
}
```

No contract edit — still rides `additionalProperties` on contract 01. This **supersedes** the flat-string + separate-`observable_used`-map form *once conditioning-detection exists*: `observable` folds back into the per-parameter object. Until then, the flat form M-Inversion proper shipped stands, and the `conditioning` enum is the spec, not the code. M-Corpus's slot-status display reads `conditioning` to render "covered but not constrained" cells distinctly from "match" — the parity-at-engine-level / fence-at-status-level pattern (§Q3+Q5) again: the engine still fits, the status carries the truth.

**Out of scope.** The conditioning-detection logic itself (the r-band / saturation / non-monotonicity classifiers), and the coupling-sweep or manifold-slice observable 8c may need. Both are their own slices.

---

## Q9 — Unclassified data: declaration-first, gaps prompted, LLM upstream

**Resolution.** When a researcher's data does not fit an existing substrate-class, the auditor does **not** dead-end and does **not** silently slot-shop. It runs **declaration-first with the gaps prompted explicitly**: the researcher declares what they know, the auditor enumerates what is still missing for an audit to run, and each gap surfaces as a typed prompt the researcher answers by declaration. Class-genesis is not a separate workflow — it is the cumulative effect of a researcher declaring a class that does not exist, plus its conditions, plus its applicable slots, each as its own atomic declaration with provenance.

**The flow.**
1. Researcher uploads, declares what they know (substrate-class, validity-ranges, observable-coverage).
2. A **gap-detection pass** runs before the fit: it walks the declared class against the manifest, the column metadata, and the observable coverage, and emits a `DECLARATION_GAPS` event with a typed list — `{ kind: 'unknown_class' | 'slot_not_in_class' | 'condition_unmarked' | 'missing_validity_range' | ..., context, options }`.
3. Each gap is drawn as a prompt with explicit options — e.g. "you declared `ck-glassy` but your data covers `cobham-wait-time`, not in this class's `applicable_slots`: (i) extend this class to include the slot — your declaration, tier-user; (ii) declare a different class; (iii) mark the column out-of-scope for the audit."
4. Every answer is typed metadata, marked exactly as a researcher declaration.
5. `DataUpload` and `AuditDelta` both carry the full **declaration trail** — the sequence of declarations, timestamped, each tagged with the gap it answered. This is the audit-trail-of-the-audit: a downstream consumer seeing `tier: 'user'` can ask exactly which class assumptions came from the researcher vs the manifest.
6. The audit may run **partially**: unanswered gaps leave their slots `posit_grade_pending` *for that specific reason* (the contract-03 category already exists; Q6's slot-aware reading sharpens it to "pending because the researcher could not declare class-condition X"). No assumption is made on the researcher's behalf.

**Tier discipline absorbs class-extension cleanly.** A researcher declaring "add `cobham-wait-time` to `ck-glassy`" does not mutate the seed manifest — it produces a user-tier class extension attached to this `DataUpload`. M-Corpus aggregation gates on tier as before (§Q3+Q5); promotion into the seed manifest is manual curation only. Cumulative user-tier extensions become the natural pipeline of class proposals back to `mpa-atlas`.

**LLM assistance is supported — but only upstream of the auditor (see §11).** The auditor itself stays pure-static (§Q2): it does not call an LLM at runtime to fill gaps. A researcher who wants help works through the declarations in a separate tool (a Claude conversation, a declaration-assist app) that parses papers and suggests classes/ranges, and exports a researcher-signed **declaration bundle** the auditor imports. The declaration trail records "imported from external declaration assistant; no LLM provenance carried through" — the researcher attests to the declarations as theirs; the LLM's role lives in the researcher's own provenance, not the auditor's. An interchange format (`declaration-bundle.json`, riding the same `additionalProperties` patterns) is its own small spec for a future session.

**The friction guard.** Prompting can become friction researchers route around by declaring something fast and wrong. The defense is making declaration provenance **visible in the result**: Window 3 surfaces "this audit assumes you correctly declared the `common-exponent` condition holds" as a visible caveat, not buried metadata, so the researcher feels the weight of the declaration.

**Contract additions** (ride `additionalProperties`): `DataUpload` / `AuditDelta` carry `declaration_trail: [...]`; `AuditDelta` carries `class_anchor: substrate_class_id | 'proposed_class'`. New internal event `DECLARATION_GAPS` (not a contract).

**Files** (M7 proper / M8 proper territory): gap-detection in `engines/data-engine.js` (or a new `engines/declaration-engine.js` if it gets thick); the gap-prompt component in the Empirical pane; the declaration-trail caveat in the Audit pane.

**Out of scope.** The declaration-bundle interchange format spec; the curation workflow that promotes a user-tier class extension into the seed manifest (the same open promotion-path question as §Q3+Q5).

---

## Q10 — API-manifest versioning under cdv1 evolution

**Resolution.** cdv1 will evolve; existing `AuditDelta`s were graded against a specific manifest version. Revised posited forms can flip `numerical_miss` ↔ `match`; new slots leave old audits silent on them; retired slots orphan old audits. The auditor handles this by **stamping the grading context** and surfacing staleness — it does not auto-re-audit.

`AuditDelta` stamps the grading context — cdv1 / audit-engine / solver versions — as a top-level object (rides the extension surface, §Q11). M-Corpus reads it to surface "graded against cdv1 v1.2; v2.0 has revised this slot — re-audit available." Re-audit is researcher-triggered, never automatic. No contract edit.

**Out of scope.** The re-audit trigger UI, and the diffing that decides which stored audits a given cdv1 bump actually invalidates — M-Corpus territory.

### Correction note (2026-05-14, pre-M-Corpus tidy — shipped in audit_engine v0.8.1)

**`framework_version` → `version_context`.** §Q10 specified the grading-context stamp as `framework_version: { cdv1, audit_engine, solver }`. But contract 03 *already* requires a `framework_version` **string** (pattern `^v\d+(\.\d+)*$`) — an object under the same key would collide with the required field. The stamp shipped as `version_context: { cdv1, audit_engine, solver }` — a distinct top-level field riding the now-open extension surface (§Q11). The required `framework_version` string is unchanged. The §Q10 intent is intact: the audit record carries its full grading context, and M-Corpus reads `version_context` to surface staleness. (Doc working as designed — "revisable, not frozen.")

---

## Q11 — JSON Schema vs hand-rolled validator: which is authoritative

**The question.** The repo carried *two* parallel specifications of each contract: the JSON Schema file in `/contracts/`, and the hand-rolled `validate()` in the engines. They disagreed — the schema declared contracts 03/05 top-level `additionalProperties: false`, the code added top-level fields, the validator checked neither — all the cost of two specs and the discipline of zero.

**Resolution.** The **JSON Schema files in `/contracts/` are authoritative.** The hand-rolled `validate()` functions are a deliberate thin *lagging subset* — they check the load-bearing constraints, not the full schema. When the two disagree, **the schema wins**, and the validator is pulled into line whenever someone touches it. This is the same source-of-truth-plus-lag posture the project already uses for compressed-vs-unabridged framework docs: pick the authoritative artifact, let the other lag, rebuild periodically.

**Why the schema, not the code.** In a normal codebase the operational source of truth is "the thing that runs." But in mpa-auditor the JSON Schema is not a spec artifact sitting next to the code — it *is* the coordination substrate. The whole multi-session AI-maintenance model rests on it: each session edits only its own files, an agent never reads another module's code, modules communicate through the contracts. If the *code* were the contract, a renderer session would have to read `data-engine.js` to know the DataUpload shape — exactly the cross-module coupling the hub-and-spoke architecture exists to forbid. The schema's authority is load-bearing; it cannot be demoted without dismantling the session-handoff discipline. (The README's "contracts are sacred / immutable" was always pointing at this — immutability stops *casual unilateral* edits by build sessions; it was never meant to forbid a foundational session correcting a value found wrong through the proper question-raising channel. Q11 is that channel working.)

**The actual bug Q11 named.** Not "how do we evolve the contract" — it was "two specs disagree and nothing enforces either." The `additionalProperties: false` on contracts 03/05 was a stale value from before the extension fields landed. The contract was simply wrong.

**The fix (shipped 2026-05-14).** Contracts **03 and 05** top-level `additionalProperties` corrected `false → true` — the designated top-level extension surface, matching the foundational-answers intent (which always said these fields "ride additionalProperties") and the established pattern of contract 01's open `parameters` and contract 02's open `*_state`. Each carries an `_extension_note` saying so, and naming the schema-authoritative / validator-lags discipline. **Contracts 01 and 02 were checked and left untouched** — their top-level `false` is genuinely honored: 01 extends through its designated-open `parameters` (and the defined `substrate_class` property), 02 through the implicitly-open `*_state` objects. Don't fix what isn't broken.

**What this is NOT.** No nested `extensions: {}` object — that is ceremony the project's thin discipline rejects; the open top-level *is* the extension surface, consistent with 01/02. No ajv / runtime schema validation — nothing in the auditor validates against the schema at runtime today (the engines' hand-rolled `validate()` is the only check), so the enforce-with-a-build-step branch is not *forced*. If a future downstream consumer (export pipeline, federation partner) ever does validate against the schema, the schema being authoritative makes that a clean addition rather than a forced reconciliation.

**Files.** `contracts/03-audit-delta.schema.json`, `contracts/05-data-upload.schema.json` (the `false → true` correction + `_extension_note`).

**Out of scope.** Runtime schema validation (ajv-or-equivalent); regenerating the hand-rolled `validate()` functions from the schema. Both are real future options, neither is needed now — the discipline ("schema wins, validator lags, fix the validator when you touch it") is the thin sufficient answer.

---

## Q12 — `mpa-central`'s library as the seed corpus

**Resolution.** Yes — build it, via a **curation session** (the §11 file-import boundary), not an embed. `mpa-view` stays a peer instrument. `mpa-central`'s characterized cells are *one* source, not the definition of the corpus — published datasets (Zenodo, paper supplements) enter through the same path.

**Conform = characterization, not file-normalization.** The corpus's quality comes from a compute grind, not from `pandas.read_hdf()`. Conform's *ingestion porch* — bytes → dataframe, units, DOI provenance — is off-the-shelf (pandas / a units library / DataCite; §Q2's build-time bake), and should stay that way: not our problem. Conform's *body* is characterization: it produces the RFC-S §4 driver profile (the substrate's RG trajectory, gamut, translation field). No new artifact — the driver profile already has the shape; conform fills it.

**One tool, two operators.** The same conform tool serves curation (a curator runs it → committed `seed-corpus/` + driver profiles) and the uncharacterized-substrate researcher (a researcher runs it upstream → a candidate driver profile + conformed data as a signed declaration bundle, `tier: 'user'`; §Q9). Promotion to seed = manual curation (§Q3+Q5). The auditor stays pure-static — it never runs the grind.

**The forward-only consequence (see §Q13).** Because the audit runs forward-only, characterization needs only the *forward* (canonical → substrate-native) half of the translation field. The backward half — the ill-posed map where Q8 conditioning and RFC-S Appendix B item 4 live — is never built. Characterization is the well-posed half only; that is what makes the grind tractable.

**Files.** `seed-corpus/{id}/{data,provenance}.json`, `seed-corpus/index.json` (§Q2). The conform tool itself is curation-session territory, not auditor code.

**Out of scope.** The substrate-native → canonical mix-down is declared per cell by the curation session; RFC-S §1's "X-ratio · canonical" view is the reference for what is lost. Don't pre-spec it — if a cell's mix-down breaks, thicken that cell.

---

## Q13 — RFC-C calibration records, and the direction of the audit

**Resolution.** The auditor neither produces nor consumes RFC-C calibration records. RFC-C dissolves into RFC-S §4; the auditor's **forward-only** fit *is* the operative calibration; `fit_provenance` is the artifact, and its forward shape is driven by M-Corpus's needs (§Q6, §Q8), not by convergence toward an RFC-C record shape.

**Why RFC-C dissolves.**
- *Zero instances.* No substrate has been calibrated; no record exists; `mpa-view`'s calibration stepper consumes none. RFC-C specs a phase with no instances on either end — the prophylactic specification the thin-RFC discipline says to resist.
- *RFC-S §4 already carries the thin version.* Its "Characterization vs. calibration" paragraph makes the per-class / per-experiment split RFC-C expands. RFC-C is the un-thinned copy of one paragraph.
- *Calibrate is structurally impossible for the auditor's user.* RFC-C calibration needs a substrate on a bench — cessation traces, drive sweeps, perturbation response. The random researcher arrives with a CSV already collected. Calibrate was never available; conform-and-fit is the only path. "Lean conform" is forced, not preferred.
- *What survives, relocated.* "Calibration is a phase, not a mode" → stays as RFC-S §4's paragraph, renamed: *unconformed → no canonical reading*. The substrate-native measurement rituals (how `L` is read on a QEC syndrome, how `G₀` is extrapolated on a rheometer) → RFC-C §6 already routes these to `reference-drivers/`; they go there, not to /dev/null.

**The architecture: move MPA into user space, not user data into MPA-space.** The audit runs **forward-only**, on an asymmetry the framework already half-states: the forward map (canonical → substrate-native) is well-posed; the backward map (substrate-native → canonical) is ill-posed — rank-deficiency, conditioning failure (Q8), observable-insufficiency (RFC-S Appendix B item 4) all live in the backward map.

- MPA forward-predicts in canonical parameter space — solved, bounded, ours. *We always know what we have.*
- Each candidate is projected through the *forward* translation field into the researcher's native coordinates.
- The fit is a **forward sweep**: tune the known reference until it matches the received signal *in the received signal's own band* — a matched-filter / lock-in correlation, not a heterodyne down-conversion. The best-fit canonical parameters fall out of the *search index* — canonical coordinates for free, with the backward map never invoked.
- The residual is computed in user-native units; Window 3 renders MPA's prediction in the researcher's own coordinates.

This is a commitment, not a rewrite: M-Inversion proper's "analytical localise → ensemble refine" already *is* forward-evaluate-and-compare — the ensemble-refine stage is the forward sweep. The pivot is declaring forward-only as the architecture and dropping the ambition to conform user data into canonical space at all.

**What it defuses.** Q8 conditioning stops being an inversion-instability problem and becomes a visible feature of the forward-sweep residual landscape — flatness / multivaluedness you can see and report directly (the ambiguity set is read off the sweep). RFC-S Appendix B item 4 changes from "is the backward map invertible enough" to "does the forward map *discriminate*" — a forward property, far easier to check. Q4's audit domain stays, cleaner: predict where MPA claims scope, compare where the researcher has data, intersect.

**Order of operations: scale management is prior.** The forward-only flip makes scale management *logically first* — not something done "in canonical space after conforming." The forward translation field is τ_obs-parametrized (RFC-S §4) and the substrate gamut is τ_obs-parametrized (RFC-S §2), so MPA cannot be projected into user-native coordinates, the sweep-fit cannot run, and the audit domain (§Q4) cannot be computed until τ_obs is resolved.

The deeper reason τ_obs is prior and not just another swept axis: **τ_obs is an observer-fact, not a substrate-unknown.** chit and γ_AB are substrate properties MPA is trying to discover — they are the answer. τ_obs is a property of how the data was collected (RFC-S §0 principle 2 — "τ_obs is the camera; canonical representation is observer-relative"); it *defines the canonical frame*, it is not discovered *within* it. Sweeping τ_obs jointly with chit / γ_AB and taking "best correlation" treats an observer-fact as a substrate-unknown — a category error that creates degeneracy: a wrong (chit, γ_AB) at a wrong τ_obs can correlate as well as the right ones, because τ_obs moves the whole frame.

So τ_obs is **declared** — the researcher's measurement scale, given the same declared-or-defaulted-with-honesty-flag treatment as §Q1's `validity_range` (defaulting to the data's finest sampling). It *may* be swept where the researcher genuinely cannot declare it, but a swept τ_obs is a weaker, more degenerate result and carries a conditioning flag (§Q8's pattern, extended to the τ_obs axis). Declared or swept, it resolves *before* the substrate-parameter fit, because that fit's residual is only interpretable in a fixed canonical frame. Pipeline order: **declare (class, columns, units, τ_obs) → τ_obs selects the canonical frame → forward-project → sweep-fit (chit, γ_AB) → audit over (`validity_range` ∩ gamut-at-τ_obs).**

At *characterization* time there is no ordering question: conform-heavy = characterization *is* scale management — it produces the whole τ_obs-indexed driver profile (§Q12), and audit-time τ_obs selects a slice of that family. Scale management is the substance of conform at build time, and the gate on the projection at audit time.

**The one real cost.** Forward-sweep fitting is more solver evaluations than an analytic inversion would be. Bounded: the solver is fast vendored WASM, and M-Inversion's localise-then-refine already shapes the sweep so it is not brute-force. The cost is ours to control.

**Recommendation to `mpa-atlas`** (routes through the §11 → RFC-S Appendix B pipeline; *not* an auditor-side edit):
- Fold RFC-C into RFC-S §4 — delete the standalone RFC; keep the "Characterization vs. calibration" paragraph as the thin version.
- Re-point RFC-S §4's per-experiment level from a calibration-*ritual* to a forward-projection-*comparison*: the per-experiment artifact is `fit_provenance`, not a sealed measured-primitives record.
- Relocate RFC-C's measurement-discipline invariants (cessation-measured `L`, extrapolated `G₀`, …) to `reference-drivers/` — where §6 already says they belong.
- The auto-remap rule (RFC-S Appendix B item 1) is the forward translation field's *tracking* rule — the tangent-flow form the draft already floats. Close it as a tracking loop when a substrate's drift actually forces it, not before.

**`fit_provenance` is the artifact.** It does not converge toward an RFC-C record shape — RFC-C is gone. Its forward shape is the per-slot, conditioning-aware object of §Q8, read by M-Corpus.

---

## 11. Scoping discipline — what the auditor is, and what it isn't

**The stance.** The auditor consumes static outputs of agentic and curation processes; it does not host agentic processes. The browser app is a pure-static deliverable: a researcher in 2030 with a downloaded copy of the repo runs the same audit they could in 2026, with or without network access. This is not a workaround for missing capability — it is the architectural posture that makes a long-lived scientific instrument possible. Runtime agentic calls would expand the surface to API keys, rate limits, vendor outages, model drift, billing, and silent inference into the declaration trail. None of that composes with "no silent faking." The static-deliverable property *is* that commitment, made concrete.

Everything that is not *audit framework predictions against empirical data, with provenance and tiering* goes elsewhere — and "elsewhere" splits into four categories with very different ownership.

### Adjacent MPA repos — still our work, different repo

These are not "someone else's problem" in the sense of being abandoned — they are owned, just not by the auditor. The auditor consumes their static outputs and contributes questions back through the `foundational-questions.md` → RFC-S Appendix B pipeline.

| Repo | Owns | Auditor reads |
|---|---|---|
| `mpa-atlas` | Framework specs, RFC-S, Appendix B questions (Q7, Q8b, the observable-conditioning obligation) | RFC-S markdown; structured class-condition / gamut data in the future |
| `mpa-solver` | The C++/WASM solver, the observables API, kernel mathematics | Vendored WASM at `vendor/mpa-solver/` (currently v2.0.0) |
| `mpa-relaxation` | An existing manually-built substrate corpus | Substrate instances brought into `seed-corpus/` |

**Scale management belongs to `mpa-atlas`. The solver belongs to `mpa-solver`.** The auditor neither solves them nor hosts them — it consumes their outputs and surfaces empirical questions back. A session that finds itself reaching for kernel mathematics or scale-management logic *inside the auditor* is in the wrong repo.

### Curation-time work — agentic Claude with MCP, output = committed static JSON

Each runs in a discrete curation session; the auditor reads the output at init; re-runnable when source material evolves.
- API-manifest extraction from cdv1 §"Open items" → `corpus/api-manifest.json` (§Q6).
- Substrate-class registry curation → `corpus/substrate-classes.json`.
- Seed-corpus building — locating published datasets, normalising to contract 05, attaching DataCite / Crossref provenance (§Q2).
- Receipts cross-referencing — every API slot has a `receipts_ref`; cdv1 prose matches the receipt formalisation.
- Framework-consistent synthetic fixtures (the slice-hardening #7 pattern) — given class + parameters, derive expected observables to numerical tolerance.

### Upstream of the researcher's upload — LLM tools the researcher runs, output = signed declaration bundle

Declaration assistance and unit / dimension normalisation help (§Q9). The boundary is the upload: the researcher attests, the LLM's provenance does not cross into the auditor's declaration trail.

### Downstream of the auditor's outputs — agentic Claude with cross-repo access

RFC-S Appendix B drafting (watching the tracked-open-question stream, drafting contributions with linked empirical evidence); class-genesis review (agent-drafted promotion proposals for human curator approval); falsifier hunts (literature search for substrates that can measure a given cdv1 falsifier).

### External services — opt-in, badges-not-trust, CORS-permissive only

DataCite / Crossref DOI verification (§Q2 Phase 2); GitHub releases for the update-check feature (§12); ORCID author verification is speculative, not committed.

### The one rule that falls out

> Curation agents write to the repo (committed JSON). Declaration agents write to the researcher's clipboard (declaration-bundle JSON). Downstream agents write to `mpa-atlas` (markdown). The auditor reads all three. The static-deliverable property is preserved exactly because the agentic work all happens on the other side of a file-import boundary.

When a session is tempted to add an agentic capability *inside* the auditor — LLM-assisted gap-filling, smart provenance lookup, automatic class detection — the question to ask is: can this be a curation session whose output is committed JSON, an upstream tool whose output is a declaration bundle, or a downstream agent that writes to another repo? The answer is almost always yes. The auditor stays narrow.

**Out of scope.** The implementation of any offload category — each is its own future work. This section names the boundary, not the work.

---

## 12. Help › About › Check-for-update — the first concrete instance of §11

**Why this is in the answers doc.** The About panel is small UI but it is the auditor's load-bearing meta-provenance surface — it surfaces the framework's and the development process's structure to a researcher who did not read the README. The Check-for-update affordance gives the 2030-researcher a way to stay current that is fully consistent with §11 and §Q2: opt-in, user-triggered, CORS-permissive, badges-not-trust, never gates the audit. The 2030 reframe is sharper than §Q2's: not "frozen archive forever" but "frozen archive with an opt-in pointer to the live repo."

**About panel content.** Version, commit SHA, build date; cdv1 version (+ `mpa-atlas` pin) and vendored solver version; license and maintainers; per-session AI-contributor roles read from the Session Log; and the three nav-outs (Check for update, View Session Log, View foundational-questions). Build-time injection only — a generated `build-info.js` (gitignored), produced at release time by a `scripts/generate-build-info.js` from `git describe` / `git rev-parse`, the vendored solver version (exposed by `solver.version()` / `vendor/mpa-solver/README.md` — there is no `VERSION` file), and the `mpa-atlas` pin. No runtime introspection.

**Check-for-update.** User-triggered. Queries `https://api.github.com/repos/ronviers/mpa-auditor/releases/latest` (CORS-permissive), compares `tag_name` to the local version constant. Four states, all non-fatal: **up to date**; **update available** (links to release notes + repo, never auto-updates); **could not check** ("you may be offline — the auditor remains fully functional"; offline is a supported state, not a failure); **rate-limited** (GitHub's anonymous ~60/hr — "try again later").

**Files** (its own discrete session, renderer-territory plus new build tooling — sequence it after M7 proper): `renderers/about-panel/` (the panel UI + `check-update.js`); a generated `build-info.js` (gitignored) and `scripts/generate-build-info.js`; a Help-menu entry in `index.html`.

**One open wrinkle.** The Session-Log → AI-contributor display assumes the Session Log rows are parseable. They are loose markdown today — the About-panel session decides between a structured sidecar (`docs/session-log.json` regenerated at release time) and a parser that tolerates the loose format.

**Out of scope.** Auto-update, in-app release-notes rendering, differential changelogs, telemetry of any kind.

---

## Cross-cutting: what M-Inversion proper specifically picks up

The recommended next session (per `next-session-handoff.md` §4) honors these answers as forward-compatible structure, **without** implementing the downstream sessions. The full M-Inversion brief is in the handoff; the additions from this doc are narrow:

1. **`fit_provenance` writes three slot-aware string fields** (per Q6): `fitted_params`, `observable_used`, `substrate_class_id`. No new contract.
2. **The §4 cooperative-band scoring decision is recorded in `fit_provenance.observable_used`.** The hybrid / restrict / out-of-gamut choice becomes the value of this field, so later audits can read exactly which scoring path the fit took. Self-documenting under audit.
3. **No M-Corpus, no manifest, no class registry in this session.** Those are M-Corpus territory. M-Inversion's job is to make its outputs *consumable* by them — three string fields, not a refactor.
4. **The §4 framework question for `mpa-atlas`** — does cdv1 §"Universal two-mode kernel" intend the cooperative cross-term to saturate? — is logged as **Q7** in `foundational-questions.md` regardless of which scoring path is chosen. Per RFC-S Appendix B item 4 (D1), it deserves to be a tracked spec question.

---

### Correction note (2026-05-14, M-Inversion proper, bundled with slice-hardening #6 + #7)

**`observable_used` shipped as a map, not a string.** This doc specified
`observable_used` as a single string (`'gfdr-locus-analytical' | '...-ensemble'
| '...-hybrid'`) because it was written for M-Inversion-proper-only scope, where
the only fit is chit against the gFDR locus. The session was bundled with
slice-hardening #6 (the γ_AB-constraining phase-locking observable), so the fit
now constrains **two** canonical parameters against **two** observables. A single
string cannot record both scoring paths. `fit_provenance.observable_used` shipped
as `{ chit: <gfdr-locus path>, gamma_AB: 'phase-locking-r' | 'none' }` — a
per-parameter map, still slot-aware and M-Corpus-ingestible, just keyed the way
`fitted_params` already is. The per-`chit` value is exactly the string this doc
specified; it simply lives under a `chit` key now. No contract change — still
rides `parameters.additionalProperties` on contract 01. The three forward-compat
fields are otherwise as specified (`fitted_params`, `observable_used`,
`substrate_class_id`); `fit_provenance` also keeps the pre-existing
`locus_residual` / `regime` and gains `gamma_residual` (null when γ_AB is carried
through unconstrained).

**Why this is a correction, not a divergence.** The §Q6 intent — "which
observable the fit scored against," ingestible by M-Corpus — is *better* served
by the map: M-Corpus's API-Slot structure is per-parameter, so a per-parameter
`observable_used` ingests directly. The string form would have forced M-Corpus to
re-derive the split. This is the doc working as designed ("revisable, not
frozen").

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

### Q8 — Is the phase-locking Kuramoto r a well-conditioned γ_AB constraint?
**ANSWERED** — Three sub-problems (8a r-band degeneracy, 8b cooperative-band
saturation = Q7 in a second register, 8c non-monotonicity in the well-conditioned
sliver). Sharpens RFC-S Appendix B item 4 from observable-*coverage* to
observable-*conditioning*. See `docs/foundational-answers.md` §Q8.

### Q9 — Class-genesis: unclassified data
**ANSWERED** — Declaration-first with gaps prompted explicitly; declaration trail
on `DataUpload` / `AuditDelta`; tier-fenced class extensions; LLM assistance only
upstream via a signed declaration bundle (auditor stays pure-static). See
`docs/foundational-answers.md` §Q9.

### Q10 — API-manifest versioning under cdv1 evolution
**ANSWERED** — `AuditDelta` stamps `framework_version: { cdv1, audit_engine, solver }`;
M-Corpus surfaces staleness and offers researcher-triggered re-audit. See
`docs/foundational-answers.md` §Q10.
```

---

## What is *not* in this document

Resist "while I'm here." This doc resolves Q1–Q10 (and the project's scoping discipline, §11–§12) at the level of contract shape, file location, and downstream-consumer compatibility. It does **not**:

- Pre-write any session's implementation. M-Inversion proper, M7 proper, M8 proper, and M-Corpus each get their own briefs.
- Edit any contract. Every addition rides existing `additionalProperties` patterns.
- Touch M1's sub-architecture, the engines' core logic, or `vendor/**`.
- Implement the API manifest. That's its own small session producing `corpus/api-manifest.json` from cdv1 §"Open items."

Each future session reads this doc as the *shape constraint* on its outputs, not as a checklist of work to do. The session's own brief defines its scope; this doc tells it what shape its outputs need to be in so the next session inherits cleanly.

# Foundational questions — mpa-auditor

An append-as-you-go log of open architectural / design questions that
surface between sessions. Not a spec, not a roadmap — a holding place so
questions are not lost between handoffs, and so a "foundational session"
has a real agenda to work from.

**Workflow.** When a question surfaces mid-session, append it here — don't
try to answer it inline unless it's in scope for that session. When a
question is resolved, the decision is written up in
[`foundational-answers.md`](foundational-answers.md) (contract shape, files
touched, what's deferred) and the question here gets an **ANSWERED** marker:
a one-line resolution plus a pointer to the answer. `ANSWERED` means *the
design decision is made* — not necessarily that it has landed in code; the
resolution line says where it rides in. Don't delete answered questions —
they are the design record.

This file and `foundational-answers.md` are a pair, read together at
session start: questions for what's still open, answers for the shape
constraints on what you build. Both are referenced from `README.md`
(Session handoff discipline) and the next-session handoff.

---

## Empirical data ingestion & provenance

### Q1 — How does the auditor learn an empirical dataset's *range* / domain?
Today the τ-domain is implicit in the contract-05 `data` rows. The Audit
Engine already depends on it implicitly — it samples the predicted locus
*at* the empirical τ points, and behaviour outside the empirical range is
undefined. Should the empirical domain (τ-range, parameter coverage) be a
first-class field? Contracts are immutable, so it would ride
`additionalProperties` or a column-metadata convention, not a contract
edit.
**ANSWERED** (2026-05-14, design — rides into code at M7 / M-Inversion proper) — Yes, as per-column metadata (`coverage_range` computed, `validity_range` declared, `range_source` honesty flag) riding `additionalProperties` on contract 05. See [`foundational-answers.md`](foundational-answers.md) §Q1.

### Q2 — Where does dataset provenance + range metadata come from?
Three options, probably a mix:
- **(a) Runtime fetch** — the auditor calls public metadata APIs
  (DataCite / Crossref / Zenodo) by DOI. Real, but CORS-bound and a
  runtime-HTTP scope expansion for a no-build browser app.
- **(b) Build-time bake** — a curation session uses web tooling to
  pre-extract metadata into the committed seed corpus.
- **(c) User-declared** — typed into the empirical pane.
Likely split: curated seed corpus = (b); user-contributed tier = (c).
**NB:** the auditor is a browser app — it cannot call MCP tools at
runtime. MCP tooling is only available to the dev environment, i.e.
option (b) only.
**ANSWERED** (2026-05-14, design — rides into code at M7 proper / M-Corpus) — Build-time bake for the seed corpus (MCP curation session), user-declared for the user tier, optional runtime DOI-verify *badge* (not a tier upgrade) as Phase 2. See [`foundational-answers.md`](foundational-answers.md) §Q2.

### Q3 — Should the empirical pane facilitate *user-declared* ranges / data?
Probably yes, but as a distinct, tagged tier (mirrors M-Corpus's "tier-2
until validated" split). User-declared data must carry an explicit
unverified marker in its provenance block — "no silent faking" is a
load-bearing commitment. Open fork: is user-declared data audited *with
parity* to source-attributed data, or visibly fenced?
**ANSWERED** (2026-05-14, design — rides into code at M7 / M8 proper) — Yes; user tier carries `tier: 'user'` + `validation.status: 'user_unvalidated'`. Audit math is identical to curated (parity at engine level); the tier flag gates downstream *aggregation*, not the audit, and is fenced visibly in Window 3 / exports. See [`foundational-answers.md`](foundational-answers.md) §Q3+Q5.

### Q4 — Outside the empirical domain: does the Audit Engine extrapolate or refuse?
Follows from Q1. When the predicted locus extends past the empirical
τ-range, the common-footing comparison has no data to sample against.
Refuse (hatch / "no data")? Or extrapolate with a flagged uncertainty
band? RFC-S §2's in-gamut / out-of-gamut framing may already answer this.
**ANSWERED** (2026-05-14, design — rides into code at M8 proper) — Predict-and-display, audit-and-silence: Window 1 keeps predicting wherever the framework claims scope; Window 3 lives in the intersection of empirical `validity_range` ∩ substrate-class gamut. `AuditDelta` carries `audit_domain` + `silenced_regions` with three distinct, non-conflated reasons. See [`foundational-answers.md`](foundational-answers.md) §Q4.

### Q5 — Seed corpus vs user-contributed tier: audit parity?
M-Corpus splits a curated seed corpus (version-controlled, permanent
grounding) from a user-contributed tier (IndexedDB, tier-2 until
validated). Are audits run against both identically, or does the
user-tier carry a visible "unvalidated baseline" caveat through to the
`AuditDelta` and its exports?
**ANSWERED** (2026-05-14, design — rides into code at M7 / M8 proper) — Parity at engine level (same observables, same classifier, same math), fenced at status level (`tier` echoes `DATA_READY → AUDIT_DELTA`; the unvalidated caveat threads through Window 3 and exports). Tier gates aggregation, not audit. Promotion is manual curation only. See [`foundational-answers.md`](foundational-answers.md) §Q3+Q5.

### Q6 — What shape is the substrate library (M-Corpus)?
Is M-Corpus a flat list of `(DataUpload, AuditDelta)` pairs, or something
typed? It is load-bearing for Audit mode's universality check, so its
shape constrains M-Inversion proper, M7 proper, and M8 proper — they need
to emit outputs M-Corpus can ingest cleanly.
**ANSWERED** (2026-05-14, design — rides into code at M-Corpus; forward-compat obligations land at M-Inversion proper) — A typed manifest, not a flat list: Substrate-Class × Substrate-Instance × API-Slot, derived from cdv1's "API surface, not closed theory" framing (~20 coupling-parameter slots from §"Open items"). Contract 03's existing miss categories sharpen into slot-aware readings — no contract change. M-Inversion proper owes three forward-compat `fit_provenance` string fields so its outputs ingest cleanly later. See [`foundational-answers.md`](foundational-answers.md) §Q6 + §"Cross-cutting".

---

## Framework / kernel questions

### Q7 — Does cdv1's universal two-mode kernel intend the cooperative cross-term to saturate?
M6 discovered that the cooperative coupling term `−γ_AB·ρ_A·ρ_B` (which for
γ_AB < 0 is `+|γ_AB|·ρ_A·ρ_B`) has no saturation — the Lamb closure
saturates only the linear gain. The kernel runs away to ∞ deterministically
above chit≈1, and the stochastic ensemble escapes into that branch even at
modest positive chit. M6's consumer-side fix is a divergence guard +
analytical fallback; M-Inversion proper works around it via its chosen
scoring path. But the underlying question — *should* cdv1 §"Universal
two-mode kernel" carry a saturating term on the cooperative cross-coupling?
— is a framework question, not a solver or auditor one. Per RFC-S Appendix
B item 4 (D1) it deserves to be a tracked spec question for `mpa-atlas`.
See M6 Session Log + `next-session-handoff.md` §7.
**Status:** open — promoted to tracked by M-Inversion proper; belongs upstream in `mpa-atlas`.

---

## (other topics — append new sections below as they surface)

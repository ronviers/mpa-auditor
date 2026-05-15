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

See `foundational-answers.md` §11 for the **scoping discipline** that
governs what gets answered *in this repo* versus routed elsewhere — a
question that turns out to belong to `mpa-atlas`, `mpa-solver`, or a
curation session is tracked here but resolved there.

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
**Status:** TRACKED (2026-05-14, by M-Inversion proper) — open framework
question for `mpa-atlas` per RFC-S Appendix B item 4 (D1). M-Inversion
proper handles it *operationally*: a chit candidate whose coarse ensemble
diverges is scored against the analytical locus instead, and
`fit_provenance.observable_used.chit` records the path actually taken
(`gfdr-locus-ensemble` | `...-analytical` | `...-hybrid`). The cooperative
band reliably surfaced as `hybrid` in verification (both the renderer-
exercising and the framework-consistent fixtures). The *spec* question —
should cdv1 §"Universal two-mode kernel" carry a saturating term on the
cooperative cross-coupling — is untouched by that workaround and remains
open for `mpa-atlas`.

### Q8 — Is the phase-locking Kuramoto r a well-conditioned γ_AB constraint?
Slice-hardening #6 added the phase-locking observable as the γ_AB-
constraining observable D1 called for, and it works: the Inversion Engine
recovers γ_AB exactly on the framework-consistent fixture. But building
that fixture surfaced two conditioning problems. (1) r is **degenerate**
wherever the modes decay to ρ≈0 (the whole r-band): √(ρ_Aρ_B)→0 so
K_AB→0 and r→0 for *every* γ_AB. (2) r is **saturated** across most of
the cooperative band: K_AB blows up with the kernel's runaway (Q7), so
r pins to 1 for every cooperative γ_AB. The observable is only well-
conditioned in a thin sliver (around chit≈0.2, γ_AB∈[-0.3,-0.05] in
verification), and even there r(γ_AB) is **non-monotonic** — it has a
local minimum, so a measured r can be consistent with two γ_AB values.
The fixture sidesteps this by carrying the *exact* forward-model r, but a
real measured r would be a weak constraint. Open question: does γ_AB
need a *different or additional* observable (a coupling sweep, a manifold
slice) to be robustly invertible, or is the phase-locking signature
sufficient once restricted to its well-conditioned sliver? Bears on
RFC-S Appendix B item 4's observable-coverage obligation.
**ANSWERED** (2026-05-14, foundational session) — Decomposed into 8a
(r-band degeneracy — parameter-silencing), 8b (cooperative-band
saturation — = Q7 in a second observable register), 8c (non-monotonicity
in the well-conditioned sliver — the genuinely new question). Sharpens
RFC-S Appendix B item 4 from observable-*coverage* to
observable-*conditioning*. M-Inversion proper shipped flat `fit_provenance`;
the `conditioning`-carrying `fitted_params` object is the forward shape,
not yet built. See [`foundational-answers.md`](foundational-answers.md) §Q8.
8b stays open *upstream* with Q7 (`mpa-atlas`); 8c wants its own
observable-design conversation.

---

## Empirical data ingestion & provenance (cont.)

### Q9 — Class-genesis: what happens when data fits no existing substrate-class?
`'unclassified'` is a real declared option (§0 step 3, Q6), but the
follow-on was unspecified. Does the auditor dead-end, slot-shop, or
support a proposed-class workflow?
**ANSWERED** (2026-05-14, foundational session) — None of those as a mode:
the auditor runs **declaration-first with the gaps prompted explicitly**.
A gap-detection pass enumerates what is missing for an audit to run; each
gap is a typed prompt the researcher answers by declaration; `DataUpload`
/ `AuditDelta` carry the full declaration trail; the audit may run
partially (`posit_grade_pending` per unanswered gap). Class-genesis is the
cumulative effect of atomic declarations, tier-fenced as user-tier class
extensions. LLM assistance is supported **only upstream** via a
researcher-signed declaration bundle — the auditor stays pure-static
(§Q2 / §11). See [`foundational-answers.md`](foundational-answers.md) §Q9.

### Q10 — API-manifest versioning under cdv1 evolution
cdv1 will evolve; existing `AuditDelta`s were graded against a specific
manifest version. Revised posited forms can flip `numerical_miss` ↔
`match`; new slots leave old audits silent; retired slots orphan them.
**ANSWERED** (2026-05-14, foundational session) — `AuditDelta` stamps
`framework_version: { cdv1, audit_engine, solver }` (rides
`additionalProperties` on contract 03); M-Corpus surfaces staleness and
offers researcher-triggered re-audit — never automatic. See
[`foundational-answers.md`](foundational-answers.md) §Q10.

---

## Contracts

### Q11 — Contract 05's top-level `additionalProperties: false` vs the documented extension pattern
`foundational-answers.md` repeatedly specifies DataUpload-level additions
"riding `additionalProperties`" — `scalar_observables` (M-Inversion
proper), `tier` / `validation` (§Q3+Q5), `declaration_trail` (§Q9),
`source_filename` (M7 proper). But contract 05 declares
`additionalProperties: false` at the **top level** — only the `columns`
items and `provenance` actually permit extra properties. So the
operative reality already diverges from the contract: M-Inversion proper
shipped `scalar_observables` top-level, and M7 proper adds `tier` /
`validation` / `declaration_trail` / `source_filename` the same way. The
hand-rolled `validate()` in `data-engine.js` does not enforce
`additionalProperties`, so nothing breaks — but the contract text and the
practice disagree. Per the immutability discipline this is a question,
not an edit: should contract 05's top-level `additionalProperties` be
`true` (matching contracts 01/02's `*_state` extension pattern), or
should these fields live under a designated nested object? Per-column
metadata (§Q1) is **not** affected — the `columns` items genuinely allow
extra properties today.
**ANSWERED** (2026-05-14, pre-M-Corpus tidy) — The JSON Schema files in
`/contracts/` are authoritative; the hand-rolled `validate()` functions
are a deliberate thin lagging subset (schema wins on disagreement). The
real bug was two specs + zero enforcement, not "how to evolve the
contract." Contracts 03 and 05 top-level `additionalProperties` corrected
`false → true` — the designated extension surface, matching contract
01's open `parameters` and 02's open `*_state`; contracts 01/02 checked
and left untouched (already correct). No nested extension object, no
runtime ajv. See [`foundational-answers.md`](foundational-answers.md) §Q11.

---

## Ecosystem integration

Open architectural questions about the auditor's place in the wider
`mpa-*` ecosystem — how it connects to adjacent instruments and shared
artifacts. Per §11 (`foundational-answers.md`), the auditor stays narrow
and pure-static; these questions are about the *seams* — the file-import
boundaries across which it consumes or produces, never the embeds.

### Q12 — Does `mpa-central`'s characterized library become the auditor's seed corpus?
`mpa-central` holds a library of characterized substrate cells (glass,
quantum, brain) at `H:/mpa-central/library/` — the same lightfield
`mpa-view` renders. M-Corpus needs a curated seed corpus (§Q2, §Q6), and
those library cells are exactly the kind of object the seed corpus
wants. The §11-shaped question: is the connection a *curation session*
that normalises library cells → contract-05 → committed `seed-corpus/`
(the file-import boundary §11 prescribes), and if so, what is lost or
assumed in the substrate-native → canonical mix-down? (`mpa-view`'s
"X-ratio · canonical" view already does a version of that mix-down per
RFC-S §1 — worth reading before designing the curation pass.) The
alternative the user floated — embedding `mpa-view` as a Settings popup
inside the auditor — is rejected by §11: `mpa-view` is a server-backed
Python app and a distinct METHODOLOGY Cut-4 viewer; the auditor is
pure-static. The library is the shared substrate; the instruments stay
peers.
**ANSWERED** (2026-05-14, foundational session) — Yes; built by a curation
session (§11 file-import boundary), `mpa-view` stays a peer. `mpa-central`'s
cells are one source, not the definition — published datasets enter the
same way. Conform = characterization producing the RFC-S §4 driver profile
(off-the-shelf ingestion porch, framework-core body). One tool, two
operators (curator → committed seed corpus; researcher → signed declaration
bundle). Forward-only audit (§Q13) means only the *forward* half of the
translation field is ever built. See
[`foundational-answers.md`](foundational-answers.md) §Q12.

### Q13 — Does the auditor's inversion fit produce / consume RFC-C calibration records?
The Inversion Engine, fitting chit / γ_AB to a substrate, is doing a
*calibration*. `MPA-RFC-C-Calibration.md` (`mpa-atlas`) defines the
calibration-record contract — the sealed six-step
L · G₀ · τ_obs · γ_AB · validation · seal artifact `mpa-view`'s
calibration stepper consumes (and currently has none of). Open question:
should the auditor *emit* RFC-C calibration records from `fit_provenance`
as a curation-time output — a producer/consumer seam, the auditor
calibrates and `mpa-view` steps through, neither embedded in the other —
and/or *consume* them? Bears on whether `fit_provenance`'s forward shape
should converge toward the RFC-C record shape. **Not yet read against
RFC-C v0.2** — the first step is reading
`H:/mpa-atlas/rfcs/MPA-RFC-C-Calibration.md` and checking the gap
between it and the current `fit_provenance`.
**ANSWERED** (2026-05-14, foundational session) — Neither produces nor
consumes RFC-C records. RFC-C dissolves into RFC-S §4 (zero instances; §4
already carries the thin version; calibrate is structurally impossible for
a researcher with already-collected data — no bench). The auditor's
**forward-only** fit is the operative calibration: MPA projects into
user-native coordinates and correlates there (matched-filter, not
heterodyne); the backward map — where Q8 conditioning and RFC-S Appendix B
item 4 live — is never invoked. Canonical parameters fall out of the
forward-sweep search index. `fit_provenance` is the artifact; it does not
converge toward an RFC-C record shape. `mpa-atlas` recommendation (fold
RFC-C into RFC-S §4) logged. See
[`foundational-answers.md`](foundational-answers.md) §Q13.

---

## (other topics — append new sections below as they surface)

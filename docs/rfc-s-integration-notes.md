# RFC-S integration notes — mock-dataset slice

**What this is.** Discoveries from building the mock-dataset slice (Data Engine + Inversion Engine + Audit Engine + Windows 2/3), recorded against [`MPA-RFC-S_Scale-Management.md`](H:/mpa-atlas/rfcs/MPA-RFC-S_Scale-Management.md) v0.2. The slice is the first time RFC-S concepts — substrate gamut, round-trip validation, the auto-remap rule — meet running code, so the act of building it is what surfaces these. Per the auditor's session discipline this is operational meta, not protocol text; only one genuinely-new open question (D1) was promoted to RFC-S Appendix B.

**How the slice grounds in RFC-S.** The loop `upload → DATA_READY → Inversion fit → STATE_REQUEST → PREDICTION_READY → AUDIT_DELTA` is a concrete realization of the RFC-S forward/round-trip picture:

- The **Inversion Engine** is the *backward* map (substrate-native empirical data → canonical parameters) of RFC-S §5's round-trip protocol.
- The character/discrete engine re-render at the fitted point is the *forward* map.
- The **Audit Engine**'s `out_of_scope` branch is RFC-S §2's in-gamut / out-of-gamut test.
- The Predicted pane's self-adaptation on data-load is one instance of RFC-S §1's auto-remap (the cross-position remap "is the flow trajectory itself").

---

## Discoveries

### D1 — The gFDR locus underdetermines γ_AB (→ RFC-S Appendix B item 4)

The framework's analytical gFDR locus (`math/gfdr-model.js` `generateLocus`) depends on **chit alone**. Inverting an empirical C(τ)/χ(τ) locus yields a well-constrained chit, but γ_AB is rank-deficient — the observable does not see it. The Inversion Engine fits chit by grid search and reports γ_AB as `unconstrained`, carrying it through unchanged.

This is an **observable-sufficiency** finding: RFC-S §5 round-trip validation implicitly assumes the forward map is invertible enough to validate against, and RFC-S §4's `reference_outputs` are the test inputs that drive it. Neither currently says *which observables jointly constrain which canonical-representation axes*. A driver whose `reference_outputs` carry only a gFDR locus cannot be round-trip-validated on γ_AB at all — the round-trip would pass while leaving an axis untouched.

**Recommendation:** RFC-S §4 `reference_outputs` (or §5) should require that the reference-output set jointly constrains every canonical-representation axis the driver claims to support — an observable-coverage obligation. γ_AB specifically needs a manifold-shaped or phase-locking observable, not a single-mode FDR locus. Promoted to **Appendix B item 4**.

### D2 — Auto-remap (Appendix B item 1): the slice realizes the *function* form

RFC-S Appendix B item 1 leaves auto-remap form open — finite remap *function* vs infinitesimal *generator*. The slice implements the **function form**: a discrete data-load event triggers a one-shot fit producing a discrete new operating point. This is the natural shape when the trigger is an *event* (a dataset arriving), not a continuous τ_obs sweep.

This confirms — does not resolve — Appendix B item 1's "v0.2 admits both forms": the function form fits event-triggered remaps (Audit mode), the generator form will fit the continuous τ_obs camera sweep (Navigate mode, RFC-S §1). The two forms are not competing; they serve different triggers. No RFC-S change — recorded here as evidence for whoever closes item 1.

### D3 — `out_of_scope` needs a substrate-declared gamut threshold

The Audit Engine's `out_of_scope` branch uses a **global constant** (`OUT_OF_SCOPE_MSE = 0.05`) to decide when the framework's closest locus is "too far" from the data. RFC-S §2 says a spec is in-gamut "iff its (V, E, Γ, D, τ_obs, P) corresponds to points along the substrate's trajectory" — i.e. the gamut boundary is *substrate-specific*, not global. A global MSE threshold is a leading-order stand-in.

**Recommendation:** RFC-S §4 driver-profile `gamut` should carry the residual/distance threshold above which a fit is declared out-of-gamut, so the Audit Engine reads it per-substrate rather than hard-coding it. Not promoted to Appendix B — it is covered by §4's existing `gamut` section; this note flags that the threshold field is currently implicit.

### D4 — Audit-mode vs Explore-mode is carried implicitly

The Inversion Engine marks its STATE_REQUEST with `parameters.fit_provenance`; that is the only signal distinguishing a *fitted* operating point (Audit mode) from a *hand-dialed* one (Explore mode). The character/discrete engines ignore it; the Audit Engine audits every prediction regardless. RFC-S §1 ("canonical representation at observer position p") and the README's three Predicted-pane modes assume this distinction is first-class. It currently is not — it lives in a `parameters` sub-object that contract 01 tolerates via `additionalProperties`.

**Recommendation (auditor-internal, not RFC-S):** when Audit mode becomes a real mode (post M-Inversion proper), the fitted-vs-explore distinction should be explicit in app state, not implicit in `fit_provenance`. Recorded here for the M8 / Navigate-mode sessions.

### D5 — Forward-model fidelity bounds round-trip fidelity

The Inversion Engine scores candidates against the **analytical** gFDR locus, not the ensemble-derived one (the ensemble path is ~2 s per candidate — gated on M6). RFC-S §5's round-trip metric is only as trustworthy as the forward model it runs through. This is the concrete content of M6 being a hard dependency of M-Inversion: until the ensemble-derived locus is wired and fast enough, every fit (and therefore every round-trip validation) carries the analytical-proxy's error. Named limitation, not a spec question.

### D6 — Contracts 03 / 05 / 08 round-trip cleanly (positive finding)

The cross-pane exchange — DataUpload (05) → SelectionChanged (08) → StateRequest (01) → PredictedLocus (02) → AuditDelta (03) — ran end to end with no contract friction. Provenance echoes intact from DataUpload through to AuditDelta. `parameters.additionalProperties: true` on contract 01 absorbed `fit_provenance` and `substrate_class` without a contract change, exactly as the roadmap anticipated. The contracts held under their first real cross-pane stress.

### D7 — `fixtures/fake-empirical.json` is not framework-consistent

The fixture's χ ≈ ΔC (a clean diagonal / equilibrium-FDR signature) while its C(τ) carries an aging-like tail — no single framework operating point fits both, so the Audit Engine honestly returns `topological_miss`. This is correct behaviour on a fixture that was built to exercise renderers, not to be physically consistent. A *framework-consistent* synthetic dataset would be a better seed for M-Corpus and would let the `match` / `numerical_miss` branches be exercised against known-good data. Flagged for whoever builds the M-Corpus curated seed.

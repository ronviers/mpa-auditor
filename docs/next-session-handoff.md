# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes the M-Inversion-proper handoff — that work shipped (commits `b4a501b`, `494d35a`).

**First move:** confirm the next-session pick with the user (§3). The rest of this brief details the *recommended* pick (M7 proper); the others are sketched.

**Before scoping anything:** read `foundational-answers.md` §11 — the scoping discipline. The auditor consumes static outputs of agentic and curation processes; it does not host them. When tempted to add an agentic capability *inside* the auditor, route it to a curation session (output = committed JSON), an upstream tool (output = a signed declaration bundle), or an adjacent repo (`mpa-atlas` / `mpa-solver`).

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight **immutable** JSON contracts in `/contracts/`. If a session thinks a contract is wrong, it raises a question — never edits one. Every extension this far has ridden `additionalProperties` on contract 01's `parameters` and on the `*_state` objects — keep doing that; do not add contracts speculatively.

**Shipped:**
- **M1** — Predicted-pane sub-architecture: `renderers/prediction/` (sub-conductor, sub-layout-manager, `util.js`, 7 displayers). New Window-1 displayers drop in via 3 edits.
- **M2** — `cobham-stack.js` + `synchroscope.js` displayers; engines gained `tower.u_per_level`/`W_per_level` and a `phase_locking` block.
- **Mock-dataset slice (MDS)** — thin, brought-forward M7 + M-Inversion + M8: Data Engine (loads `fixtures/fake-empirical.json`), Inversion Engine, Audit Engine (four-category classifier), Windows 2/3 renderers.
- **M6** — gFDR observables wiring + slice-hardening #1–4. The Predicted pane's gFDR signature is ensemble-derived; `math/ensemble-locus.js` + `math/debounce.js`.
- **M-Inversion proper** *(this session — commit `b4a501b`)* — the Inversion Engine's chit fit is now two-stage: analytical localise over the full range, then an ensemble-derived refine of a 7-candidate window (`computeEnsembleLocus` + the coarse `SCORING_ENSEMBLE_OPTS` preset). Cooperative-band divergence (Q7) is handled per-candidate with an analytical fallback; `fit_provenance.observable_used.chit` records the path actually taken (`gfdr-locus-ensemble | ...-analytical | ...-hybrid`). **Bundled with slice-hardening #6 + #7:** new `math/phase-locking-model.js` gives γ_AB the phase-locking observable D1 called for (γ_AB is fit when the upload carries `scalar_observables.phase_locking_r`, carried through unconstrained otherwise); new `fixtures/fake-empirical-consistent.json` is the framework's own forward model, so the audit can finally hit `match`. Data Engine gained a `FIXTURE_URLS` map keyed by the `FILE_DROPPED` payload (default unchanged). `fit_provenance` carries the three slot-aware forward-compat fields (`fitted_params`, `observable_used`, `substrate_class_id`).
- **Docs reconciliation** *(this session — commit `494d35a`)* — folded a parallel foundational-session conversation into the docs: `foundational-answers.md` gained §Q8 (phase-locking r conditioning), §Q9 (unclassified data — declaration-first), §Q10 (manifest versioning), §11 (scoping discipline), §12 (About / Check-for-update). `foundational-questions.md` Q8/Q9/Q10 marked ANSWERED.

**The cascade** (works end to end, verified in Chrome):
`FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA`. Verified both ways: the default fixture → `topological_miss` (regression-free), the framework-consistent fixture → `match` (chit and γ_AB both recovered exact).

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

---

## 2. The roadmap, honestly

M1, M2, MDS, M6, M-Inversion proper shipped. The audit pipeline's dependency chain was **M6 → M7 → M-Inversion → M8**; M6 and M-Inversion proper are done. **M7 proper** (real CSV path + Empirical-pane sub-architecture) and **M8 proper** (Window 3 sub-architecture + spark-gap + persistence) are the two remaining links — both feed M-Corpus. M3 / M4 / M5 (dynamics visualization) are untouched and independent.

The foundational session resolved Q1–Q10 — `foundational-answers.md` is now the shape constraint for M7 proper, M8 proper, and M-Corpus. Read it before scoping. In particular: **Q9 (declaration-first gap-detection + declaration trail) is a ready design that lives in M7-proper territory** — M7 proper should implement it, not re-derive it.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **M7 proper (recommended)** | Real CSV ingestion (PapaParse) + the Empirical-pane sub-architecture mirroring M1 + **Q9's declaration-first gap-detection** (`foundational-answers.md` §Q9): a gap-detection pass before the fit, typed `DECLARATION_GAPS`, a declaration trail on `DataUpload`/`AuditDelta`. Also the Q1 per-column metadata (`coverage_range` / `validity_range` / `range_source`). | The next link that unblocks *real* data — today the auditor only ever audits fixtures. Q9 is a ready design, not a research question. Big but well-specified. **Live tension:** the gap-prompt UI is a new component; scope it thin (the foundational-answers §Q9 "friction guard" matters). |
| M8 proper | Window 3 sub-architecture + spark-gap visualization + `(DataUpload, AuditDelta)` persistence (the basic write M-Corpus builds on) + replace the leading-order topology/scope heuristics. Audit-mode as first-class app state (D4). | Completes the audit's *display* side and the persistence M-Corpus needs. Doesn't need M7 proper — works on the existing fixture path. A strong alternative if you'd rather finish the audit display before opening the real-data floodgates. |
| Q8 conditioning-detection slice | A small slice: detect `degenerate_r_band` / `saturated_cooperative` / `non_monotonic_sliver` at fit time and enrich `fit_provenance.fitted_params` from flat strings to the conditioning-carrying object (`foundational-answers.md` §Q8 forward shape). | Small, makes the phase-locking γ_AB fit *honest* — right now nothing flags that a real measured r is a weak constraint. Good warm-up or pairing with M8 proper. |
| M3 / M4 / M5 — dynamics visualization | Ignition control, Caputo ghost trails, Three.js phase portrait. Independent, parallelizable. | "Show," not scientifically load-bearing. Pick for a change of pace. |
| Full amplitude fit | Extend M-Inversion proper to fit α_s / P_s, not just chit + γ_AB. | Real, but α_s / P_s ride the same gFDR locus as chit — lower marginal value than opening a new observable or a new pane. |

The user has repeatedly chosen to collapse sequential sessions into one build — offer **M7 proper + the Q8 conditioning-detection slice** as a live bundle (Q8 is small and the conditioning state belongs in the same `fit_provenance` M7's declaration trail will sit next to).

---

## 4. Detailed brief — M7 proper

**Object.** The Data Engine currently loads a pre-shaped contract-05 JSON fixture (`FIXTURE_URLS` map, MDS + M-Inversion-proper). M7 proper makes it ingest a *real* CSV: PapaParse, column-metadata, the Q1 range stanza, and — the load-bearing new piece — **Q9's declaration-first gap-detection**.

**Read first.** `foundational-answers.md` §Q9 (the full declaration-first design — gap-detection pass, typed `DECLARATION_GAPS`, declaration trail, partial-audit-on-unanswered-gaps, the friction guard), §Q1 (the `column_metadata` stanza: `coverage_range` computed, `validity_range` declared, `range_source` honesty flag), §Q3+Q5 (tier: `'user'` on upload, `validation.status: 'user_unvalidated'`), and §11 (LLM assistance is upstream-only — M7 proper does *not* call an LLM; it accepts a researcher-signed declaration bundle).

**What ships.**
1. Real CSV ingestion in `engines/data-engine.js` (PapaParse via CDN — already in the toolchain table). Compute `coverage_range` per column on load; accept declared `validity_range`; default it with `range_source: 'computed'`.
2. The **gap-detection pass** — after parse, before the fit: walk the declared substrate-class against the manifest (or `'unclassified'`), the column metadata, the observable coverage; emit `DECLARATION_GAPS` (internal event, typed list per §Q9).
3. The **Empirical-pane sub-architecture** mirroring M1 — `renderers/empirical/` with a sub-conductor + displayers. The gap-prompt component lives here. Provenance panel, validity-range display, tier badge.
4. **Declaration trail** on `DataUpload` (and echoed to `AuditDelta` by the Audit Engine) — rides `additionalProperties`, no contract edit.
5. `tier: 'user'` + `validation` stamped on uploaded data; the seed-corpus path (curated tier) is **not** M7 proper — that's a curation session (§11, §Q2).

**Files likely owned:** `engines/data-engine.js`; new `renderers/empirical/**` (sub-architecture); a thin shim in `renderers/empirical-window.js`; possibly a new `engines/declaration-engine.js` if the gap logic gets thick. **Do NOT touch:** `contracts/**`, the M1 `renderers/prediction/` sub-architecture, the other engines' core logic, `vendor/**`.

**Watch:** the gap-prompt UI is the scope risk — keep it thin, a typed prompt list, not a wizard. The Q9 "friction guard" (declaration provenance visible *in the result*, not buried) is load-bearing — don't skip it. PapaParse handles real-world CSV weirdness; lean on it, don't hand-roll parsing.

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`:
1. No regression — both fixtures still run the cascade end to end (default → `topological_miss`, consistent → `match`); console clean.
2. A real CSV drops, parses, and produces a contract-05-shaped `DATA_READY` with `column_metadata` and `tier: 'user'`.
3. A CSV with a gap (unknown class, or a column with no `validity_range`) raises a typed `DECLARATION_GAPS`, the gap-prompt renders, and an answered gap lands in the declaration trail.
4. The declaration trail rides through to `AuditDelta` and is visible in Window 3.
5. Append an M7-proper Session Log row to `README.md`; flip the M7 roadmap row; commit with the co-author tag, push, report the SHA. Write the superseding handoff.

---

## 5. Backlog — what is still owed

**Slice-hardening (was §5 of the prior handoff):**
- #1–4 shipped in M6. **#6, #7 shipped in M-Inversion proper.**
- **#5 — name the implicit inversion intent.** The Inversion Engine minimises L2 locus residual — an unnamed RFC-S §3 intent (closest to I5 / signature-preserving). Name it before any intent-selection UI. Intent UI, when it lands, belongs near the Empirical-load / Audit pane — **not** the global Settings dropdown.

**From M-Inversion proper:**
- The **full α_s / P_s amplitude fit** (M-Inversion proper fit chit + γ_AB only).
- A **UI selector for the framework-consistent fixture** — it's currently only reachable via the `FILE_DROPPED` payload (`{ fixture: 'consistent' }`); the Data Engine's `FIXTURE_URLS` map is keyed but unwired to UI.
- **Q8 conditioning-detection** — see §3. M-Inversion proper shipped flat `fit_provenance`; the conditioning-carrying `fitted_params` object (`foundational-answers.md` §Q8) is the forward shape, not yet built.

**Owed since MDS:**
- M8 proper — Window 3 sub-architecture + spark-gap viz + `(DataUpload, AuditDelta)` persistence + replace the leading-order topology/scope heuristics.
- Audit-mode as first-class app state (D4) — M6 landed a thin `app_mode` stamp; the full version is M1-territory (`layout-manager` / `index.html`).
- M-Corpus — the typed manifest (`foundational-answers.md` §Q6); needs M7 + M8.
- §12 — the About panel + Check-for-update (its own session, post M7 proper; `foundational-answers.md` §12).

**Upstream (not the auditor's to resolve — `foundational-answers.md` §11):**
- **Q7 + Q8b** — the cooperative-kernel saturation question, now seen through *two* observables (the gFDR locus and phase-locking r). Goes to `mpa-atlas` as one RFC-S Appendix B item.
- **Q8c** — non-monotonicity of r(γ_AB) in the well-conditioned sliver; wants its own observable-design conversation.

---

## 6. Audit-mode flag — still thin

M6 slice-hardening #3 was done *thin*: the engines stamp `*_state.app_mode = 'audit' | 'explore'` (derived from whether `parameters.fit_provenance` is present). The **full** version — audit-mode as first-class application state with its own UI affordance — needs `layout-manager` / `index.html` changes (M1-territory), so it is still deferred to the session that makes Audit a real mode (M8 proper is the natural home). Don't mistake the stamp for the finished feature.

---

## 7. Solver findings — still load-bearing

`H:\mpa-solver` **is at `v2.0.0`** (`git describe` confirms; the auditor vendors the v2 WASM in `vendor/mpa-solver/`). The stale `docs/mpa-solver-handoff.md` is the *v0* build brief and carries a superseded-banner — current solver scope is `docs/mpa-solver-v2-handoff.md` + `vendor/mpa-solver/README.md`.

Three things M6 discovered about the vendored v2 observables, all still in force:

1. **The solver leaves FDT normalisation to the consumer — by design.** `observables.gfdrLocus` pairs the *raw* connected correlator `ΔC = C(0)−C(τ)` with the *raw* direct-perturbation response `χ_AA(τ)` — and `responseDirect` returns the IC-perturbation **propagator** (which decays), not the integrated susceptibility. The consumer-side fix (in `math/ensemble-locus.js`) is the Onsager / Cugliandolo-Kurchan normalisation: `ΔC_norm = ΔC/C(0)`, `χ_norm = 1 − χ_AA(τ)/χ_AA(0)`. **Reuse this normalisation** — don't re-derive it, don't trust raw `gfdrLocus` output without it.

2. **`fit_invariants()` operates on the *un-normalised* locus.** Its `X_r / X_c / α_s` and regime label are unreliable as-shipped. The auditor does not call `fit_invariants` yet — a session that wants to should normalise the locus first.

3. **The cooperative kernel has an unsaturated runaway branch.** `−γ_AB·ρ_A·ρ_B` for cooperative coupling (γ_AB < 0) is `+|γ_AB|·ρ_A·ρ_B` — a positive quadratic feedback the Lamb closure does **not** saturate. Deterministically it runs away above chit≈1; the stochastic ensemble escapes even at modest positive chit. M-Inversion proper's verification confirmed this surfaces reliably as `gfdr-locus-hybrid` in the cooperative band. **Not a solver bug** — the solver implements cdv1 as specified. It is the framework question Q7/Q8b for `mpa-atlas`, *and* it is why the phase-locking γ_AB observable saturates in the cooperative band (Q8b). New session: if you touch the ensemble path, expect divergence in the cooperative band — that is correct behaviour, handled by the guard in `computeEnsembleLocus` and the sane-bounds check in the Inversion Engine.

---

## 8. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at `H:\mpa-auditor\.claude\launch.json`. Do **not** revert to `python -m http.server` — it serves stale ES modules across edits. `.claude/` is untracked (intentional per the machine `CLAUDE.md`); re-check `launch.json` exists at session start.
- **Verify in Chrome.** Use the preview MCP (`preview_start` with name `mpa-auditor`). `preview_screenshot` times out intermittently while the page is fine — fall back to `preview_eval` DOM inspection. `window.bus` is the event bus (`bus.publish` / `bus.subscribe` / `bus.log`); `window.solver` is the WASM surface. To exercise the framework-consistent fixture: `bus.publish('FILE_DROPPED', { fixture: 'consistent' })`. M-Inversion proper's ensemble refine takes a few seconds — poll for the cascade, don't assume it's synchronous.
- No build step. Plotly + KaTeX + PapaParse via CDN; solver vendored as WASM.

---

## 9. References

- `README.md` — architecture, roadmap, Session Log (read the `M-Inversion proper`, `M6`, and `MDS` rows).
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — a pair, read together at session start. Questions is the append-as-you-go log of open architectural questions; Answers is the resolved-decision record (revisable, not frozen). **Q1–Q10 are now ANSWERED** — `foundational-answers.md` is the *shape constraint* on M7 proper / M8 proper / M-Corpus outputs. **§11 is the scoping discipline; §Q9 is the ready design M7 proper implements; §Q1 is M7's column-metadata stanza.**
- `docs/rfc-s-integration-notes.md` — the 7 RFC-S discoveries from the slice; D1 (γ_AB observable-sufficiency) is now partially addressed by M-Inversion proper's #6 and sharpened by Q8.
- `docs/mpa-solver-v2-handoff.md` — current solver scope. (`docs/mpa-solver-handoff.md` is the v0 brief — superseded, banner at top.)
- `math/ensemble-locus.js` — the ensemble pipeline + Onsager normalisation + the `SCORING_ENSEMBLE_OPTS` coarse preset; `math/gfdr-model.js` — the canonical analytical forward model; `math/phase-locking-model.js` — the γ_AB observable (M-Inversion proper).
- `engines/inversion-engine.js` — the two-stage fit (read it before any fit-adjacent work); `engines/data-engine.js` — the `FIXTURE_URLS` load path M7 proper extends.
- `H:\mpa-solver` — the solver source, at `v2.0.0`.
- `H:\mpa-atlas\rfcs\MPA-RFC-S_Scale-Management.md` — thin-RFC discipline governs that repo (read `H:\mpa-atlas\CLAUDE.md` before touching it). Q7/Q8b/Q8c are headed there.

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes the M6 handoff — that work shipped.

**First move:** confirm the next-session pick with the user (§3). The rest of this brief details the *recommended* pick (M-Inversion proper); the others are sketched.

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight **immutable** JSON contracts in `/contracts/`. If a session thinks a contract is wrong, it raises a question — never edits one. Every extension this far has ridden `additionalProperties` on contract 01's `parameters` and on the `*_state` objects — keep doing that; do not add contracts speculatively.

**Shipped:**
- **M1** — Predicted-pane sub-architecture: `renderers/prediction/` (sub-conductor, sub-layout-manager, `util.js`, 7 displayers). New Window-1 displayers drop in via 3 edits.
- **M2** — `cobham-stack.js` + `synchroscope.js` displayers; engines gained `tower.u_per_level`/`W_per_level` and a `phase_locking` block.
- **Mock-dataset slice (MDS)** — thin, brought-forward M7 + M-Inversion + M8: Data Engine (loads `fixtures/fake-empirical.json`), Inversion Engine (grid-search fits chit), Audit Engine (four-category classifier), Windows 2/3 renderers.
- **M6 — gFDR observables wiring + slice-hardening (combined).** The Predicted pane's gFDR signature is now **ensemble-derived**. Both engines paint the analytical locus synchronously, then a debounced follow-up `PREDICTION_READY` carries the ensemble locus (`*_state.locus_source` flips `analytical → ensemble`). New `math/ensemble-locus.js` (the `ensemble → correlator → responseDirect → gfdrLocus` pipeline + the Onsager normalisation — see §7) and `math/debounce.js`. Slice-hardening §5 items **1–4** landed: gfdr-model de-dup, audit pairs by `data_id`, per-`substrate_class` scope threshold, explicit `app_mode` stamp.

**The cascade** (works end to end, verified in Chrome):
`FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA` — final audit `topological_miss`, unchanged since MDS.

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

---

## 2. The roadmap, honestly

M1, M2, MDS, M6 shipped. MDS landed *thin* M7 / M-Inversion / M8 — the README roadmap rows for those carry explicit `[Thin slice landed … Still owed: …]` notes. M3 / M4 / M5 are untouched. The audit pipeline's dependency chain was **M6 → M7 → M-Inversion → M8**; M6 is done, so **M-Inversion proper** is the next load-bearing link. Read the README Session Log (`M6` and `MDS` rows) and `docs/rfc-s-integration-notes.md` before scoping.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **M-Inversion proper (recommended)** | Replace the Inversion Engine's *analytical* grid-search scoring with **ensemble-derived** scoring, now that M6 makes the ensemble locus available. Fits the full amplitude set the README promises (α_s, P_s, chit; γ_AB is still unconstrained by a gFDR locus — D1). | The next link in the audit chain; directly serves "the audit is the main thing." **Live design tension:** the cooperative band's ensemble locus diverges (§7) — M-Inversion proper must decide how to score candidates there (hybrid analytical/ensemble? constrain the grid? declare the band out-of-gamut?). That decision may surface a framework question for `mpa-atlas`. |
| Slice-hardening §5 (#5–7) | Name the implicit inversion intent (#5); add a γ_AB-constraining observable (#6); build a framework-consistent fixture (#7). | #7 is a small warm-up that unblocks exercising the `match` / `numerical_miss` audit branches and seeds M-Corpus. #6 is a real prerequisite for fitting γ_AB. Good pairing with M-Inversion proper, or a lower-risk standalone. |
| M3 / M4 / M5 — dynamics visualization | Ignition control, Caputo ghost trails, Three.js phase portrait. Independent, parallelizable. | "Show," not scientifically load-bearing. Pick for a change of pace. |
| M7 proper — real CSV path | Replace the mock-fixture-only Data Engine with PapaParse CSV ingestion + the Empirical-pane sub-architecture. | Needed before real datasets / M-Corpus, but not blocking M-Inversion. |

The user has repeatedly chosen to collapse sequential sessions into one build — offer **M-Inversion proper + slice-hardening #6/#7 combined** as a live option.

---

## 4. Detailed brief — M-Inversion proper

**Object.** The Inversion Engine (`engines/inversion-engine.js`) currently grid-searches chit by minimising the *analytical* gFDR-locus residual (`math/gfdr-model.js` `locusResidual`). M6 made the *displayed* locus ensemble-derived; M-Inversion proper makes the *fit* score against the ensemble-derived locus too — closing the "forward-model fidelity bounds round-trip fidelity" gap (rfc-s-integration-notes.md D5).

**The hard part is the cooperative-band divergence (§7), not the wiring.** A naive grid search calls `computeEnsembleLocus` per chit candidate — but it diverges across the cooperative half of the chit range and each call is ~2 s. So M-Inversion proper must answer: (a) score against the ensemble locus where it converges and the analytical locus where it diverges (a documented hybrid)? (b) restrict the grid to the convergent band? (c) treat divergent candidates as out-of-gamut? Pick one, document why, and flag whether it implies a framework question for `mpa-atlas` (does cdv1 intend the cooperative term to saturate?).

**Files likely owned:** `engines/inversion-engine.js`; possibly a coarsened/cached ensemble path in `math/ensemble-locus.js` (the per-candidate cost matters for a grid search — consider a smaller ensemble / fewer τ for *scoring* vs the *display* path). **Do NOT touch** `contracts/**`, the M1 sub-architecture files, the other engines' core logic, `vendor/**`.

**Forward-compat obligations — from `foundational-answers.md` (§Q6, §"Cross-cutting").** These are narrow and add no contract; they make this session's outputs ingestible by M-Corpus later. Do exactly these three, no more:
1. `fit_provenance` gains three slot-aware string fields (riding `parameters.additionalProperties` on contract 01, where `fit_provenance` already lives): `fitted_params` (which canonical parameters were constrained vs carried through — e.g. `γ_AB: 'unconstrained_by_gfdr_locus_d1'`), `observable_used`, and `substrate_class_id` (defaults to `'unclassified'`).
2. The cooperative-band scoring decision (the (a)/(b)/(c) choice above) **is recorded as the value of `fit_provenance.observable_used`** — `'gfdr-locus-analytical' | 'gfdr-locus-ensemble' | 'gfdr-locus-hybrid'`. The design decision becomes self-documenting under audit.
3. **No M-Corpus, no manifest, no class registry this session.** M-Inversion's job is to make its outputs *consumable* by those — three string fields, not a refactor. Resist "while I'm here."

Read `foundational-answers.md` §Q6 + §"Cross-cutting" before starting — they are the shape constraint on this session's outputs (revisable: if you hit real friction, append a note there, don't silently diverge).

**Watch:** the ensemble path needs the WASM solver — verify in **Chrome** (Edge/Firefox fail the WASM — known, deferred). The grid-search cost is the real risk; budget it.

**Acceptance test.** Serve the repo (§8), open `http://localhost:8000`, drop the fixture:
1. No regression — the cascade still runs end to end; console clean.
2. The fit scores against the ensemble-derived locus (where convergent), and `fit_provenance` carries the three slot-aware fields — `observable_used` reflects the actual scoring path taken.
3. The cooperative-divergence handling behaves as documented — no runaway, no hang, no silent garbage.
4. **Q7** (does cdv1's universal two-mode kernel intend the cooperative cross-term to saturate?) is promoted from open to tracked in `foundational-questions.md`, regardless of which scoring path was chosen — it is a framework question for `mpa-atlas` per RFC-S Appendix B item 4 (D1).
5. Append an M-Inversion Session Log row to `README.md`; flip the roadmap row; commit with the co-author tag, push, report the SHA.

---

## 5. Slice-hardening backlog (remaining)

§5 items 1–4 shipped in M6. Still open:

5. **Name the implicit intent.** The Inversion Engine minimises L2 locus residual — an unnamed RFC-S §3 intent (closest to I5 / signature-preserving). Name it before any intent-selection UI. Intent UI, when it lands, belongs near the Empirical-load / Audit pane — **not** the global Settings dropdown.
6. **γ_AB is unconstrained by a gFDR locus.** The locus depends on chit alone. M-Inversion proper needs a manifold- or phase-locking-shaped observable to fit γ_AB. (rfc-s-integration-notes.md D1; RFC-S Appendix B item 4.)
7. **Framework-consistent fixture.** `fixtures/fake-empirical.json` is not framework-consistent (its χ-vs-ΔC is diagonal while its C(τ) ages) — the audit honestly returns `topological_miss` on it. A consistent fixture would exercise the `match` / `numerical_miss` branches and seed M-Corpus.

Also still owed (from the MDS thin slice): real CSV path + Empirical-pane sub-architecture (M7 proper); Window 3 sub-architecture + spark-gap visualization + `(DataUpload, AuditDelta)` persistence (M8 proper); audit-mode as first-class app state (D4 — M6 landed a thin `app_mode` stamp in `*_state`, but the full version is real app state, which is M1-territory files).

---

## 6. Audit-mode flag — what M6 did and didn't do

M6 slice-hardening #3 was done *thin*: the engines stamp `*_state.app_mode = 'audit' | 'explore'` (derived from whether `parameters.fit_provenance` is present). That makes the distinction explicit in the contract flow. The **full** version — audit-mode as first-class application state with its own UI affordance — needs `layout-manager` / `index.html` changes (M1-territory), so it was deliberately left for the session that makes Audit a real mode (post M-Inversion proper). Don't mistake the stamp for the finished feature.

---

## 7. Solver findings from M6 — read before M-Inversion proper

`H:\mpa-solver` **is at `v2.0.0`** (`git describe` confirms; the auditor vendors the v2 WASM in `vendor/mpa-solver/`). The stale `docs/mpa-solver-handoff.md` is the *v0* build brief and now carries a superseded-banner — current solver scope is `docs/mpa-solver-v2-handoff.md` + `vendor/mpa-solver/README.md`.

Three things M6 discovered about the vendored v2 observables:

1. **The solver leaves FDT normalisation to the consumer — by design.** `observables.gfdrLocus` pairs the *raw* connected correlator `ΔC = C(0)−C(τ)` with the *raw* direct-perturbation response `χ_AA(τ)` — and `responseDirect` returns the IC-perturbation **propagator** (which decays), not the integrated susceptibility. The solver's own `test_gfdr_regimes.cpp` comment is explicit: *"the exact numerical X_r depends on the framework's chosen normalization (1/T_eff factor), which is a downstream calibration concern."* M6's consumer-side fix (in `math/ensemble-locus.js`) is the Onsager / Cugliandolo-Kurchan normalisation: `ΔC_norm = ΔC/C(0)`, `χ_norm = 1 − χ_AA(τ)/χ_AA(0)`. In equilibrium Onsager regression gives `χ/χ(0) = C/C(0)`, so the locus is the diagonal; FDT-violating (aging / c) regimes depart from it. **Reuse this normalisation** — don't re-derive it, and don't trust any raw `gfdrLocus` output without it.

2. **`fit_invariants()` operates on the *un-normalised* locus.** Its `X_r / X_c / α_s` and its regime label are therefore unreliable as-shipped (observed: it labelled a deep_r config "c" and returned negative `α_s`). The auditor does not call `fit_invariants` yet — but a session that wants to should normalise the locus first, or treat the solver's labels as raw. Worth raising upstream whether `fit_invariants` should normalise internally.

3. **The cooperative kernel has an unsaturated runaway branch.** `dρ_A/dt` carries `−γ_AB·ρ_A·ρ_B`, which for cooperative coupling (γ_AB < 0) is `+|γ_AB|·ρ_A·ρ_B` — a positive quadratic feedback the Lamb closure does **not** saturate (it only saturates the linear gain). Deterministically it runs away to ∞ above chit≈1; the *stochastic ensemble* escapes into that branch even at modest positive chit (incl. the fixture's fitted chit≈0.15). `computeEnsembleLocus` detects the non-finite result and throws; the engine catches it and keeps the analytical locus. **This is not a solver bug** — the solver implements cdv1 as specified, and an upper clamp would silently alter the math without a substrate-specific saturation scale. It *is* a candidate **framework question for `mpa-atlas`**: does cdv1 §"Universal kernel" intend the cooperative cross-term to saturate? And it is the live design constraint for M-Inversion proper (§4).

---

## 8. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at `H:\mpa-auditor\.claude\launch.json`. Do **not** revert to `python -m http.server` — it serves stale ES modules across edits. `.claude/` is untracked (intentional per the machine `CLAUDE.md`); re-check `launch.json` exists at session start.
- **Verify in Chrome.** Use the preview MCP (`preview_start` with name `mpa-auditor`). `preview_screenshot` times out intermittently while the page is fine — fall back to `preview_eval` DOM inspection (`document.querySelector('#fdr-plot').data` exposes the Plotly traces; `window.bus.log` is the full event history; `window.solver` is the WASM surface for console probing).
- No build step. Plotly + KaTeX via CDN; solver vendored as WASM.

---

## 9. References

- `README.md` — architecture, roadmap, Session Log (read the `M6` and `MDS` rows).
- `docs/foundational-questions.md` + `docs/foundational-answers.md` — a pair, read together at session start. Questions is the append-as-you-go log of open architectural questions (append when one surfaces, mark **ANSWERED** when resolved). Answers is the resolved-decision record: contract shape, files touched, what's deferred — the *shape constraint* on a session's outputs (revisable, not frozen). **M-Inversion proper: `foundational-answers.md` §Q6 and §"Cross-cutting" place three concrete obligations on this session — see §4 below.** Q7 (cooperative-kernel saturation) is the open framework question this session promotes.
- `docs/rfc-s-integration-notes.md` — the 7 RFC-S discoveries from the slice; D1/D5 feed §4 and §5.
- `docs/mpa-solver-v2-handoff.md` — current solver scope. (`docs/mpa-solver-handoff.md` is the v0 brief — superseded, banner at top.)
- `math/ensemble-locus.js` — the M6 ensemble pipeline + the Onsager normalisation; `math/gfdr-model.js` — the canonical analytical forward model.
- `H:\mpa-solver` — the solver source, at `v2.0.0`. `include/mpa_solver/observables.hpp` + `src/observables.cpp` + `tests/test_gfdr_regimes.cpp` are the ground truth for the observables API and its intended (consumer-normalised) usage.
- `H:\mpa-atlas\rfcs\MPA-RFC-S_Scale-Management.md` — thin-RFC discipline governs that repo (read `H:\mpa-atlas\CLAUDE.md` before touching it).

**Do not implement beyond the chosen session's scope. Resist "while I'm here."**

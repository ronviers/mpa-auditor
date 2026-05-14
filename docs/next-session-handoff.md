# Next-session handoff — mpa-auditor

**You are a fresh Claude Code session.** This brief is self-contained. The repo is `H:\mpa-auditor`, also at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes nothing — the M1 and M2 handoffs were retired when their work shipped.

**First move:** confirm the next-session pick with the user (§3). The rest of this brief details the *recommended* pick (M6); the others are sketched.

---

## 1. State of play — what is real

Hub-and-spoke, vanilla ES modules, no build step. Eight **immutable** JSON contracts in `/contracts/` (01 StateRequest, 02 PredictedLocus, 03 AuditDelta, 04 ModuleRegistration, 05 DataUpload, 06 ErrorReport, 07 ThemeBundle, 08 SelectionChanged). If a session thinks a contract is wrong, it raises a question — never edits one.

**Shipped:**
- **M1** — Predicted-pane sub-architecture: `renderers/prediction/` (sub-conductor, sub-layout-manager, `util.js`, 7 displayers). New Window-1 displayers drop in via 3 edits; see a worked displayer (`invariants-panel.js` simplest, `gfdr-signature.js` for Plotly).
- **M2** — `cobham-stack.js` + `synchroscope.js` displayers; both engines gained `tower.u_per_level`/`W_per_level` and a `phase_locking` block inside `*_state`.
- **Mock-dataset slice** — thin, brought-forward M7 + M-Inversion + M8:
  - **Data Engine** (`engines/data-engine.js`) — loads `fixtures/fake-empirical.json` (contract 05), validates, publishes `DATA_READY` + `SELECTION_CHANGED`.
  - **Inversion Engine** (`engines/inversion-engine.js`) — grid-search fits chit to the empirical gFDR locus against `math/gfdr-model.js` (shared analytical forward model), emits a parameter-populated `STATE_REQUEST`.
  - **Audit Engine** (`engines/audit-engine.js`) — full four-category classifier, emits `AUDIT_DELTA`.
  - **Windows 2/3 renderers** (`renderers/empirical-window.js`, `renderers/audit-window.js`) — single thin renderers, not M1-style sub-architectures.
  - RFC-S tie-in: `docs/rfc-s-integration-notes.md` (7 discoveries) + RFC-S Appendix B item 4 in `H:\mpa-atlas`.

**The cascade** (works end to end, verified in Chrome):
`FILE_DROPPED → DATA_READY → SELECTION_CHANGED → STATE_REQUEST(fitted) → PREDICTION_READY → AUDIT_DELTA`.

**Contract discipline that is paying off:** `additionalProperties: true` on contract 01's `parameters` and on the `*_state` objects is the extension valve. Every extension this far (tower fields, `phase_locking`, `fit_provenance`, `substrate_class`) rode in through it with zero contract changes. Keep doing this; do not add contracts speculatively.

**Still stubs:** `renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`.

---

## 2. The roadmap, honestly

M1, M2 shipped. The mock-dataset slice landed *thin* versions of M7 / M-Inversion / M8 — the README roadmap rows for those three carry explicit `[Thin slice landed … Still owed: …]` notes. M3 / M4 / M5 / M6 are untouched. Read the README Session Log (`MDS` row) and `docs/rfc-s-integration-notes.md` before scoping.

---

## 3. Pick the next session

| Option | What it is | Why / why not |
|---|---|---|
| **M6 — gFDR observables wiring (recommended)** | Replace the engines' analytical gFDR locus with the solver's ensemble-derived one; debounced async; "computing…" indicator. | It is the gateway dependency. The slice's #1 named limitation is "the fit scores against the *analytical* locus." M6 makes the displayed signature ensemble-derived; it is the prerequisite for **M-Inversion proper** (ensemble-derived *scoring* in the fit) the session after. Directly serves "the audit is the main thing." |
| Slice-hardening | Work the §4 backlog: correlation tracking, substrate-declared out-of-scope threshold, audit/explore flag, `gfdr-model.js` de-dup. | Lower-risk consolidation. The correlation-tracking gap is a real fragility that bites at M-Corpus scale. Strong second choice; could be folded into M6 if the user wants the combined play. |
| M3 / M4 / M5 — dynamics visualization | Ignition control, Caputo ghost trails, Three.js phase portrait. Independent, parallelizable. | "Show," not scientifically load-bearing. Pick only if a change of pace is wanted. |
| Framework-consistent fixture | Build a synthetic dataset that *is* framework-consistent (the current fixture is not — discovery D7). | Small. Unblocks exercising the `match` / `numerical_miss` audit branches and seeds M-Corpus. Good warm-up or pairing with another option. |

The user has twice chosen to collapse sequential sessions into one build — offer **M6 + slice-hardening combined** as a live option if they want it.

---

## 4. Detailed brief — M6 (gFDR observables wiring)

**Object.** The Predicted pane currently shows an *analytical* gFDR locus from each engine's `generateLocus()`. M6 replaces it with the **ensemble-derived** locus computed from the vendored solver's observables.

**The math is already vendored.** `math/solver-service.js` exposes `observables.correlator`, `observables.responseDirect`, `observables.gfdrLocus`, `observables.fitInvariants`. They are unwired because a 200-trajectory ensemble + response is ~2 s — too slow for per-slider-tick. M6's real work is the **debounced async wiring**, not the math.

**Files owned:** `engines/character-engine.js`, `engines/discrete-engine.js`, `renderers/prediction/displayers/gfdr-signature.js`. Possibly a small debounce helper in `math/`.

**Do NOT touch:** `contracts/**`, `renderers/prediction/sub-conductor.js` / `sub-layout-manager.js` / `util.js`, the other displayers, `engines/data-engine.js` / `inversion-engine.js` / `audit-engine.js`, `renderers/empirical-window.js` / `audit-window.js`, `math/gfdr-model.js`, `vendor/**`.

**Approach.**
1. Engines keep emitting the analytical `locus_points` synchronously for first paint (so nothing blocks). After a debounce window settles, run the ensemble path and emit a follow-up `PREDICTION_READY` (or a refinement) with `locus_points` replaced by the ensemble-derived locus. Mark which one it is inside `*_state` (e.g. `locus_source: 'analytical' | 'ensemble'`) — `additionalProperties` allows it.
2. `gfdr-signature.js` shows a "computing…" cue while the ensemble is in flight, then re-renders on the ensemble result.
3. Debounce on slider scrub: only the *settled* operating point triggers the ensemble run; in-flight runs for superseded parameters are dropped.

**Watch:** the ensemble path needs the WASM solver — verify in **Chrome** (the vendored WASM only runs cleanly there; Edge/Firefox fail it — known, deferred).

**Acceptance test.** Serve the repo (§6), open `http://localhost:8000`:
1. No regression — Window 1 paints immediately with the analytical locus; M1/M2 displayers unaffected; console clean.
2. After the slider settles, a "computing…" cue appears, then the gFDR signature re-renders with the ensemble-derived locus.
3. Rapid slider scrub does not queue a backlog of ensemble runs — only the settled point computes.
4. Append an M6 Session Log row to `README.md`; flip the M6 roadmap row out of "untouched"; commit with the co-author tag, push, report the SHA.

**Downstream note.** M6 makes the *display* honest. The *fit* (`inversion-engine.js`) still scores against `math/gfdr-model.js` (analytical). Wiring ensemble-derived *scoring* into the fit is **M-Inversion proper**, the session after M6 — out of scope for M6 itself.

---

## 5. Slice-hardening backlog

Discovered/flagged during the mock-dataset slice. Not lost — pick into whichever session fits, or run as the "slice-hardening" option.

1. **Correlation tracking.** The cascade is fire-and-forget. The Audit Engine pairs prediction+data by "latest seen," not by id. `request_id`/`response_id` exist in contracts 01/02 but nothing threads them. Fix as a *discipline* (downstream pairs by id), not a contract change. **Do this before M-Corpus** — it breaks when multiple datasets are in flight.
2. **Out-of-scope threshold.** `audit-engine.js` uses a global `OUT_OF_SCOPE_MSE = 0.05`. RFC-S §2/§4 says the gamut boundary is substrate-specific — it should come from a driver profile. (`rfc-s-integration-notes.md` D3.)
3. **Audit-mode vs Explore-mode flag.** Currently implicit in `parameters.fit_provenance`. Should be first-class app state when Audit mode becomes real. (D4.)
4. **`gfdr-model.js` de-dup.** `character-engine.js` and `discrete-engine.js` still carry pre-existing local copies of `vertexRegime` / `alphaS` / `plateauHeight` / `generateLocus`. `math/gfdr-model.js` is the canonical version — point the engines at it.
5. **Name the implicit intent.** The Inversion Engine minimizes L2 locus residual — an unnamed RFC-S §3 intent (closest to I5 / signature-preserving). Name it before any intent-selection UI is added. Intent UI, when it lands, belongs near the Empirical-load / Audit pane — **not** the global Settings dropdown.
6. **γ_AB is unconstrained by a gFDR locus.** The analytical locus depends on chit alone. M-Inversion proper needs a manifold- or phase-locking-shaped observable to fit γ_AB. (D1; RFC-S Appendix B item 4.)
7. **Framework-consistent fixture.** `fixtures/fake-empirical.json` is not framework-consistent (its χ-vs-ΔC is diagonal while its C(τ) ages) — the audit honestly returns `topological_miss` on it. A consistent fixture would exercise the `match` / `numerical_miss` branches and seed M-Corpus. (D7.)

---

## 6. Dev environment

- **Server: `http-server -c-1` (no-cache).** `launch.json` (server name `mpa-auditor`) at both `H:\.claude\launch.json` and `H:\mpa-auditor\.claude\launch.json` is set to `npx -y http-server … -c-1`. Do **not** revert to `python -m http.server` — it sends no cache headers and serves **stale ES modules across edits**, which looks like "my edit didn't take." If a module registers an old `version`/`status` after an edit, that is stale cache, not a code bug: `fetch(url, {cache:'reload'})` the stale URL once from the page console, then reload.
- `.claude/` is untracked (intentional per the machine `CLAUDE.md`). The no-cache `launch.json` lives there — fragile; re-check it exists at session start. Commit `.claude/launch.json` only if the user asks.
- **Verify in Chrome.** Use the preview MCP (`preview_start` with name `mpa-auditor`). `preview_click` has been flaky at triggering real DOM clicks — if a click "succeeds" but nothing happens, dispatch the event via `preview_eval` (`el.dispatchEvent(new MouseEvent('click',{bubbles:true}))`) or publish the bus event directly to isolate. `preview_screenshot` has also timed out intermittently while the page is fine — fall back to `preview_eval` DOM inspection.
- No build step. Plotly + KaTeX via CDN; solver vendored as WASM.

---

## 7. References

- `README.md` — architecture, roadmap, Session Log (read the `MDS` row).
- `docs/rfc-s-integration-notes.md` — the 7 RFC-S discoveries from the slice; D1/D3/D4/D7 feed the §5 backlog.
- `contracts/01`,`02`,`03`,`05`,`06`,`08` — the cascade's contracts.
- `math/solver-service.js` — the `observables` namespace M6 wires in.
- `H:\mpa-atlas\rfcs\MPA-RFC-S_Scale-Management.md` — Appendix B item 4 is this work's spec feedback; thin-RFC discipline governs that repo (read `H:\mpa-atlas\CLAUDE.md` before touching it).

**Do not implement beyond the chosen session's scope. The other roadmap items are later sessions — resist "while I'm here."**

# M2 — Predicted-pane displayer additions (handoff)

**You are a fresh Claude Code session.** This brief is self-contained. The repo lives at `H:\mpa-auditor` and at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor). It supersedes `m1-predicted-pane-refactor-handoff.md` (M1 is shipped — that brief is spent).

## What M1 shipped (and is verified)

M1 carved the ~530-line `renderers/plotly-2d.js` monolith into a Window-1-scoped **displayer sub-architecture** under `renderers/prediction/`. Committed as `6cdbf8a` on `main`, pushed. Verified in-browser: same visual output, no console errors, slider scrub + manifold-click + theme toggle all work, drop-test passed.

```
renderers/
├── plotly-2d.js                    boot shim (~60 lines) — imports + inits the sub-arch
└── prediction/
    ├── sub-conductor.js            scoped event bus + displayer registry
    ├── sub-layout-manager.js       view-mode state + visibility composition
    ├── util.js                     stateless shared helpers (the ONE sanctioned cross-displayer import)
    └── displayers/
        ├── meta-strip.js           regime badge + KaTeX equation
        ├── trajectory-strip.js     ρ_A(t), ρ_B(t) from the WASM solver
        ├── regime-manifold.js      Plotly heatmap + bifurcations + crosshair (+ publishes MANIFOLD_PICK)
        ├── gfdr-signature.js       Plotly χ vs ΔC inset
        ├── invariants-panel.js     HTML list
        ├── patterns-panel.js       HTML list
        └── posits-strip.js         HTML strip
```

## The seam contract — this is what M2 builds against

**M2 adds one or two new displayers. M2 must NOT touch any existing displayer file, the sub-conductor, the sub-layout-manager, or util.js.** The drop-test in M1 proved a new displayer file drops in cleanly. If you find yourself editing an existing displayer, the seam is wrong — stop and reconsider.

### Displayer contract

Every displayer file exports exactly this surface:

```js
import { subBus } from '../sub-conductor.js';
import { colors, regimeColor, escapeHTML } from '../util.js';   // import only what you need

export const id = 'cobham_stack_v1';            // snake_case, must match /^[a-z][a-z0-9_]*_v\d+$/
export const view_modes = ['taxonomic'];        // non-empty array; see "Which view?" below
export const mount_target = '#cobham-stack';    // CSS selector string for the element it renders into

let theme = null;
let lastPrediction = null;
let initialized = false;

function render() {
  if (!lastPrediction) return;
  // ... read lastPrediction.continuous_state || lastPrediction.discrete_state, render into mount_target
}

export function init() {                        // idempotent — guard with `initialized`
  if (initialized) return;
  subBus.subscribe('SUB_PREDICTION_READY', p => { lastPrediction = p; render(); });
  subBus.subscribe('SUB_THEME_CHANGED',    t => { theme = t; render(); });
  subBus.register({ displayer_id: id, view_modes, mount_target });
  initialized = true;
  console.log(`[${id}] active`);
}
```

### Rules baked into the seam

- **Subscribe to the *sub-bus*, never the main bus.** The sub-conductor fans `PREDICTION_READY`→`SUB_PREDICTION_READY` and `THEME_CHANGED`→`SUB_THEME_CHANGED` in for you. The only existing exception: `regime-manifold.js` *publishes* `MANIFOLD_PICK` to the main bus because its consumer (Layout Manager) is a top-level module — mirror that pattern only if your displayer has a genuine top-level consumer.
- **Cache your own `lastPrediction` and `theme`.** Each displayer re-renders independently on theme change. Don't reach into another displayer's state.
- **`util.js` is the only cross-displayer import.** It's stateless: `readCSSVar`, `colors(theme)`, `regimeColor(regime, c)`, `escapeHTML(s)`. If you need a new shared helper, add it to `util.js` *only if it is genuinely stateless* — otherwise it belongs in your displayer.
- **Mode-neutral.** Read `prediction.continuous_state || prediction.discrete_state`. Exactly one is populated per prediction. Don't bake in continuous-only assumptions.
- **≤ 200 lines per displayer.** If you're creeping past, the carve-up has a seam in the wrong place.
- **No new dependencies.** Plotly + KaTeX + the solver are already loaded.

### Wiring a new displayer in

Three edits, nothing more:
1. Create `renderers/prediction/displayers/<name>.js`.
2. In `renderers/plotly-2d.js`: add an `import * as X from './prediction/displayers/<name>.js'` and append `X` to the `DISPLAYERS` array.
3. In `index.html` + `styles/shell.css`: add the DOM mount element(s) and styling, if your displayer needs new DOM. **Do not rename or remove M1's existing IDs** (`#manifold-plot`, `#fdr-plot`, `#trajectory-plot`, `#regime-badge`, `#prediction-equation`, `#invariants-list`, `#patterns-list`, `#posits-content`, `#trajectory-meta`, `#prediction-meta`).

### Which view? (`view_modes`)

The view-mode switcher has three options: `Taxonomic` (active), `Kinematic` (disabled, lands M3), `Topological` (disabled, lands M5). **M2's displayers belong to the Taxonomic view** — set `view_modes: ['taxonomic']`. M2 does *not* enable the Kinematic/Topological switcher buttons; M3/M5 own those. (`meta_strip_v1` is the one displayer carrying all three modes — it hosts the switcher, so it must persist across views. Don't copy that; it's chrome, not content.)

## M2's scope — Cobham Stack + Synchroscope (data availability resolved)

Per the M1 handoff, M2 lands the **Cobham Stack** and **Synchroscope** displayers. The structural "how" is fully specified above. The data-availability question — *do the frozen engines already emit what these need?* — has been **checked against the engine source** (`engines/character-engine.js`, `engines/discrete-engine.js`); the answer is no longer open:

**What the engines emit today** (in both `continuous_state` and `discrete_state`): `manifold`, `bifurcations`, `tower`, `invariants`, `patterns`, `posits_active`, `posit_k_frust_here`, `trajectory`, `solver_ms`, `spectrum` — plus, discrete-only, `operator_graph` / `operator_counts` / `k_frust_subgraphs` / `k_frust`.

- **Cobham Stack — half-backed.** `state.tower` is `{ levels:[0..4], epsilon_per_level:[5], beta_mem_per_level:[5], wall_proximity, epsilon_0 }`. Per-level tower data **exists** — a Cobham Stack rendering the 5 levels with `ε_n` / `β_mem_n` / `wall_proximity` is pure rendering. But the Cobham *wait-inflation* layer — per-level utilisation `u_n`, wait `W_{n+1}=W_0/[(1-u_n)(1-u_{n+1})]` — is **not emitted**. (See `H:\mpa-atlas\framework\cdv1_compressed.md` §Heat-tax tower, §Load-handling.)
- **Synchroscope — not backed.** There is **no phase data anywhere**: no Kuramoto `r`, no phase angles, no `K_AB`/`Δω`, no Arnold-tongue grid. `trajectory` is amplitudes (`rho_A/B(t)`); `spectrum` is relaxation-oscillation (`omega_RO`, `gamma_RO`) — neither is phase-locking. (See `cdv1_compressed.md` §Phase-locking.)

### Consequence — M2 needs an engine-extension session first (or a scoped-down M2)

Displayers render; engines own framework math. So M2 must **not** compute Cobham waits or synthesise phase data inside a displayer. Two valid paths — confirm which one with the user before coding:

1. **Engine-extension session before M2 (recommended).** A small session adds to *both* engines' state output: `tower.u_per_level` + `tower.W_per_level` (trivial — `epsilon_per_level` already exists, `u_n = ε_n` is a posit, `W_n` is the Cobham formula), and a `phase_locking` block (`r`, `K_AB`, lock state, optionally an Arnold-tongue grid — the vendored solver supports N-mode + non-reciprocal coupling, so the math is available). Then M2 renders both displayers as pure rendering against real data.
2. **Scoped-down M2.** M2 ships **Cobham Stack only**, tower-level view (`ε_n` / `β_mem_n` / `wall_proximity`), which is fully backed today. Synchroscope is deferred until the engine work lands.

Either way: **M2 must not touch `engines/**` and must not add fields to `PREDICTION_READY` / contract 02.** If you find yourself wanting to, you are in the engine-extension session, not M2 — stop and flag it.

## Files

**Create:** `renderers/prediction/displayers/cobham-stack.js`, `renderers/prediction/displayers/synchroscope.js` (kebab-case filenames; snake_case ids).

**Modify:** `renderers/plotly-2d.js` (imports + `DISPLAYERS` array — append only), `index.html` (new mount DOM), `styles/shell.css` (styling for the new mounts — structural only, no cosmetic refactor of existing CSS), `README.md` (append an M2 Session Log row).

**Do NOT touch:** every existing `renderers/prediction/displayers/*.js`, `sub-conductor.js`, `sub-layout-manager.js`, `util.js`, `engines/**`, `core/**`, `contracts/**`, `math/**`, `vendor/**`, `styles/theme.json`, `styles/tokens.css`, other renderers.

## Acceptance test

Mirror M1's pattern. Serve the repo (see "Dev server" below), open `http://localhost:8000`, and confirm:

1. **No regression** — all seven M1 displayers render exactly as before; console clean.
2. Console shows the new displayer registration log line(s) on the sub-bus.
3. `window.predictionSubBus.registry` lists the new displayer(s) with correct `displayer_id` / `view_modes` / `mount_target` — now 8 (or 9) entries.
4. `window.bus.registry` still lists `plotly_2d_renderer_v1` exactly once.
5. Slider scrub, manifold-click navigation, and theme toggle still work; the new displayer(s) re-theme via `SUB_THEME_CHANGED`.
6. **Drop-test** (optional but recommended if you changed anything structural): temp `_test_displayer.js`, add to `DISPLAYERS`, reload, confirm it registers, delete before commit.

Then append the M2 Session Log row to `README.md`, commit with the standard co-author tag, push, and report the SHA.

## Dev server / browser preview

Static Python server: `python -m http.server 8000` from the repo root → `http://localhost:8000`. There is no build step (Plotly/KaTeX via CDN `defer`, solver vendored as WASM).

For in-browser verification via the preview MCP tool: a repo-local `H:\mpa-auditor\.claude\launch.json` exists (server name `mpa-auditor`, serves cwd on port 8000) — use it if you launch Claude Code with the repo as the working directory. **If you're launched from a parent directory (e.g. `H:\`), the preview tool looks for `launch.json` at *that* root** — recreate it there (one `Write`, same format) or relaunch from the repo dir. A previous session left a stray `H:\.claude\launch.json`; it has been removed. `launch.json` is currently untracked — commit it into the repo if you want it to persist for contributors.

Use **Chrome** for verification — the vendored WASM solver currently only works cleanly in Chrome; Edge/Firefox fail it (known, deferred).

## After M2 — the mock-dataset slice (not M2's job, but know it's coming)

Once M2 lands, the next priority is a **thin mock-dataset slice**: wire just enough of the Empirical + Audit panes (contracts 03 / 05 / 08) to load a mock dataset (`fixtures/fake-empirical.json`, `fixtures/fake-audit-delta.json` already exist) and exercise the cross-pane contract exchanges. It is a contract-exchange smoke test, **not** the real Empirical/Audit panes. Its purpose: integrating scale management against the Predicted pane is how the user learns whether the Predicted buildout actually holds up — and surfacing those problems is what keeps RFC-S development (`H:\mpa-atlas\rfcs\MPA-RFC-S_Scale-Management.md`) running in parallel rather than serialized. Keep it M1-grade thin when it lands.

## References

- Main README: [`README.md`](../README.md) — architecture + Session Log (M1 row is logged).
- M1 commit `6cdbf8a` — the actual carve-up diff; read it to see the seam in practice.
- Sub-conductor: [`renderers/prediction/sub-conductor.js`](../renderers/prediction/sub-conductor.js) — the bus your displayers subscribe to.
- A worked displayer: [`renderers/prediction/displayers/invariants-panel.js`](../renderers/prediction/displayers/invariants-panel.js) (simplest) or [`gfdr-signature.js`](../renderers/prediction/displayers/gfdr-signature.js) (Plotly).
- Framework source of truth: [`H:\mpa-atlas\framework\cdv1_compressed.md`](H:/mpa-atlas/framework/cdv1_compressed.md).

**Do not implement anything beyond M2's two displayers. The mock-dataset slice and the Kinematic/Topological views are later sessions. Resist the urge to "while I'm here."**

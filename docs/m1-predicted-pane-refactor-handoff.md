# M1 — Predicted-pane sub-architecture refactor (handoff)

**You are a fresh Claude Code session.** No prior context required; this brief is self-contained. The repo lives at `H:\mpa-auditor` and at [`github.com/ronviers/mpa-auditor`](https://github.com/ronviers/mpa-auditor).

## What's already shipped

- Hub-and-spoke shell (top-level Conductor / Style Manager / Layout Manager).
- 8 contracts (immutable JSON Schema).
- `mpa-solver` v2.0.0 vendored at `vendor/mpa-solver/` (WASM + JS wrapper). Real ODE trajectories + numerical linearization drive the Predicted pane.
- One monolithic `renderers/plotly-2d.js` (~530 lines) that currently owns the entire Window 1 contents: regime manifold, gFDR signature inset, trajectory strip, invariants list, patterns list, posits strip, meta strip.

**You are refactoring that monolith into a set of independently-developable sub-displayers under a Window-1-scoped sub-architecture.** No new visuals. No new math. Same content, structurally factored.

The goal is enabling parallel session work after M1 lands. Sessions M2 through M5 each add one or two new sub-displayers and must NOT touch existing displayer files. If the refactor leaks coupling, those parallel sessions will collide. Get the seams right.

## Your scope

### Files you create

```
renderers/prediction/
├── sub-conductor.js              (sub-event-bus + sub-registry)
├── sub-layout-manager.js         (view-mode state + composition)
└── displayers/
    ├── meta-strip.js             (regime badge + KaTeX equation)
    ├── trajectory-strip.js       (ρ_A(t), ρ_B(t) from solver)
    ├── regime-manifold.js        (Plotly heatmap + bifurcations + crosshair)
    ├── gfdr-signature.js         (Plotly χ vs ΔC inset)
    ├── invariants-panel.js       (HTML list)
    ├── patterns-panel.js         (HTML list)
    └── posits-strip.js           (HTML strip across the bottom)
```

### Files you modify

- `renderers/plotly-2d.js` — reduce to a thin **boot shim** that loads the sub-conductor + sub-layout-manager + the seven displayers. ~30 lines after the cut.
- `index.html` — DOM body of Window 1 gets a small addition: a **view-mode switcher** (segmented control: `Taxonomic` / `Kinematic` / `Topological`) inside the prediction-meta row. Only `Taxonomic` is active in M1; the other two are visible-but-disabled (tooltip explains "lands in M3 / M5"). All existing IDs (`#manifold-plot`, `#fdr-plot`, etc.) stay where they are so the displayers can find them.
- `styles/shell.css` — minimal additions for the view-mode switcher and any visual seams. **Do not refactor existing CSS for cosmetics.** This session is structural.
- `README.md` — append a Session Log row for M1.

### Files you do NOT touch

- `engines/**` — engines stay exactly as they are. They publish `PREDICTION_READY`; the sub-architecture consumes it.
- `core/**` — top-level Conductor / Style Manager / Layout Manager unchanged.
- `contracts/**` — sacred.
- `math/**`, `vendor/**` — solver unchanged.
- `styles/theme.json` — Style Manager loads it; you don't edit it.
- `styles/tokens.css` — FOUC-safe mirror of theme.json; unchanged.
- Other renderers (`renderers/threejs-3d.js`, `cytoscape-graph.js`, `observable-substrate-map.js`) — stubs for other windows / tabs; out of scope here.

## Architecture

### Sub-conductor

Scoped event bus for the Predicted pane. Same shape as the top-level `bus`, but isolated. Sub-displayers subscribe to *the sub-bus*, not the main bus. The sub-conductor itself subscribes to one main-bus event — `PREDICTION_READY` (contract 02) and `THEME_CHANGED` (contract 07) — and republishes them onto the sub-bus so displayers don't reach into the main bus directly.

```js
// renderers/prediction/sub-conductor.js
import { bus as mainBus } from '../../core/conductor.js';

const target = new EventTarget();
const registry = new Map();
const log = [];

export const subBus = {
  publish(eventType, payload) { /* same as main bus */ },
  subscribe(eventType, handler) { /* same as main bus */ },
  register(displayerInfo) { /* validates {displayer_id, view_modes, mount_target}; adds to registry */ },
  get registry() { /* read-only */ },
  get log() { return log.slice(); }
};

export function init() {
  // Fan in main-bus events to the sub-bus
  mainBus.subscribe('PREDICTION_READY', payload => subBus.publish('SUB_PREDICTION_READY', payload));
  mainBus.subscribe('THEME_CHANGED',    payload => subBus.publish('SUB_THEME_CHANGED', payload));
  console.log('[prediction-sub-conductor] ready');
}
```

The sub-bus emits **only** the events sub-displayers should consume. New events the sub-architecture introduces (e.g. `SUB_VIEW_MODE_CHANGED`, `SUB_DISPLAYER_HIGHLIGHT`) live here and never leak to the main bus.

### Displayer contract

Every displayer file exports:

```js
export const id = 'meta_strip_v1';                    // unique, snake_case
export const view_modes = ['taxonomic', 'kinematic', 'topological'];  // which views show it
export const mount_target = '#prediction-meta';       // CSS selector for where it renders

export function init() {
  // Subscribe to sub-bus events; register with sub-conductor.
  // Idempotent — safe to call once.
}
```

That's it. A displayer is a file that knows how to render itself into a DOM target, given sub-bus events. The sub-layout-manager decides whether to *call* `init()` based on the current view mode (or simply hides the mount via `display: none` if the displayer is registered but not active in the current view).

The sub-conductor's `register()` validates the three required exports.

### Sub-layout-manager

Owns view-mode state. Listens for clicks on the view-mode switcher. Publishes `SUB_VIEW_MODE_CHANGED` on the sub-bus. Toggles `display: none` on mount targets that aren't in the active view mode's `view_modes` list.

```js
// renderers/prediction/sub-layout-manager.js
import { subBus } from './sub-conductor.js';

const VIEW_MODES = ['taxonomic', 'kinematic', 'topological'];
let currentView = 'taxonomic';

export function init() {
  wireSwitcher();
  applyVisibility();
  subBus.publish('SUB_VIEW_MODE_CHANGED', { view: currentView });
}

function applyVisibility() {
  Object.values(subBus.registry).forEach(d => {
    const mount = document.querySelector(d.mount_target);
    if (!mount) return;
    mount.style.display = d.view_modes.includes(currentView) ? '' : 'none';
  });
}
```

For M1, `kinematic` and `topological` switcher options are **rendered but disabled** (the displayers they'd contain don't exist yet — M3 and M5).

### Boot order

`renderers/plotly-2d.js` becomes:

```js
import { init as initSubConductor } from './prediction/sub-conductor.js';
import { init as initSubLayout }    from './prediction/sub-layout-manager.js';
import * as MetaStrip       from './prediction/displayers/meta-strip.js';
import * as TrajectoryStrip from './prediction/displayers/trajectory-strip.js';
import * as RegimeManifold  from './prediction/displayers/regime-manifold.js';
import * as GfdrSignature   from './prediction/displayers/gfdr-signature.js';
import * as InvariantsPanel from './prediction/displayers/invariants-panel.js';
import * as PatternsPanel   from './prediction/displayers/patterns-panel.js';
import * as PositsStrip     from './prediction/displayers/posits-strip.js';

const DISPLAYERS = [MetaStrip, TrajectoryStrip, RegimeManifold, GfdrSignature, InvariantsPanel, PatternsPanel, PositsStrip];

export function init() {
  initSubConductor();
  DISPLAYERS.forEach(d => d.init());
  initSubLayout();

  // The top-level Conductor (core/conductor.js) registers this renderer
  // as before, so window.bus.registry still shows plotly_2d_renderer_v1.
  // ...registration call unchanged...
}
```

The top-level boot script (`index.html` end-of-body) still calls `initPlotly()` once — nothing changes there. The fanout happens behind that call.

## Carve-up: which logic moves where

This is the load-bearing part. Take the current `plotly-2d.js` and **strictly distribute** its responsibilities. No logic is shared between displayers except via the sub-bus.

| Current `plotly-2d.js` function | Moves to |
|---|---|
| `updateMeta()` | `meta-strip.js` |
| `manifoldTraces()`, `manifoldLayout()`, `attachManifoldClickOnce()`, `regimeColorscale()` | `regime-manifold.js` |
| `fdrTraces()`, `fdrLayout()` | `gfdr-signature.js` |
| `trajectoryTraces()`, `trajectoryLayout()`, `updateTrajectoryMeta()` | `trajectory-strip.js` |
| `renderInvariants()` | `invariants-panel.js` |
| `renderPatterns()` | `patterns-panel.js` |
| `renderPosits()` | `posits-strip.js` |
| `colors()`, `readCSSVar()`, `regimeColor()`, `escapeHTML()` | **Shared utility module:** `renderers/prediction/util.js`. Pure helpers; no state. Each displayer imports what it needs. |

Don't duplicate the `colors()` and `regimeColor()` helpers across displayers. The utility module is the *one* exception to the "no cross-displayer imports" rule, and it's allowed because it's stateless.

Each displayer maintains its own `lastPrediction` cache (so it can re-render on theme change without re-fetching state). Subscribes to `SUB_PREDICTION_READY` and `SUB_THEME_CHANGED` on the sub-bus, not the main bus.

## DOM changes

The existing IDs (`#manifold-plot`, `#fdr-plot`, `#trajectory-plot`, `#regime-badge`, `#prediction-equation`, `#invariants-list`, `#patterns-list`, `#posits-content`, `#trajectory-meta`) must remain in place so displayers can target them. **You may not rename or remove them.** If a displayer needs a wrapper element, it can be added without renaming the inner targets.

The one addition: a view-mode switcher control. Insert it inside the existing `.prediction-meta` strip, right of the equation. Suggested markup:

```html
<div class="prediction-meta">
  <span id="regime-badge" class="regime-badge">—</span>
  <span id="prediction-equation" class="equation"></span>
  <div class="view-mode-switcher" role="radiogroup" aria-label="View mode">
    <button class="view-mode is-active" data-view="taxonomic"  role="radio" aria-checked="true">Taxonomic</button>
    <button class="view-mode is-disabled" data-view="kinematic" role="radio" aria-checked="false" disabled title="lands in M3">Kinematic</button>
    <button class="view-mode is-disabled" data-view="topological" role="radio" aria-checked="false" disabled title="lands in M5">Topological</button>
  </div>
</div>
```

Style as a compact segmented control. Disabled options should be visually distinct (lower opacity) and non-interactive.

## Acceptance test

Open `http://localhost:8000` (Python static server already documented in the main README). All of the following must be true:

1. Page loads with the **same visual output as before the refactor** — every panel renders identically. No regressions.
2. Console shows: top-level `[bus]` registrations as before, then sub-conductor / sub-layout / 7 displayer registrations on the sub-bus, in that order.
3. `window.bus.registry` still lists `plotly_2d_renderer_v1` exactly once (as it did pre-refactor).
4. **`window.predictionSubBus.registry`** is a *new* console-accessible object listing the 7 sub-displayers with their `id`, `view_modes`, `mount_target`.
5. The view-mode switcher is visible in the meta strip. Clicking `Taxonomic` is a no-op (already active). Clicking `Kinematic` or `Topological` is blocked (disabled buttons).
6. Slider scrub continues to drive the trajectory strip and manifold crosshair at the same frame rate as before.
7. Theme toggle continues to work — every displayer re-themes via `SUB_THEME_CHANGED`.
8. **Drop-test:** create a temporary file `renderers/prediction/displayers/_test_displayer.js` that exports `id`, `view_modes`, `mount_target`, `init`. Add it to the `DISPLAYERS` list in `plotly-2d.js`. Reload the page — it should register cleanly and show up in `window.predictionSubBus.registry`. **Delete the temp file before commit.** This proves the seam works for the M2+ sessions.

## Style guidance

- **No new dependencies.** Plotly + KaTeX + the solver are already loaded; you're just rearranging.
- **No CSS refactor.** The visual output must match pixel-for-pixel (allowing for normal browser pixel-rounding). Style changes are limited to the new view-mode switcher.
- **No engine or contract changes.** If you find yourself wanting to add a field to `PREDICTION_READY`, stop — that's a different session.
- **Each displayer file ≤ 200 lines.** If a displayer is creeping past that, the carve-up has a seam in the wrong place. Reconsider.
- **No `window.x` globals beyond `window.predictionSubBus`** (for console debugging). Everything else lives behind module imports.
- Names are snake_case for ids (`meta_strip_v1`); kebab-case for file names (`meta-strip.js`); camelCase for JS identifiers. Match the existing convention.

## What success looks like

The diff is mostly *moves* — same code, distributed across 7 displayer files plus the sub-conductor + sub-layout + util. Visual output is byte-identical. The console shows the sub-bus chatter. The drop-test proves that M2 can land a new displayer file without touching any other displayer. The README log row names the carve-up.

When you're done:

1. Run the acceptance checklist.
2. Append the Session Log row to `README.md`:

   ```
   | M1 | <today's date> | Predicted-pane sub-architecture refactor | Extracted 7 sub-displayers from `plotly-2d.js` into `renderers/prediction/displayers/`; sub-conductor + sub-layout-manager + view-mode switcher; drop-test confirms M2+ sessions can land new displayers without cross-file edits. | No visual changes; structural foundation for M2-M5. |
   ```

3. Commit with a descriptive subject and the standard co-author tag.
4. Push.

Then ping back here with the commit SHA.

## References

- Main README: [`README.md`](../README.md). Architecture section explains the top-level hub-and-spoke; this M1 work mirrors that pattern one level deeper.
- Top-level Conductor: [`core/conductor.js`](../core/conductor.js). Your sub-conductor should follow the same idioms (validate registrations, expose readonly registry, etc.).
- Contracts 02 (`PredictedLocus`) and 07 (`ThemeBundle`) — what the sub-bus republishes verbatim onto sub-displayers.
- Earlier session briefs in [`sessions/`](../sessions/) for the brief format.

**Do not implement anything beyond M1. The new displayers M2 wants to land (Cobham Stack, Synchroscope) belong to M2's brief, not yours. Resist the urge to "while I'm here, add a small thing."**

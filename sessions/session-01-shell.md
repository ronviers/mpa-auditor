# MPA AUDITOR — SESSION 01 BRIEF
## Shell, Conductor, Style Manager, and Stub Files

You are working on a project called **MPA Auditor**. This is **Session 1 of 12**. Each session is a fresh Claude context. You do not need prior context; this brief contains everything you need.

---

## Project context (read once, then proceed)

MPA Auditor is a browser-based scientific instrument with three synchronized windows: a predicted locus from the framework, an empirical dataset, and the audit delta between them. Built as vanilla JavaScript ES modules with an Event Bus hub-and-spoke architecture. No build step, no framework. Libraries loaded via CDN.

Your job in this session is to build the **shell** — the structure, the event bus, the style manager, the layout, and **stub files for every future module**. Nothing computes math yet. Nothing renders charts yet. **What works at the end of this session is: the page loads, has the visual structure, tabs are clickable, the slider moves, the theme toggle works, and the console shows that the Event Bus is alive.**

Future sessions will fill in the stub files one at a time.

---

## Files you may create or edit (this session only)

- `index.html`
- `core/conductor.js`
- `core/style-manager.js`
- `core/layout-manager.js`
- `styles/tokens.css`
- `styles/shell.css`
- `engines/discrete-engine.js` (stub)
- `engines/character-engine.js` (stub)
- `engines/data-engine.js` (stub)
- `engines/audit-engine.js` (stub)
- `renderers/plotly-2d.js` (stub)
- `renderers/threejs-3d.js` (stub)
- `renderers/cytoscape-graph.js` (stub)
- `renderers/observable-substrate-map.js` (stub)
- `fixtures/fake-prediction.json`
- `fixtures/fake-empirical.json`
- `fixtures/fake-audit-delta.json`
- Append a row to `README.md`'s Session Log

## Files you MUST NOT touch

- Anything in `contracts/` — these are immutable JSON Schema files
- `styles/theme.json` — Style Manager loads it; you don't edit it
- Any session brief in `sessions/`

## Files you must read (already present)

- All eight files in `contracts/` — these define the protocols
- `styles/theme.json` — the default theme tokens
- `README.md` — project overview

---

## What to build, in order

### 1. `index.html`

A single-page application. Structure:

- `<head>` loads (via CDN): nothing yet — Session 1 has no library dependencies. KaTeX, Plotly, Three.js, Cytoscape come in their respective sessions.
- `<body>` contains:
  - A top **header bar** with: the title "MPA Auditor", a Discrete/Continuous mode toggle, a Dark/Light theme toggle.
  - A **tab bar** with five tabs: "gFDR Signatures" (active by default), "Basin / Spray", "Operator Graph", "Substrate Map", "Audit Gallery". Only the visual UI — tabs don't switch content yet, they just show active state.
  - A **three-window layout** below the tabs:
    - Window 1 (left): labeled "Predicted (Framework)". Empty content area with a placeholder message.
    - Window 2 (center): labeled "Empirical (Data)". Includes an attribution panel (empty for now) and an upload zone placeholder ("Drop CSV here — not yet wired").
    - Window 3 (right): labeled "Audit (Delta)". Empty content area.
  - A **footer control bar** with a continuous slider labeled "regime parameter (chit)" from -2 to +2. Moving it publishes a `STATE_REQUEST` event but no engine handles it yet — log to console.
- Load order at the end of `<body>`: tokens.css, shell.css, then core/conductor.js, core/style-manager.js, core/layout-manager.js, then every engine and renderer stub file, then an inline `<script type="module">` that calls each module's `init()`.

### 2. `core/conductor.js`

The Event Bus and Module Registry. Implement using the browser's built-in `EventTarget`. Export a singleton object `bus` with:

- `bus.publish(eventType, payload)` — fires a CustomEvent on the EventTarget.
- `bus.subscribe(eventType, handler)` — returns an unsubscribe function.
- `bus.register(registration)` — validates against `contracts/04-module-registration.schema.json` (basic check: required fields present), adds to internal registry. Logs registration.
- `bus.registry` — read-only view of all registered modules.
- `bus.log` — an array that records every event for replay/debugging.

Also publish a `BUS_READY` event after initialization so other modules know they can register.

### 3. `core/style-manager.js`

Loads `styles/theme.json`. Converts the tokens into CSS custom properties (variables) on `:root`. Implements `setTheme(themeName)` for the dark/light toggle. Broadcasts `THEME_CHANGED` events when theme changes. Re-applies CSS variables on theme change.

For Session 1, support only `"dark"` (default, as in theme.json). The light theme will come in Session 12; for now, the toggle button can flip a `data-theme="light"` attribute on `<html>` but the actual light palette is just inverted defaults.

### 4. `core/layout-manager.js`

Wires the static UI:

- Tab clicks update the active-tab visual state and publish `SELECTION_CHANGED` events (selection_type: substrate placeholder — actual tab content swap is Session 4+).
- The slider input publishes `STATE_REQUEST` events (full contract 01 shape, with the current chit-derived parameters). For Session 1 these requests have no listeners — log them to console.
- The mode toggle publishes `STATE_REQUEST` events with the new mode.
- The upload zone is non-functional but accepts hover state.

### 5. Stub files (engines + renderers)

Each stub is ~20 lines: imports `bus`, exports an `init()` function that calls `bus.register({...})` with `status: "stub"`, version `"0.0.1-stub"`, and logs `[module-id] stub loaded`. **No real logic.** Include a comment block at the top stating:

- The module's responsibility
- Which contracts it will subscribe to / publish
- Which session will implement it (per the roadmap in README.md)
- Files it must not touch when implemented

Use the structure shown below for `engines/discrete-engine.js`:

```javascript
/**
 * DISCRETE ENGINE
 * Computes the v9 operator algebra (C, S, K, R) and k_frust subgraphs.
 *
 * STATUS: Stub. Implemented in Session 2.
 *
 * Subscribes to: STATE_REQUEST (contract 01)
 * Publishes:     PREDICTION_READY (contract 02), ERROR_REPORT (contract 06)
 *
 * Forbidden when implemented:
 *   - No renderer imports
 *   - No edits to core/* or contracts/*
 *   - No edits to other engines
 */

import { bus } from '../core/conductor.js';

export function init() {
  bus.register({
    module_id: 'discrete_engine_v1',
    module_type: 'engine',
    version: '0.0.1-stub',
    framework_version_compatibility: ['v9', 'v9.1'],
    capabilities: ['operator_algebra', 'k_frust_detection'],
    subscribes_to: ['STATE_REQUEST'],
    publishes: ['PREDICTION_READY', 'ERROR_REPORT'],
    computational_profile: 'light',
    requires_libraries: ['mathjs'],
    status: 'stub',
    session_implemented_in: null
  });
  console.log('[discrete_engine_v1] stub loaded');
}
```

Build the analogous stub for each of the other seven module files.

### 6. Fixture files

`fixtures/fake-prediction.json`, `fake-empirical.json`, `fake-audit-delta.json` — minimal valid examples of contracts 02, 05, and 03 respectively. Use clearly synthetic values (e.g. `"citation_text": "[FIXTURE] Synthetic test data, not for citation"`). These are what future sessions use to test their modules in isolation. Keep them small (~30 lines each), valid per their schemas.

### 7. CSS

`styles/tokens.css`: CSS custom properties matching the keys in `theme.json`. Loaded *before* any other CSS so other files can reference `var(--background)` etc.

`styles/shell.css`: All layout, not just for windows but for the header, tab bar, footer slider. Honor the dark aesthetic: deep background, generous spacing, restrained typography. Three windows side-by-side on desktop, stacked on narrow screens. Avoid any color hardcoding — reference CSS variables only.

### 8. README Session Log

Append one row to the Session Log table in `README.md`:

```
| 1 | <today's date> | Shell + Conductor | Shell, Conductor, Style Manager, Layout Manager, all 8 stubs, fixtures | <brief description of any decisions you made> |
```

---

## Acceptance test

When you're done, the following must all be true:

1. Opening `index.html` in a browser shows the three-window layout with header, tabs, slider, theme toggle.
2. The browser console shows: `[bus] ready`, then 8 lines like `[discrete_engine_v1] stub loaded`, one per stub.
3. `window.bus.registry` shows 8 registered modules in the console.
4. Moving the slider logs a `STATE_REQUEST` event with valid contract 01 shape.
5. Clicking the theme toggle changes the background color and logs a `THEME_CHANGED` event.
6. Clicking tabs updates the active-tab visual state without errors.
7. The page is responsive: looks good on a 1920px-wide monitor and on a 768px tablet.
8. No console errors. No 404s for missing files.

---

## Style guidance

- **No frameworks.** Vanilla JS, vanilla CSS. ES modules only.
- **No build step.** The page works by opening `index.html` directly. No bundlers, no transpilation.
- **No hardcoded colors or fonts** anywhere outside `theme.json` / `tokens.css`.
- **Dark by default.** The aesthetic is LIGO control room / Mathematica, not corporate dashboard. Generous whitespace, restrained accents, serious typography.
- **Comment your contract usage.** Where your code produces or consumes a contract, name the contract number in a comment.

## What success looks like

A scientifically-minded person opens `index.html` and immediately thinks: *"this looks like an instrument, not a demo."* The chrome is there, the structure is there, nothing computes yet — but the bones are unmistakably those of a working observatory.

When you finish, write a brief response describing what you built, any decisions you made, and confirm the acceptance test passed.

**Do not build anything beyond this brief.** No engine math. No renderer logic. No real upload handling. Future sessions handle those.

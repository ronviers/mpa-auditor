# Design

Visual design references for the MPA Auditor — palette swatches, mockups, reference imagery. Source-of-truth for **how the instrument looks**.

## Where the look lives

There are two layers, and the separation is deliberate:

| Layer | File | Role |
|---|---|---|
| Visual reference | `design/auditor-palette.png` (and future mockups here) | What the look *is*. Image-based. Human-readable for non-coders. |
| Runtime tokens | [`../styles/theme.json`](../styles/theme.json) | What the look *is encoded as*. Machine-readable. The Style Manager loads this and converts every value into a CSS variable. |

**Code never hardcodes a color, font, size, radius, or animation timing.** Every visual decision flows through `theme.json`. Edit `theme.json` and the whole instrument reskins; you do not need to touch a single `.js` or `.css` file outside `styles/tokens.css` (which itself is just a mirror of `theme.json` in CSS-variable form).

## Current palette

**Imbric Systems** — restrained, painterly, serious-instrument.

| Role | Name | Hex |
|---|---|---|
| Background | The Void | `#363636` |
| Primary accent | Stone | `#7d613b` |
| Secondary accent | Sideris | `#3b577d` |

The functional palette (regime colors, miss-category styling, success/warning/error states) is designed to harmonize with these three. Regime encodings must remain distinguishable from chrome AND from each other — color-blind safety also requires shape encoding (see `theme.json` `regime_palette[*].shape`).

## How to change the look (no code required)

1. Open `styles/theme.json`.
2. Change the hex value, font name, spacing unit, animation duration, or whatever.
3. Reload the page. Done.

If a change feels like it would require touching code, that's a signal that `theme.json` is missing a knob — add the knob to `theme.json`, mirror it in `styles/tokens.css`, and reference the new variable from wherever it's needed. The principle: visual decisions live here, not in code.

## Adding new design artifacts

Drop them in `design/`. Add a line to this README describing what they reference and which `theme.json` keys they inform.

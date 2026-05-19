# mpa-auditor — session discipline

Stub. Established 2026-05-17 alongside the character test framework
integration. Future sessions can expand; for now, the load-bearing
contracts that govern this repo are:

## Program-level discipline

This repo is a **viewer** per [`H:/mpa-central/METHODOLOGY.md`](../mpa-central/METHODOLOGY.md) Cut 4 — pure-static browser consumer of signed declaration bundles. Reads only; produces no evidence rows for Cut 2.

## Architecture commitment (file-import boundary)

This repo is a **pure-static browser app**. No LLM at runtime, no MCP
servers, no live links to other repos. The coupling to `mpa-conform` is
a **file-import boundary** ([§Q12 correction note](docs/foundational-answers.md),
2026-05-15): mpa-conform writes `declaration_bundle.json`; mpa-auditor
reads it. That boundary is the *whole* coupling.

**Architectural authority:** [`H:/mpa-central/SUITE_BLOCK_IN.md`](../mpa-central/SUITE_BLOCK_IN.md)
is the structural commitment for the MPA suite. mpa-auditor is the
**viewer layer**. Viewers consume `fit_provenance`; they do not refit.

## Character test suite — destination viewport

mpa-auditor is the **destination viewport** for character-test shots.
Canonical doc:
[`H:/mpa-conform/conformer/tests/character/README.md`](../mpa-conform/conformer/tests/character/README.md).

A character test produces an EXR sequence + mp4 preview that shows a
substrate's measurement evolving through observation time, with the
framework's predicted and Banach traces overlaid. The shots show
*character* — how the substrate moves through canonical state space.

**Today**: shots are reviewed in DJV
(`H:\tools\djv\djv-3.4.2-windows-amd64\bin\djv.exe`), a standard VFX
EXR player with timeline scrubbing, channel selection, and compare
mode (A/B, wipe, overlay, difference).

**Destination**: when this repo gains **tumbling and natural-cadence
playback** in its viewport, the same EXR sequences these tests
produce will play through the auditor viewport. The DJV → auditor
migration is the load-bearing UI move for this repo's roadmap.

Until then:
- Character tests render via `conformer.shot.builder` directly,
  bypassing this repo's display path.
- Bundle-import migration (this repo's `data-engine.js` to consume
  `declaration_bundle.json` instead of CSV) is the precondition for
  the auditor to consume the *bundle* the shots are rendered from.

## What this repo writes to

- `mpa-auditor/seed-corpus/` — populated only via PR from
  mpa-conform's `output/seed-corpus/`. No other repo writes here.

## What this repo reads from

- `mpa-conform/output/seed-corpus/` (via PR into `seed-corpus/`).
- `mpa-atlas/framework/cdv1_compressed.md`, `v9_compressed.md` —
  spec for the universal kernel + gFDR signatures rendered by
  `character-engine.js`, `regime-manifold.js`, `gfdr-signature.js`.

## Don't

- **Don't refit in viewers.** Per SUITE_BLOCK_IN. Viewers consume
  `fit_provenance`; computation lives in mpa-conform.
- **Don't add live links** to other repos. File-import boundary is the
  *whole* coupling.
- **Don't run LLMs in this app.** Pure-static, offline-after-download.


## Rendering discipline — the water MPA swims in

Canonical doc:
[`H:/mpa-conform/conformer/shot/RENDERING_DISCIPLINE.md`](../mpa-conform/conformer/shot/RENDERING_DISCIPLINE.md).
Established 2026-05-17. Every visual property in every shot maps to
framework data; differentiation, not decoration. The discipline is not
a feature -- it is the medium every visualization in the MPA suite
operates in, and it does not get re-litigated per session.

This repo's contribution to shot rendering is whatever its
character-test contract above already names. Any addition that would
violate the two rules (every property maps to data; differentiation
not decoration) does not land; the discipline does not bend.

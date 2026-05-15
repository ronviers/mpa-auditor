# `mpa-conform` bootstrap — fork handoff

**You are a fresh Claude Code session. This handoff is self-contained.**

**Your task: create a new sibling repo `H:\mpa-conform`.** Parallel to `mpa-auditor`, `mpa-solver`, `mpa-atlas`. The repo does not exist yet. You are the first session.

**First move:** read this entire document before doing anything. Then confirm scope + the name with the user (the name `mpa-conform` is the proposed default per the architecture decision; if the user wants something else, accept that and adjust). Then create the repo.

---

## 1. Why this repo exists

The `mpa-auditor` is a pure-static deliverable — a browser app a researcher in 2030 runs from a downloaded copy, with or without network access. This is a load-bearing architectural commitment (`mpa-auditor/docs/foundational-answers.md` §11, "Scoping discipline"). It is what keeps the audit honest: no runtime LLM calls, no DOI lookups during a fit, no silent inference into the declaration trail.

But researchers in 2026 do not arrive with clean data. They arrive with CSVs in wrong units, ambiguous column headers, missing licences, untrimmed whitespace, computed-not-raw observables, and an "I think it's glassy?" substrate hunch. They have AI at their fingertips and will use it whether we want them to or not. **Pretending data-prep is the researcher's burden, or that the auditor can grow a data-cleaning toolbelt, is the discipline failure that drove this repo into existence.**

`mpa-conform` is the conform tool `mpa-auditor/docs/foundational-answers.md` §Q12 names — until now hand-waved as "a curation session" or "an upstream tool," now a real address. It is **the ingestion porch**: agentic, LLM-using, MCP-server-vendoring, web-tooling — all the things the auditor explicitly cannot be. It runs *upstream* of the auditor. Its outputs cross a file-import boundary into the auditor; the auditor reads, never calls back.

**The architectural commitment, in one sentence:**

> The auditor accepts `declaration_bundle.json` and only `declaration_bundle.json` from researchers. There is no raw-CSV ingestion path, anywhere, ever.

Clean-data researchers traverse `mpa-conform` in zero meaningful effort. Messy-data researchers traverse the same path with the LLM-assist doing real work. Singular working-space path (cdv1 / RFC-S §0 foundational principle #4); *peel, not scrape*.

---

## 2. Read before scoping

Three documents in `mpa-auditor` set the architecture you inherit. Read them in this order:

1. **`H:/mpa-auditor/docs/foundational-answers.md` §Q12** (with the 2026-05-15 correction note) — the full architectural decision. The correction note carries the singular-path commitment, the agentic-vs-pure-static split, the two-paths-one-repo structure, the forward-only consequence.
2. **`H:/mpa-auditor/docs/foundational-answers.md` §Q13** — the forward-only architecture. MPA forward-predicts in canonical parameter space; the *forward* translation field (canonical → substrate-native) is what `mpa-conform` produces; the *backward* map is never built. Scale management (τ_obs) is logically prior to the forward projection — a declared observer-fact, not a swept substrate-unknown.
3. **`H:/mpa-auditor/docs/foundational-answers.md` §11** — the scoping discipline. The "Adjacent MPA repos" table includes `mpa-conform`. The "Curation-time work" and "Upstream of the researcher's upload" subsections describe what `mpa-conform` owns.

Two more for the inputs `mpa-conform` consumes:

4. **`H:/mpa-central/library/LIBRARY_SPEC.md`** + **`H:/mpa-central/library/grind_library.py`** — the substrate-side characterization library. The curator path reads `library/data/*/*.json` grind cells; the spec defines their shape.
5. **`H:/mpa-atlas/framework/cdv1_compressed.md`** §"Open items" + §"Methodological imperatives" + **`H:/mpa-atlas/framework/cdv1_receipts.md`** §"Substrate-instancing claims" — the framework's claim-only operational source of truth. The substrate-conditional reading rules (v9 §F.1 / §F.2) live here. **Read `H:/mpa-atlas/CLAUDE.md` (thin-RFC discipline) before touching anything in `mpa-atlas`; `mpa-conform` does not touch `mpa-atlas`, only reads it.**

And one more for the output contract:

6. **`H:/mpa-atlas/rfcs/MPA-RFC-S_Scale-Management.md` §4** + **`H:/mpa-atlas/schema/driver-profile.v0.2.json`** — the driver profile shape the curator path produces.

---

## 3. Two paths through one repo

`mpa-conform` serves two operators with one shared codebase.

### Curator path

**Input:** `H:/mpa-central/library/data/{brain,glass,quantum}/*.json` — grind cells from `grind_library.py`. 60 files exist (16 brain + 22 glass + 22 quantum). Each cell carries `(operating_point, ẋ-choice, τ_obs grid × t_sample grid, observable)` in substrate-native coordinates.

**Operator:** a curator (you, a future session) runs `mpa-conform` against the library to produce committed artifacts.

**Outputs:**
- **Per-cell DataUploads** (contract-05-shaped JSON) — `mpa-auditor/seed-corpus/{class}/{instance_id}/data.json` + `provenance.json`. Each cell becomes one DataUpload (or one per τ_obs slice, design choice — see §5).
- **Per-class driver profiles** (RFC-S §4 shape) — `mpa-auditor/seed-corpus/{class}/driver-profile.json`. Header, operating envelope, gamut, forward-half translation field, intents, reference-output pointers, metadata.

**Delivery:** PR into `mpa-auditor`. Curator-signed bundles get `tier: 'curated'`; the auditor's `seed-corpus/` becomes populated.

**Why this is first deliverable:** 60 grind cells exist on disk today. The auditor's seed corpus is empty. Closing this loop is what turns the API-manifest curation (shipped 2026-05-15) from a paper artifact into a usable library. Researchers get real reference data to compare against, not just fixtures.

### Researcher path

**Input:** the researcher's raw time-series + their hunches + any paper/DOI/notes they have.

**Operator:** the researcher, running `mpa-conform` locally (CLI, browser app, or both — design choice; see §6).

**Outputs:**
- **Signed `declaration_bundle.json`** — the contract with the auditor. Schema is `mpa-conform`'s deliverable; the auditor consumes it.

**Delivery:** researcher imports the bundle into the auditor's Window 2.

**Bundle contents (sketch, refine in §4):**
- Declared substrate-class (`unclassified` is real)
- Declared ẋ-choice
- Declared τ_obs
- Declared validity-range per column
- Provenance (authors, citation, licence, optional DOI)
- Canonical (τ, C, χ) observable — extracted via windowed-correlator if the researcher uploaded raw time-series, or pass-through if they uploaded pre-computed FDR
- Declaration trail with LLM-assist provenance chain (model id, session id, MCP tools called) — the LLM's role lives here, not in the auditor's runtime
- Researcher signature (their attestation; cryptographic signing is design choice — at minimum a manifest hash)

---

## 4. The contract with the auditor

**Versioned schema: `mpa-conform/schema/declaration-bundle.v0.1.json`.**

The schema lives in `mpa-conform`. The auditor reads bundles per the schema version they declare. Bumping the schema is `mpa-conform`'s prerogative; the auditor's bundle-import logic versions accordingly.

**Shape (v0.1 sketch — finalise in the first session):**

```jsonc
{
  "schema": "declaration-bundle.v0.1",
  "bundle_id": "uuid",
  "tier": "curated" | "user",
  "signature": { "manifest_sha256": "...", "signed_at": "ISO8601", "signed_by": "..." },

  "substrate_class": "ck-glassy" | "surface-code-qec" | ... | "unclassified",
  "xdot_choice": "spin-flip" | "position-relative" | "detection-event" | ...,
  "tau_obs": { "value": 1000.0, "method": "declared" | "swept" | "defaulted", "note": "..." },

  "provenance": {
    "authors": [...], "citation": "...", "license": "...",
    "doi": null, "verified": false
  },

  "columns": [
    { "name": "tau", "units": "s", "coverage_range": [...], "validity_range": [...], "range_source": "declared" | "computed" }
    // C, chi columns similarly
  ],

  "observable": {
    "format": "canonical_fdr",         // always canonical after mpa-conform processing
    "data": [ [tau, C, chi], ... ],
    "n_realizations": null,
    "uncertainty_reported": true | false
  },

  "declaration_trail": [
    { "kind": "substrate_class", "answered_by": "researcher", "value": "ck-glassy", "at": "ISO8601" },
    { "kind": "xdot_choice", "answered_by": "llm_assist", "model": "claude-sonnet-4-6", "value": "...", "at": "ISO8601" },
    // ...
  ],

  "declaration_assistant": {                          // present iff LLM was used
    "model": "claude-opus-4-7",
    "session_id": "...",
    "mcp_tools_used": ["mpa-conform-csv-parser", ...]
  },

  "raw_data_archive_ref": null | "ipfs://..." | "local://..."   // optional pointer; bundle is self-contained without it
}
```

**Auditor-side import logic (already exists for `mock_fixture`; needs adaptation):**

1. Validate the bundle's schema version + manifest hash.
2. Echo `signature`, `declaration_trail`, `declaration_assistant` into the auditor's audit trail.
3. Stamp `tier` + `validation.status` per §Q3+Q5.
4. Emit `DATA_READY` with the canonical (τ, C, χ) and column metadata.
5. The audit proceeds normally from there.

**No gap-prompt loop in the auditor.** All gaps are resolved upstream in `mpa-conform`; the bundle either signs or it doesn't. An incomplete bundle is `mpa-conform`'s problem to surface, not the auditor's.

---

## 5. First-session deliverable: curator-path post-processor

**Why first.** The architecture is decided; the data exists; the auditor's seed-corpus is empty. The smallest concrete deliverable that proves the contract is a Python script that walks `H:/mpa-central/library/data/` and emits committed artifacts.

**Scope.**

A read-only post-processor over the 60 existing grind cells (no substrate runs, no primitive imports). Inputs in, JSON files out. Approximately 200–400 lines of Python.

**What it does, minimally:**

For each grind cell `H:/mpa-central/library/data/{substrate}/{cell}.json`:

1. **Substrate-class lookup.** `brain` / `glass` / `quantum` → an `mpa-auditor` corpus class id. Glass → `ck-glassy`. Quantum → `surface-code-qec`. Brain → decision: pick `neural-population` or coin a new class (`mpa-brain-langevin`?). Surface the choice; the user calls it.
2. **Pick a τ_obs slice (or one DataUpload per slice).** Each cell has 31 τ_obs windows. Open design choice — one-per-slice is honest and the auditor handles it; one-per-cell is smaller. Recommendation: one-per-slice with a `data_group_id` linking them.
3. **Extract (τ_sample, C, χ).** From `all_samples`: `t` → τ, `C_mean` → C, `chi_mean` → χ. SEM → per-column uncertainty.
4. **Estimate canonical parameters (chit, γ_AB) at the operating point** via a substrate-specific leading-order rule:
   - **Glass:** chit ≈ −f(T − Tc) per cdv1 §Bridge to v9. `T < Tc` → chit ≪ 0 (s-aging); `T → Tc⁺` → chit → 0⁺.
   - **Quantum:** chit ≈ −g(p_base / p_threshold). Sub-threshold → chit > 0; crossing → chit ≈ 0; above → chit < 0.
   - **Brain:** scenario table → (chit, γ_AB) — `committed` → c, `suspended` → s, `conflict` → k_frust, `reset` → r. Same shape as `tau_env_brain` in `grind_library.py`.
   - These are the **forward translation field**, leading-order. Match the `tau_env_analytic` posture: leading-order placeholders with method tags, refinable as substrate-side measurement lands.
5. **Build per-cell DataUpload** — contract-05-shaped, `tier: 'curated'`, `validation.status: 'curated'`, validity_range = coverage_range, declared substrate-class + ẋ-choice from the grind cell.
6. **Build per-substrate-class driver profile** — RFC-S §4 / `H:/mpa-atlas/schema/driver-profile.v0.2.json` shape. Header from grind metadata, operating_envelope from grid actually run, gamut from canonical-parameter image, translation_field as forward-half lookup table, intents leading-order (I5 supported, others as `supported: false`), reference_outputs as pointers to the per-cell DataUploads, metadata with grind provenance.
7. **Emit to a staging directory** in `mpa-conform/output/seed-corpus/` — staging only, not direct to `mpa-auditor/`. PR into the auditor is a separate manual step (curator-signed).

**What's deliberately deferred (optimisation, not first session):**

- The researcher path entirely. Not needed until a real researcher tries to upload non-fixture data.
- The windowed-correlator engine — only matters when the researcher path runs against raw time-series. Grind cells already carry computed FDR observables.
- Refining the leading-order substrate-class translation field. Same posture as `tau_env_analytic` — start with placeholders, refine as substrate-side measurement lands.
- Round-trip validation (RFC-S §5). Driver profiles can ship with `validation_history: []` and accumulate later.
- Pre-normalisation (Onsager / CK). Optional; the auditor's `math/ensemble-locus.js` does consumer-side normalisation. Pre-normalising in the conformer is cleaner but not blocking.
- Cryptographic signing. v0.1 can use manifest hash + curator name; PKI is later.

**Acceptance test:**

1. Script runs over all 60 grind cells without erroring; failures are logged per-cell, not whole-run.
2. Output directory contains 60 (or 60 × N_slices) DataUpload JSONs + 3 driver-profile JSONs.
3. Each DataUpload validates against `mpa-auditor/contracts/05-data-upload.schema.json` (modulo the open-typed extension surface).
4. Each driver profile validates against `H:/mpa-atlas/schema/driver-profile.v0.2.json`.
5. The auditor can load one of the DataUploads as a fixture (manual smoke test: copy to `mpa-auditor/fixtures/`, drop via `bus.publish('FILE_DROPPED', { source: 'mock_fixture', fixture: 'glass_T0.3' })`) and the cascade runs end-to-end.
6. Commit the conformer script + the staging-output samples + scaffolding docs; push to a new GitHub repo `ronviers/mpa-conform`; report SHA.

---

## 6. Repo scaffolding (set up in the first session)

```
H:/mpa-conform/
├── README.md                          # what this is, what it produces, who consumes it
├── CLAUDE.md                          # session discipline (per machine ~/.claude/CLAUDE.md pattern)
├── docs/
│   ├── ROADMAP.md                     # parallel to mpa-auditor's
│   ├── foundational-questions.md      # mirror of mpa-auditor's pattern; q's specific to mpa-conform
│   ├── foundational-answers.md        # mirror of mpa-auditor's pattern; pointer to mpa-auditor's §Q12 correction note as upstream authority
│   └── next-session-handoff.md        # regenerated each session
├── schema/
│   └── declaration-bundle.v0.1.json   # the auditor-facing contract
├── conformer/
│   ├── curator/
│   │   ├── walk_library.py            # the first-session deliverable
│   │   ├── substrate_class_rules.py   # the substrate-class translation field
│   │   └── driver_profile_builder.py  # RFC-S §4 shape assembly
│   └── researcher/                    # empty for first session; placeholder for the researcher path
├── output/
│   └── seed-corpus/                   # staging output for the curator path; .gitignore for now
└── tests/
    └── (per-cell validation tests)
```

**Add to machine-level `H:/.../.claude/CLAUDE.md`** (per the pattern documented in the user's MPC / MPA Projects shared setup):

- `"H:\\mpa-conform"` added to BOTH `permissions.additionalDirectories` AND `sandbox.filesystem.allowWrite` in user settings.

**`git init`** in `H:/mpa-conform`; create GitHub repo `ronviers/mpa-conform` (public, parallel to other mpa-* repos). Use:

```
gh repo create ronviers/mpa-conform --public --source=H:/mpa-conform --remote=origin --push
```

(or if `origin` already exists locally: `gh repo create ronviers/mpa-conform --public` + manual `git push -u origin main`).

**`.gitignore`** should at minimum exclude `output/seed-corpus/` (staging output) and `.claude/` (machine-local settings) — see existing `mpa-auditor/.gitignore` for pattern.

---

## 7. The internal-MCP-tool option

The user has named a design avenue: **`mpa-conform` may vendor its own MCP server** exposing tools the researcher-path LLM calls. Example tools:

- `parse_csv` — robust CSV parsing with messy-row tolerance, encoding detection, header disambiguation.
- `lookup_substrate_class` — read `mpa-auditor/corpus/substrate-classes.json`, match user description to a class id.
- `lookup_doi` — query DataCite / Crossref / Zenodo.
- `validate_units` — unit-system check against expected substrate observables.
- `extract_multi_window_fdr` — run the windowed-correlator over raw time-series, return canonical (τ, C, χ) at multiple τ_obs windows.
- `sign_bundle` — produce the manifest hash, attach signature.

This is a clean fit for the project — MCP servers are static deliverables (one process, well-defined tool surface), and the LLM-orchestration logic stays thin per `feedback_thin_modern_engineering.md` (one function, match model to problem, cache as log).

**Defer the MCP-server build until after the curator path lands.** The curator path doesn't need an LLM at all — it's mechanical extraction from grind cells. The MCP server earns its weight when the researcher path starts handling real messy uploads. Surface the option here so the next session knows the option exists.

---

## 8. What `mpa-conform` does *not* do

- **Run substrate simulations.** That's substrate-package territory (`mpa-brain`, `mpc-glass`, `mpc-quantum`) consumed via `mpa-central/library`'s `grind_library.py`. `mpa-conform` reads grind output; it does not regenerate it.
- **Audit data.** That's `mpa-auditor`. `mpa-conform`'s deliverable is the input to the audit, not the audit itself.
- **Build the backward map.** Per `mpa-auditor/docs/foundational-answers.md` §Q13, only the forward half (canonical → substrate-native) is ever built. The audit-time backward inference is via forward sweep in the auditor's Inversion Engine, not via inverting a translation field.
- **Edit `mpa-atlas`.** It reads cdv1 + RFC-S + receipts; it writes to its own repo + `mpa-auditor`'s `seed-corpus/`. Questions about framework specs route through `mpa-auditor/docs/foundational-questions.md` → `mpa-atlas` Appendix B pipeline, not through `mpa-conform`-side edits.
- **Edit `mpa-auditor`'s `contracts/` or `corpus/`.** The auditor's schemas + manifest are authoritative; `mpa-conform` reads them. (The seed-corpus exception is by-design: `mpa-conform`'s curator path commits to `mpa-auditor/seed-corpus/` via PR.)

---

## 9. Acceptance for this bootstrap session

1. `H:/mpa-conform` exists; `git init`d; GitHub repo `ronviers/mpa-conform` created and pushed.
2. Scaffolding from §6 in place — README, CLAUDE.md, docs/ROADMAP.md, docs/foundational-questions.md, docs/foundational-answers.md, docs/next-session-handoff.md, schema/declaration-bundle.v0.1.json (skeleton), conformer/ directory structure, output/ + tests/ placeholders, .gitignore.
3. Machine `~/.claude/CLAUDE.md` settings extended with `H:\\mpa-conform` permissions.
4. **The curator-path post-processor** from §5 runs over all 60 grind cells without erroring; one driver profile + a few DataUploads validate against the relevant schemas; one DataUpload smoke-tests as a fixture in `mpa-auditor`.
5. Append a Session Log row to `mpa-conform/README.md`.
6. Commit + push; report SHA.
7. Write a regenerated `mpa-conform/docs/next-session-handoff.md` for the next session (researcher path? refining the translation field? MCP server? — let the user pick).
8. Update `mpa-auditor/docs/ROADMAP.md` to flip the `mpa-conform bootstrap` row from "next up" to "shipped 2026-MM-DD" and add a Session Log row to `mpa-auditor/README.md` noting the cross-repo milestone (auditor session log carries cross-repo milestones; mpa-conform's own session log carries its internal sessions).

**Resist scope creep.** The researcher path, the MCP server, the LLM-assist work, the windowed-correlator — none of these are first-session deliverables. The first session ships the curator path and the scaffolding. Everything else is its own session, sequenced by the user.

---

## 10. References (one-stop list)

- `mpa-auditor/docs/foundational-answers.md` §Q12 (with 2026-05-15 correction note) — the architectural decision.
- `mpa-auditor/docs/foundational-answers.md` §Q13 — forward-only audit; `mpa-conform` builds only the forward half of the translation field.
- `mpa-auditor/docs/foundational-answers.md` §11 — scoping discipline; `mpa-conform`'s row in the sibling-repos table.
- `mpa-auditor/docs/ROADMAP.md` — the parallel-tracks framing; `mpa-conform`'s row.
- `mpa-auditor/README.md` Session Log — the `mpa-conform architectural decision` row dated 2026-05-15.
- `mpa-central/library/LIBRARY_SPEC.md` + `grind_library.py` — the curator path's input shape.
- `mpa-central/library/data/{brain,glass,quantum}/*.json` — the 60 existing grind cells.
- `mpa-atlas/rfcs/MPA-RFC-S_Scale-Management.md` §4 + `mpa-atlas/schema/driver-profile.v0.2.json` — the driver profile output shape.
- `mpa-atlas/framework/cdv1_compressed.md` + `cdv1_receipts.md` — substrate-conditional reading rules and class definitions.
- `mpa-atlas/CLAUDE.md` — thin-RFC discipline. Read before reading any `mpa-atlas` document.
- `mpa-auditor/corpus/substrate-classes.json` + `corpus/api-manifest.json` — the 12 classes + 22 slots `mpa-conform` produces driver profiles against.

**Done. Read §§1–4 once more, then start in §5.**

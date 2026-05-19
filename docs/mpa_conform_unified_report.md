# Unified Research Brief: Agentic-Tool Landscape for `mpa-conform`

*Data-prep porch for the MPA Auditor — synthesis of four independent surveys, May 2026.*

This report consolidates four parallel research briefs into a single, deduplicated view. Where the four sources agreed, claims are stated plainly; where they disagreed (most notably on the tiny-LLM recommendation), the disagreement is surfaced and adjudicated against the strongest evidence cited. A final section proposes architectural moves that emerge only when the four briefs are read against each other.

---

## 1. MCP Server Ecosystem for Scientific Data Prep

The honest summary is that the MCP ecosystem in mid-2026 is mature for SaaS integrations and scholarly metadata, but thin-to-empty for the actual scientific-prep operations `mpa-conform` needs. Three of the four briefs converge on the same shape: a usable layer for DOI/citation work sitting atop a near-total vacuum for units, dimensional analysis, license normalization, robust CSV handling, and time-series correlator math. The fourth brief surfaces a few additional MCP entries that the others missed, particularly in CSV repair.

**DOI lookup and scholarly metadata.** This is the most mature corner. The strongest single entry is `cyanheads/openalex-mcp-server` (MIT, active 2026), exposing `search_entities`, `analyze_trends`, and `resolve_name` with DOI/ORCID/PMID normalization and both stdio and HTTP transports. For Crossref specifically, `botanicastudios/crossref-mcp` (MIT) is the most widely mirrored thin wrapper — title/author search plus DOI fetch, deterministic, read-only, with no provenance or snapshot semantics. Other entries worth knowing: `JackKuo666/Crossref-MCP-Server` (search_works, get_work_metadata, search_journals, search_funders; license unspecified), `eic/zenodo-mcp-server`, a DataCite MCP at `mcpbundles.com/skills/datacite`, the `orcid-mcp` server (released May 2026) which exposes heuristic author disambiguation against the 20M ORCID registry, and the federated `lstudlo/scholar-mcp` (Google Scholar + OpenAlex + Crossref + Semantic Scholar — more ambitious but more fragile due to scrape-adjacent upstreams). The biomedical-leaning `article-mcp` aggregates Europe PMC, PubMed, arXiv, Crossref, OpenAlex, and EasyScholar; less useful for physical-science workflows but worth knowing.

**Citation parsing and BibTeX cleanup.** `citecheck` (TypeScript, MIT, `github.com/jhlee0619/citecheck`, first commit March 17 2026, 47 passing tests, published as arXiv preprint) is the canonical entry and the closest thing to a drop-in component for the declaration-bundle workflow. It validates against PubMed, Crossref, arXiv, and Semantic Scholar; extracts from `.bib`, `.tex`, `.md`, `.docx`; emits structured repair proposals; and — critically — uses "policy-gated rewrite planning" that flags ambiguous entries for human curation rather than silently rewriting them. This last property aligns with the auditor's safety posture. Adjacent: `Xceron/bibtex-mcp` (MIT, multi-provider BibTeX generation), `gautierdag/bibextract` (Python + Rust backend, parses `.bbl` directly), and `zotero-mcp-server` (PyPI, requires a running Zotero instance — not a great fit for offline mode).

**License → SPDX-ID resolution.** Three briefs flagged this as a gap; the fourth surfaced two recent entries: `Ansvar-Systems/Open-source-license-mcp` (stdio, full 727-license SPDX registry, CRA obligations, REUSE 3.3 compliance) and `lunacompsia-oss/mcp-server-license` (compatibility matrices, risk classification). Neither has a clearly stated license, and maintainer activity is unverified. The honest read: even with these, the strongest path is probably a deterministic local pass against the SPDX license-list JSON plus a curated alias table, optionally with `license-expression` (nexB) or ScanCode for harder cases. This subsystem should remain non-LLM.

**Unit conversion and dimensional analysis.** Gap, with one partial entry: `zazencodes/unit-converter-mcp` covers 13–14 measurement categories using hard-coded conversion factors. It is not a dimensional-analysis engine — it cannot answer "does this expression have units of energy?" or distinguish atomic percent from weight percent. The right answer is a thin local MCP wrapper around `pint` (BSD, actively maintained, v0.24+) or a Rust port of equivalent semantics. `cf-units` (LGPL, UK Met Office) wraps UDUNITS-2 if geoscience interop matters.

**Robust CSV parsing.** Three briefs called this an unfilled gap. The fourth surfaced two genuinely interesting entries that change the picture:

- **`anyrepair`** (Rust crate, `crates.io/crates/anyrepair/0.2.0`) auto-detects formats and repairs malformed CSV/JSON with unclosed quotes, encoding faults, and ragged rows. Provides an MCP interface.
- **`csvql`** (Zig, <2MB static binary) offers SIMD-accelerated parsing, memory-mapped I/O, and a full SQL engine over CSV — community-reported query latency around 20 ms on 1M rows.

These two together would cover most of the "parse-anything-CSV" requirement. Beneath them, the standard Python stack remains the fallback: `charset-normalizer` for encoding, `clevercsv` for dialect detection, `frictionless` for schema inference and validation reporting, and `ftfy` for mojibake repair in free-text columns. Note the known issue (filed against `datagouv-mcp`) that naive UTF-8-only servers crash on ISO-8859 inputs — a real concern when researchers upload legacy datasets.

**Time-series correlator math.** All four briefs report this as a complete gap in the MCP layer. Treated in Section 3.

**Summary.** Adopt `openalex-mcp-server` and `citecheck` directly. Evaluate `anyrepair` and `csvql` for the CSV layer; if they hold up, they save a build. Build a thin `pint`-wrapper MCP for units. Keep license resolution local and deterministic. Expect to build the correlator MCP yourself.

---

## 2. Tiny-LLM Viability for Structured Extraction

The four briefs converge on the criteria — schema-conformant JSON, tool restraint, classification stability, header mapping accuracy — but disagree on the winner. The disagreement is genuine and reflects evidence that arrived at different times.

**The hard numbers** come from the AscentCore Q4_K_M / Q8_0 structured-output benchmark (April 2026, three briefs cite it):

- **Gemma-3-4B**: 100% JSON parse rate, 87.0% schema compliance at Q4_K_M (~2.3–2.5 GB). The strongest schema-compliance number in the sub-7B class. Caveat: it tends to wrap valid JSON in conversational markdown ("Here is the JSON…"), so a regex extraction pass is needed downstream.
- **Llama-3.2-3B**: 47.8–56.5% JSON parse rate, 34.8–52.2% schema compliance. **Liability** for automated pipelines.
- **Qwen2.5-7B**: 95.7% parse / 73.9% schema at Q4_K_M; the 3B variant is not in the table but is presumed a tier below.
- **Phi-3.5-mini**: 87.0% parse, 65.2% schema at Q4_K_M, but borderline on the 4 GB footprint (~4.2 GB) and **Phi-4-mini exhibits a documented repetition bug** (rate ~0.052, up to 50× peers) that can corrupt long CSV-header mapping arrays by infinitely repeating a single column name. Discount this family for header-mapping work specifically.

**Tool-calling restraint** (MikeVeerman's small-model benchmarks, Feb–March 2026):
- Llama-3.2-3B: 0.000 restraint. It calls tools when it shouldn't. Disqualifying for autonomous use.
- Qwen2.5-3B: 0.500 restraint, 0.800 action, 0.670 agent score. Native Ollama tool support.
- The fine-tuned `qwen25-3b-openclaw` (March 2026) reaches a tool score of 0.989 with 1.000 name accuracy and 0.983 argument F1 — the best measured in the sub-4 GB class.
- Surprise inversion: Qwen2.5-**1.5B** sometimes beats the 3B on restraint, declining unnecessary calls more reliably.
- Qwen3-4B at 63 s/prompt CPU latency dropped out of one benchmark round on practicality grounds — relevant if `mpa-conform` is interactive but tolerable for a batch porch.

**Newer entries the original shortlist didn't have:**
- **Gemma-3-4B** (March 2026, Google) — the schema-compliance leader above. Licensed under Gemma Terms (not OSI-approved; verify redistribution rights).
- **Gemma-4 E4B** (April 2026, Google) — native function-calling trained into base weights, materially better restraint than system-prompt-driven setups.
- **Qwen3-4B / Qwen3.5-4B** (Alibaba) — strong on tool-use and vision tasks; less independent structured-output benchmarking yet.
- **SmolLM3-3B** — reliable structured outputs with dual-mode (chat / JSON) generation.
- **BitNet-2B-4T** (Microsoft, 1-bit instruction-tuned) — perfect JSON tool calls on laptop CPUs in <2.3 s in cited tests. Worth a serious look for the offline tier even though it's a different paradigm.
- **Phi-4-mini** (MIT, 3.8B) — strong on STEM logic and mapping, but the repetition bug above is a real liability for `mpa-conform`'s use case.

**Adjudicated recommendation.** For the bundled offline tier, **Gemma-3-4B at Q4_K_M** has the hardest schema-compliance evidence (the dominant failure mode in `mpa-conform` is malformed JSON, not weak reasoning). For workflows where tool-calling reliability matters more than raw JSON conformance, **`qwen25-3b-openclaw`** is the best measured fine-tune. The pragmatic choice may be to ship both behind a config flag, since their failure modes are orthogonal. Avoid Llama-3.2-3B for schema-critical work; avoid Phi-4-mini for header-mapping work. Validate licensing carefully — Gemma and Llama use custom non-OSI licenses; Qwen3 and Phi-4-mini are cleaner on redistribution.

**Quantization trade-off worth confronting up front:** Q4_K_M typically preserves parse rate but drops schema compliance vs. Q8_0. For Gemma-3-4B, Q4_K_M ≈ 2.3 GB (fits), Q8_0 ≈ 4.6 GB (exceeds the 4 GB ceiling). Plan for Q4_K_M as the default and surface the accuracy hit honestly.

---

## 3. Multi-τ_obs FDR Correlator

All four briefs reach the same verdict: this is a "must build," but every piece of the underlying mathematics is solved, and the building blocks are vendorable.

**What exists.** The genuinely relevant prior art:
- **`multipletau`** (Python, GPL-ish, last updated June 2024) — a pure-NumPy implementation of the Ramírez/Sukumaran/Vorselaars/Likhtman multi-τ blocking algorithm on a logarithmic scale. Compact, correct, but Python-only. Computes C(τ) only; the fluctuation-dissipation relation χ(τ) = C(0) − C(τ) is downstream.
- **`pycorrelate`** (Python, GPL-3.0, Numba-accelerated) — multi-tau for both uniformly sampled signals and point processes; arbitrary log-spaced lag bins. Same gap: C(τ) only.
- **`tidynamics`** (BSD) — fast correlation algorithms used in statistical-physics and MD contexts. The closest conceptual neighbor.
- **`scipy.signal.fftconvolve`** — O(N log N) but requires zero-padding to avoid circular correlation, and maintains a linear lag grid that is wasteful for log-spaced physics.
- **`freud`** — structural/statistical observables over particle ensembles; closer to the physics domain than generic time-series packages.
- **LAMMPS** (`fix_ave_correlate_long`) and **ESPResSo** (`Fast multi-tau real-time software correlator`) both implement what you need, but are deeply embedded in MD engines — unvendorable.

**What's missing.** No library provides the full "feed raw stochastic streams, get back (τ, C(τ), χ(τ)) triplets on a dense τ_obs × t_sample × n_realizations grid with t_w + t_obs windowing." The aging/non-equilibrium semantics, FDR ratio extraction, and surface-code-syndrome stream observables are all custom work. The physics community has many partial implementations inside individual papers and lab codebases, but no reusable infrastructure.

**Architectural recommendation.** Given that `mpa-solver` already compiles to WASM, introducing a Python runtime boundary (via `multipletau` or `pycorrelate`) in the correlator would break cross-platform integrity. The right move is to **port the multi-τ blocking algorithm into a standalone Rust crate** (clean port of `multipletau`'s ~few-hundred-line numerical core), add t_w/t_obs windowing and n_realizations averaging natively, expose canonical (τ, C(τ), χ(τ)) outputs, and compile to WASM alongside the solver. This keeps the offline deployment dependency-free and gives the wider community a reusable artifact in a language that doesn't currently have one. The mathematics is fixed; the Rust port is bounded engineering.

---

## 4. Lightweight Provenance Signing

The four briefs converge unusually tightly here. The threat model — air-gapped verification in 2030 by a researcher with only the downloaded bundle — eliminates most of the modern supply-chain stack.

**What to skip and why:**
- **Sigstore / cosign.** Keyless signing via Fulcio (OIDC-bound short-lived certs) and Rekor (transparency log). Offline verification is technically possible by packaging certificate + signature + Signed Entry Timestamp, but it requires the verifier to hold the exact TUF root trust metadata valid *at signing time*. Root rotations break verification with "unknown authority" errors. For a 2030 timeframe this is a fatal flaw, and the X.509 + Merkle-proof verification surface is enormous relative to the use case.
- **Full SLSA provenance.** Designed for CI/CD build chains. Over-specified for researcher-generated bundles.
- **OpenPGP via `pgpy`.** Works offline but brings keyring complexity and a larger attack surface than needed.

**What to use.** Ed25519 with a manifest fingerprint, optionally wrapped in an in-toto Statement, optionally enveloped in DSSE with JCS canonicalization. The spectrum from minimal to richer:

1. **Minimal viable (recommended starting point).** Canonical JSON manifest listing each bundle file with BLAKE3 or SHA-256 hashes; Ed25519 detached signature over the manifest; embedded public-key fingerprint. Verification needs only `minisign` (Frank Denis, dead-simple, ~100-byte signature files, key IDs included) or a 50-line Python verifier using `cryptography` (Apache-2.0/BSD, v44+ in 2026). `securesystemslib` (PyPI, MIT) is the heavier-batteries alternative if you want the same primitives that back in-toto and TUF.
2. **Add structure.** Wrap the payload in an **in-toto Statement** (Subject → Predicate) for machine-readable provenance semantics — researcher ORCID, tool version, retrieval timestamps, upstream source IDs. This is what SLSA uses under the hood, and it's lightweight on its own.
3. **Add determinism.** Use **JCS (RFC 8785) canonical JSON serialization** to eliminate signature breakage from whitespace or key-ordering changes. This matters more than the algorithm choice — non-canonical JSON is the most common cause of "valid signature failing verification" in practice.
4. **Add envelope discipline.** A **DSSE (Dead Simple Signing Envelope)** wraps payload + payload type + signature into a single deterministically verifiable JSON object. This is the format SLSA uses and it works cleanly with Ed25519.

**Recommended bundle layout:**

```
manifest.json          # canonical JSON, BLAKE3 hashes of all files
manifest.dsse          # DSSE envelope around an in-toto Statement
pubkey.txt             # human-readable Ed25519 public key
verify.html            # static page (see §5) for browser-based verification
```

This stack costs almost nothing in dependencies, survives indefinitely, and degrades gracefully — even if the DSSE/in-toto tooling vanishes, the raw Ed25519 signature over the canonical manifest can still be verified by hand with any Ed25519 implementation.

---

## 5. What the Four Briefs Reveal Together — Emergent Recommendations

Reading the four briefs against each other surfaces several moves that no single brief named but that follow naturally from their combined picture.

**Canonicalization is the actual product.** Three briefs gestured at this independently. Extraction quality is not the bottleneck for `mpa-conform`; deterministic serialization, frozen upstream snapshots, retrieval timestamps, cache fingerprints, and replayable manifests are. Treat JCS canonical JSON, schema versioning from day one, and explicit provenance for every external metadata fetch (Crossref, OpenAlex, etc., which are *mutable* upstream) as first-class requirements. Snapshot the upstream payload alongside the bundle; do not just record the DOI.

**An all-Rust/WASM porch is now feasible.** Combining the Section 3 verdict (port the correlator to Rust) with the Section 1 finds (`anyrepair` as a Rust CSV-repair crate, `csvql` as a Zig SIMD CSV engine) and the WASM target of `mpa-solver` suggests an architectural alignment: the entire numerical and parsing layer of `mpa-conform` can be a single WASM blob. DuckDB-WASM as the streaming porch engine (CSV → schema inference → Parquet/Arrow normalization → correlator), Rust correlator kernels for FDR observables, and the static HTML verifier below for provenance — all under one runtime. This makes (B), the bundled offline mode, the *primary* deployment story rather than a fallback, and (A), the bring-your-own-model API mode, a transparent overlay.

**Embed a browser-based verifier in the bundle itself.** A static `verify.html` using WebCrypto or a small WASM Ed25519 implementation lets the 2030 researcher verify signatures and recompute manifest hashes without installing Python, Rust, or `minisign`. This mirrors the offline-audit philosophy of the parent tool and dramatically lowers the verification activation energy. Pair it with a `verify.py` for command-line users; ship both.

**Run two extraction models with orthogonal failure modes.** Gemma-3-4B fails by emitting valid JSON wrapped in chatter; Qwen-2.5-3B (especially the `openclaw` fine-tune) fails by occasionally over-calling tools or producing slightly off-schema JSON. Their failure modes are complementary. A cheap N-of-2 consistency check (run both, accept if they agree on the structured fields, escalate to curator review if they disagree) gives much higher de-facto reliability than either model alone, at roughly 2× inference cost. This is especially valuable for the offline tier where the user cannot fall back on a stronger cloud model.

**Pydantic at the boundary, every time the LLM speaks.** None of the model benchmarks promise 100% schema compliance even for Gemma-3-4B (87% at Q4_K_M is the *high* number). Validate every LLM output with Pydantic (MIT) or `typeguard` before it touches the bundle, and structure the prompt loop to retry with the validation error as feedback. This is mundane but it's the difference between an 87%-reliable system and a 99%-reliable one.

**Adopt RO-Crate and W3C PROV as interoperability targets, not primary formats.** `declaration_bundle.json` stays as the canonical internal format, but emit RO-Crate and Data Package (`frictionless`) sidecar manifests so the bundle can be ingested by Zenodo, Dataverse, and institutional repositories without bespoke connectors. This costs little and broadens the audience meaningfully.

**Take MCP security seriously even in offline mode.** Two of the briefs flagged tool-poisoning attacks (malicious payloads in user-supplied CSVs triggering prompt injection in the extraction agent) and "rug-pull" capability mutation in the public registry. For `mpa-conform` specifically: pin MCP server versions by hash, sandbox the LLM's tool invocations so they cannot reach the filesystem beyond a scoped working directory, and treat any text extracted from user uploads as untrusted input to the prompt — never concatenate it into instructions.

**Reproducible environments from day one.** For the offline target, ship a `pixi` (prefix.dev, BSD) or `conda-pack`-built relocatable environment, or a single-binary container. The combination of pinned Python deps + pinned model weights + pinned MCP servers + pinned correlator binary is the actual reproducibility unit, and it needs a build system that can pin all of them together.

**One under-discussed risk: the correlator is the first reusable artifact.** A clean Rust crate for multi-τ FDR observables, with a sensible API and good docs, is something the wider statistical-physics community currently does not have. If `mpa-conform` is built well, this is the piece most likely to take on a life of its own — worth investing in API design and documentation accordingly, even if no other component is ever generalized.

---

*Sources: four parallel research briefs (data_prep_1 through data_prep_4) compiled mid-May 2026. Numerical benchmarks (AscentCore, MikeVeerman, WildToolBench, BFCL v3) and library/MCP repository details are drawn directly from those briefs; the synthesis and §5 recommendations are emergent from cross-reading them.*

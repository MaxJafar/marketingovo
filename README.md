# AGENTintel

AGENTintel is an evidence-first, local business-intelligence research center
for competitive marketing and creator analysis. It is designed for the agentic
era without turning a language model into an unrestricted scraper: the daemon
owns policy, credentials, durable state and evidence publication; agents receive
six bounded workflow tools and cited results.

This repository is **open source** under the [Apache License 2.0](LICENSE), an
OSI-approved license that grants patent rights and permits commercial use,
modification, and redistribution. See
[ADR 0003](docs/adr/0003-apache-2-0-relicense.md) for why the project moved off
the Elastic License, and what that means for the reference corpus below.

## What is implemented now

The repository currently proves a hardened **Phase 1 walking skeleton** over a
synthetic fixture:

1. the React/TypeScript command center starts a synthetic three-brand comparison;
2. `agentinteld` validates a one-time dashboard session and schedules a durable
   SQLite-backed job;
3. a Go fixture connector snapshots bounded source evidence;
4. Go supervises Python through length-delimited Protobuf control messages;
5. Python normalizes an exact 32-field Arrow schema, writes Arrow and Parquet,
   queries DuckDB, and produces denominator-safe metrics with citations;
6. Go treats every worker artifact as untrusted, physically decodes the exact
   32-field Arrow and Parquet schemas, compares their rows, verifies report
   citations/provenance plus containment, hashes and policy, then publishes a
   manifest by filesystem rename and streams ordered SSE progress;
7. the same run is available through the Go CLI, generated TypeScript SDK,
   authenticated MCP stdio/Streamable HTTP, OpenClaw, and the installable Codex
   plugin;
8. normal, source-failure, corrupt-artifact, slow/cancel and immutable-input
   replay paths have test coverage.

The fixture is entirely synthetic and uses reserved `.invalid` URLs. No live
platform is contacted by the implemented comparison or research workflow. The
research endpoint currently plans and synthesizes only that committed fixture;
it is not yet the multi-source deep-research product described in the roadmap.

Phase 0 is a **quarantine baseline**, not a completed reverse-engineering
program. The repository inventories 50 local snapshots, blocks every one from
product builds and tracks suspicious paths without exposing values. Exact
upstream URLs, commits, archive hashes and dependency provenance are still
unresolved for much of the corpus; the current behavioral table is triage, not
one finished engineering card per project. Credential rotation/revocation is an
external operator action and has not been performed by this repository.

Website/RSS, YouTube, Reddit, Meta, TikTok, Trends, licensed-provider and Golem
SEO connectors; production watchlists; creator/company intelligence; hosted
workers; and signed public desktop releases remain Phases 2–6. See the
[implementation status](docs/status.md) for the exact boundary.

## Language boundaries

- **Go:** authoritative loopback daemon, sessions, jobs, connectors, artifact
  governance, SQLite and CLI.
- **Python:** Arrow/Polars normalization, DuckDB analytics, evidence-quality
  checks and reproducible model/runtime tests.
- **TypeScript:** React command center, generated SDK, MCP, Codex and OpenClaw
  projections.
- **Rust:** narrow Tauri 2 shell for signed sidecars, native credential storage,
  lifecycle and updater verification.
- **OpenAPI, Protobuf, JSON Schema, Arrow and Parquet:** shared contracts and
  storage; handwritten duplicate runtime types are not the source of truth.

See [architecture](docs/architecture.md), [threat model](docs/threat-model.md),
[privacy policy](PRIVACY.md), and the
[50-snapshot quarantine inventory](docs/reverse-engineering/README.md).

## Quick start

Prerequisites: Go 1.26, Node 24 with pnpm 10, Python 3.12/3.13 with `uv`, and
Buf/Protobuf. Rust stable is needed only for the desktop shell.

```bash
pnpm install
UV_CACHE_DIR=.agentintel/cache/uv uv sync --project workers/intelligence --frozen
pnpm contracts:generate
pnpm build
go build -o bin/agentinteld ./cmd/agentinteld
go build -o bin/agentintel ./cmd/agentintel
./bin/agentinteld serve \
  --data-dir .agentintel/dev \
  --python-worker "$(pwd)/workers/intelligence" \
  --uv-command "$(command -v uv)"
```

This developer launch uses the pinned `uv` environment. It is a trusted,
same-user process boundary—not an operating-system sandbox. Packaged launches
instead pass a manifest-verified, absolute, non-symlink interpreter through
`--python-command` and supply the one-time dashboard ticket through
`--dashboard-bootstrap-token-stdin`; the detailed quick start shows both modes.

The daemon prints one `Dashboard:` URL containing a one-time fragment ticket.
Open that URL. The dashboard removes the fragment, exchanges it for an HttpOnly
same-site session, and keeps the CSRF token only in memory. The persistent
`service-token` is separate, mode `0600`, and is used only by CLI/agent clients.

In another terminal:

```bash
./bin/agentintel \
  --token-file .agentintel/dev/service-token \
  compare \
  --project competitive-pulse-demo \
  --target northstar-labs \
  --target orbit-coffee \
  --target vertex-studio \
  --wait
```

See [the detailed quick start](docs/quickstart.md) for cancellation, replay,
failure simulations and agent configuration.

## Verification

```bash
pnpm check
rustup run stable cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

The reference archives under `TO REVERSE ENGINEEER/` are untrusted research
material. CI may inventory paths and run value-suppressing secret heuristics,
but the archives are never executed or used as product/build/test input, search
content, embeddings or product data. Do not execute them from the product
environment.

## Product boundary

AGENTintel supports public-and-permitted, user-authorized, first-party and
contractually licensed business evidence. It does not ship authentication
bypass, CAPTCHA evasion, stolen sessions, private-account access, breach data,
biometric correlation, protected-trait inference, covert identity enumeration,
candidate ranking, employee monitoring or automated employment decisions.

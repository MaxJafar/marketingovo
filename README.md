# Marketingovo

<p align="center">
  <img src="assets/brand/marketingovo-icon.png" width="132" height="132" alt="Marketingovo product mark">
</p>

**A local-first SEO operations system that turns crawl, Search Console, GA4,
performance, and SERP data into verified actions.**

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-5b63ff)](LICENSE)
[![Telemetry](https://img.shields.io/badge/telemetry-off%20by%20default-242b36)](PRIVACY.md)
[![Version](https://img.shields.io/badge/version-1.0.0-20b486)](docs/release-status.md)

Marketingovo runs on your machine, requires no account, and
keeps projects and credentials under your control. It does more than produce an
issue dump: it connects technical evidence to organic exposure, conversion
exposure, reach, confidence, and effort so a marketer can decide what to fix
first and verify the result after the next audit.

> **Status: 1.0.0.** The REST API, OpenAPI document, SDK, nine-tool agent
> contract registry, CLI and `.marketingovo` bundle format are stable; breaking
> changes to them now require a major version.
>
> Install from source or as an agent plugin. Signed desktop installers, the
> updater channel, and npm registry publication are **not** part of this release
> — they need a code-signing identity and a registry account that do not exist
> yet, and are declared as deferred channels in
> [`release/acceptance/1.0.0.json`](release/acceptance/1.0.0.json). See
> [release status](docs/release-status.md) for exactly what was verified.

## Why Marketingovo

- **Actions, not noise.** Every prioritized action explains impact, effort,
  confidence, affected URLs, evidence, and verification state.
- **Human quality control.** Reviewers can document intentional exceptions and
  false positives without deleting evidence; those decisions persist across
  future audits, narrow grouped Action scope and priority, and stay reversible.
- **Reusable strategy memory.** A versioned Project Context profile and
  append-only marketer journal keep audiences, markets, conversion goals,
  constraints, decisions, and experiments beside the evidence.
- **Local-first by default.** The API binds to `127.0.0.1`; telemetry is off;
  secrets are write-only and excluded from exports.
- **Owned data lifecycle.** Export a portable project or permanently delete its
  runs, evidence, actions, context, schedules, settings, and artifacts through
  an exact-name confirmation; shared BYOK credentials remain separately
  revocable.
- **Cross-source evidence.** Crawl, GSC, GA4, Lighthouse, PSI, Trends, SerpAPI,
  and DataForSEO use one normalized model.
- **Audit evidence workbench.** Paginated crawl paths, redirect chains,
  reciprocal hreflang, sitemap coverage, and bounded custom extractions expose
  the exact source state behind a finding instead of collapsing missing data to
  zero.
- **Reproducible local replay.** Re-run a terminal audit from its stored
  workflow and exact options with a new immutable run ID and configuration
  hash; the source result is never edited.
- **Evidence-based audit comparison.** Compare any two completed audits from
  the same project without starting another crawl. Golem separates new,
  resolved, and severity-changed issues from HTTP and indexability changes,
  exposes configuration drift and versioned internal-link deltas, and never
  converts missing health or graph evidence to zero.
- **Versioned extraction workspace.** Build project-scoped CSS extraction
  rules in Settings, reject unsafe selectors and regexes before execution,
  preview one exact-origin page through the production egress policy, and
  snapshot the rule revision into every new audit and replay.
- **Human and agent parity.** Dashboard, CLI, REST, MCP, Codex, and OpenClaw use
  the same runtime contracts.
- **Extensible and reproducible.** Custom rules, connector contracts, fixtures,
  and benchmark inputs are inspectable.
- **No artificial local limits.** Projects and audits are limited only by the
  resources of the machine running Marketingovo.

## Quick start

Requirements: Node.js 24 LTS and Corepack.

```bash
corepack enable
pnpm install
pnpm build
pnpm marketingovo serve
```

The crawler refuses private and loopback addresses by default, so a site on
`localhost` or an internal host is not auditable until you approve that exact
host for the run. This is deliberate: a crawler that follows discovered links is
otherwise a route into your own network.

Open the exact `Dashboard:` URL printed by the command. It includes a short-lived,
one-time bootstrap token in the URL fragment; the dashboard exchanges it for an
HttpOnly local session and removes it from the address bar. Opening bare
`http://127.0.0.1:3210` in a new browser session is intentionally rejected.

The guided flow is:

```text
Add site → establish context → connect data → choose goal → run audit
         → review evidence → act → verify
```

Verified tagged releases also provide an npm route that does not require
cloning the repository:

```bash
npx @marketingovo/cli serve
```

The current source version is not evidence that the same version has already
been published. Use only a GitHub release that includes
`npm-publication.json`, matching tarball integrity, and npm provenance.

See [the ten-minute quickstart](docs/quickstart.md) and
[current release status](docs/release-status.md) before using an alpha build on
production sites.

## Portable projects

There is no paid tier and no hosted edition. Every capability in this repository
is available to everyone, and nothing is withheld to sell later.

Projects can be exported as `.marketingovo` bundles. Secrets are never exported and
must be reconnected after import. Issue fingerprints, review decisions, and
bounded review reasons are preserved together with Project Context revisions
and the append-only marketer journal.

## Product surfaces

```text
Dashboard / CLI / MCP / Codex / OpenClaw
                    │
              Local REST API
                    │
     Runtime, scheduler, vault, SQLite
                    │
   Engine, workflows, rules, connectors
```

The localhost API is same-origin and versioned under `/api/v1`. Long-running
operations return `202` with a run ID, progress streams over SSE, and errors use
`application/problem+json`.

The dashboard is a console, and the prompt along its bottom edge is a real one.
Marketingovo runs no model and holds no model credential: it delivers what you
type to an agent harness you started and authorized yourself, and streams that
harness's answers back. One agent holds a session at a time, liveness is decided
by a lease rather than a clean goodbye, and the transcript lives only in memory —
it is never written to SQLite, exports, or backups.

The Pages workspace also exposes an immutable internal-link graph for each new
audit. Marketers can inspect exact inlink sources and outlink targets, anchor
samples, follow/nofollow occurrences, placement, redirects, broken targets,
and unavailable legacy evidence without starting another crawl.

Audit comparison uses those same immutable graphs to show exact added, removed,
and modified source-to-target edges. `link-delta-v1` classifies only observed
broken-link creation or recovery as directional impact; editorial additions,
removals, nofollow changes, and uncrawled targets stay neutral until a marketer
reviews intent.

Settings includes a versioned extraction-template catalog for social,
editorial, commerce, and migration QA. Every pack exposes its assumptions,
selectors, and capture modes before import; adding a pack changes only the
unsaved draft until the marketer previews it and explicitly saves a revision.

## Priority model

`priority-v1` is intentionally transparent:

```text
base = 0.35×severity
     + 0.25×organic_exposure
     + 0.15×conversion_exposure
     + 0.15×url_reach
     + 0.10×confidence

priority = 100 × base × effort_multiplier
effort_multiplier: low=1.0, medium=0.75, high=0.5
```

Inputs are normalized to `0..1`. Missing integrations lower confidence and are
shown as unavailable; they are never silently converted to zero.

## Repository layout

One repository, three runtimes. Node is the product; the other two are opt-in.

| Path                            | Runtime | Contents                                                        |
| ------------------------------- | ------- | --------------------------------------------------------------- |
| `apps/`                         | Node    | Dashboard, desktop shell, documentation site                    |
| `packages/`                     | Node    | Core engine, CLI, server, storage, SDK, MCP, contracts          |
| `services/intel-daemon/`        | Go      | Scheduled collection, rights and retention policy, run recovery |
| `services/intelligence-worker/` | Python  | Arrow/Parquet cohort analysis for large local observation sets  |
| `contracts/`                    | —       | Protobuf, OpenAPI and JSON Schema contracts shared by all three |
| `adapters/`, `plugins/`         | Node    | Agent-host surfaces                                             |

`pnpm check` runs the Node gates and is what a normal contributor needs.
`pnpm check:native` adds the Go and Python gates; `pnpm check:all` runs both.
Installing Go and Python is not required to build, test or run Marketingovo
itself.

`TO REVERSE ENGINEEER/` holds third-party projects kept only to be read. It is
excluded from version control and from every build, test and product input, and
nothing is copied from it. `pnpm reference:validate` enforces that.

## Documentation

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Intelligence architecture (proposal)](docs/intelligence-architecture.md)
- [Project Context and marketer journal](docs/project-context.md)
- [Desktop runtime and release configuration](docs/desktop-release.md)
- [npm release and provenance](docs/npm-release.md)
- [Privacy](PRIVACY.md)
- [Threat model](docs/threat-model.md)
- [Reference-tool reverse engineering](docs/reference-tool-reverse-engineering.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Launch kit](launch/README.md)

## Honest scope

Marketingovo is not marketed as a complete Ahrefs, Semrush, or Screaming Frog
replacement. Those products have mature proprietary datasets and workflows.
Our claim is narrower and testable: local-first evidence from several sources
becomes a transparent action queue that can be re-audited and verified.

## License and marks

Marketingovo is **open source** under the [Apache License 2.0](LICENSE), an
OSI-approved license that grants patent rights and permits commercial use,
modification, and redistribution. See
[ADR 0001](docs/adr/0001-apache-2-0-relicense.md) for why the project moved off
the Elastic License.

Contributions are accepted under the same license; there is no separate
contributor agreement. See [CONTRIBUTING.md](CONTRIBUTING.md).

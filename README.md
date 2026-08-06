# Marketingovo

<p align="center">
  <img src="assets/brand/marketingovo-readme-poster.png" alt="Marketingovo — local-first marketing intelligence for SEO audits, competitor intelligence, content signals, and verified results">
</p>

**A local-first marketing system covering SEO, paid media, social publishing,
email and public-web research — turning crawl, Search Console, GA4, ad
platform, performance and SERP signals into verified actions, and saying
plainly what it could not measure.**

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-5b63ff)](LICENSE)
[![Telemetry](https://img.shields.io/badge/telemetry-off%20by%20default-242b36)](PRIVACY.md)
[![Version](https://img.shields.io/badge/version-1.1.0-20b486)](docs/release-status.md)

Marketingovo runs on your machine, requires no account, and
keeps projects and credentials under your control. It does more than produce an
issue dump: it connects technical evidence to organic exposure, conversion
exposure, reach, confidence, and effort so a marketer can decide what to fix
first and verify the result after the next audit.

One rule runs through all of it: **a value that was not measured is `null` with
a stated reason, never a zero.** "This campaign spent nothing" and "we could not
read this account" call for opposite actions, and only one of them is about the
account. The same discipline is why the cross-channel report refuses totals that
would be fabrications, and why the paid audit reports the share of an account it
could not inspect rather than treating silence as a clean bill.

> **Built-in public-web OSINT.** Research your site and up to four explicitly
> supplied public HTTPS targets from the dashboard (`/osint`), CLI, REST API,
> MCP, or OpenClaw. Marketingovo returns cited source links, availability states,
> publication signals, public profile links, business-page discovery, and an
> exact-match evidence graph, stable claim fingerprints, and a dossier
> provenance digest, then compares repeat passes for added, removed, and
> changed public signals. The digest detects report changes but does not turn
> a public source into verified truth. It is deliberately not a people-search,
> authenticated-scraping, contact-enrichment, breach, or dark-web tool. See the
> [OSINT layer guide](docs/osint-layer.md).

> **Status: 1.1.0.** The REST API, OpenAPI document, SDK, nineteen-tool agent
> contract registry, CLI and `.marketingovo` bundle format are stable; breaking
> changes to them require a major version. Every release gate is recorded with
> the command that produced it in
> [`release/acceptance/1.1.0.json`](release/acceptance/1.1.0.json), including
> the two named human attestations.
>
> Install from source today. The public npm distribution graph is now prepared
> and verified; after a canonical tag publishes it, the shortest install will be
> `npx marketingovo serve`. Signed desktop installers and the updater channel
> remain deferred until their signing identities and lifecycle evidence exist.
> See [release status](docs/release-status.md) for exactly what was verified.

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
  DataForSEO, Meta Ads and Google Ads use one normalized model.
- **One report across every channel, with its gaps stated.** The document you
  send a client on the first of the month — paid, organic, social and email in
  one place. It refuses the totals that would be fabrications and says why:
  conversions are never summed across channels, because Meta's attributed
  conversions and Analytics' key events count the same purchase on different
  models. A disconnected source shows its reason where the number would be,
  never a zero, and a change is only reported when both periods were measured.
  See the [cross-channel report guide](docs/cross-channel-report.md).
- **The join between the ads and the site.** An SEO tool knows what a page
  says; an ads tool knows where the money goes; neither knows the other. This
  holds both, so the paid audit also checks the pages the ads land on: a
  destination returning 404 — every click billed, none arriving, invisible in
  every ad-platform metric — a redirect that silently drops the click
  identifier so conversions are never attributed back, and landing pages that
  never mention what is being bid on, which is what a low quality score
  actually means. See the
  [landing alignment guide](docs/landing-alignment.md).
- **Google Ads, read and audited.** Search terms that took money and converted
  nothing, the same query wasting spend across several campaigns, broken
  conversion tracking, campaigns held back by budget versus by ad rank — two
  problems with opposite remedies that Google reports separately and most
  dashboards merge. It also reports how much spend sits in Performance Max,
  whose queries Google exposes to nobody: an audit that inspects the third of
  an account it can see and reports a clean bill is lying by omission. Needs
  your own developer token from a Google Ads manager account; this ships none,
  because a token compiled into the app would make every install one identity
  to Google. Read-only by design. See the
  [Google Ads guide](docs/google-ads.md).
- **QR codes that are free the way a hammer is free.** Generated locally, with
  no account and no service resolving them, so nothing can meter them, revoke
  them or start charging — including after this software is uninstalled. The
  encoder is written here rather than taken from a package, because a code
  printed on ten thousand leaflets is a commitment measured in years. The
  tagging is checked before the code exists, and the checks refuse rather than
  warn: a printed code has no second attempt, so a capital letter that would
  split one campaign into two unmergeable rows is an error, not a note. It also
  judges whether the code can physically be scanned at the width it will be
  printed, which error correction cannot rescue. See the
  [campaign links guide](docs/campaign-links.md).
- **Email campaigns an agent can actually write.** Give the workspace a brand
  kit — colours, type stacks, logo, voice, legal footer — and an attached agent
  drafts the campaign HTML against it. Every draft is sanitized, CSS-inlined and
  checked against what real clients do: Outlook rendering with Word and ignoring
  flexbox, images without alt text that Outlook blocks by default, Gmail
  clipping past 102KB, contrast below WCAG AA, a missing unsubscribe tag. The
  agent iterates against that report until it is clean. Export the HTML into
  your own email service; Marketingovo does not send. See the
  [email builder guide](docs/email-builder.md).
- **One content calendar across platforms.** Write a post once and schedule it
  to Telegram, X, a Facebook Page and Instagram, with an immutable record of the
  exact request sent to each. Uploaded files stay on your machine and go
  straight to the platform; only Instagram needs a public URL, because its API
  fetches media rather than accepting an upload, and you supply that from your
  own storage. An agent can draft and stage every post; only a person in a
  browser can approve or publish one. See the
  [content calendar guide](docs/content-calendar.md).
- **Paid media beside organic.** Link Facebook and Instagram ad cabinets, read
  spend and delivery split by platform, and get paid findings — disapproved ads,
  missing conversion tracking, cost-per-conversion drift, creative fatigue,
  budget under-pacing — in the same prioritized queue as SEO work. A metric
  nobody measured is `null` with a reason, never a zero, and reach has no window
  total because adding it would count the same person twice. An attached agent
  can draft a whole campaign; only a person in a browser can approve one, and
  nothing in this build sends to Meta. See the
  [Meta Ads guide](docs/meta-ads.md).
- **Public-web OSINT research.** Run a bounded, cited dossier on your own site
  and explicitly supplied public targets, with source states, publishing cadence,
  public social/profile links, business paths, an exact-match graph, and cited
  repeat-pass changes.
- **Audit evidence workbench.** Paginated crawl paths, redirect chains,
  reciprocal hreflang, sitemap coverage, and bounded custom extractions expose
  the exact source state behind a finding instead of collapsing missing data to
  zero.
- **Reproducible local replay.** Re-run a terminal audit from its stored
  workflow and exact options with a new immutable run ID and configuration
  hash; the source result is never edited.
- **Evidence-based audit comparison.** Compare any two completed audits from
  the same project without starting another crawl. Marketingovo separates new,
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

**The npm route is prepared but not yet published for 1.1.0.** Once a GitHub
release includes `npm-publication.json`, matching tarball integrity, and npm
provenance, the install command is:

```bash
npx marketingovo serve
```

The source version alone is never evidence that the same version was published.

See [the ten-minute quickstart](docs/quickstart.md) and
[current release status](docs/release-status.md) before running this against
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

## Documentation

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Public-web OSINT layer](docs/osint-layer.md)
- [Desktop runtime and release configuration](docs/desktop-release.md)
- [npm release and provenance](docs/npm-release.md)
- [Privacy](PRIVACY.md)
- [Threat model](docs/threat-model.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Launch kit](launch/README.md)

## Honest scope

Marketingovo is not marketed as a complete Ahrefs, Semrush, or Screaming Frog
replacement. Those products have mature proprietary datasets and workflows.
Our claim is narrower and testable: local-first evidence from several sources
becomes a transparent action queue that can be re-audited and verified.
The public-web OSINT layer extends that claim to bounded, cited site and
competitive signals; it is not a people-search, authenticated-scraping, or
dark-web product.

## License and marks

Marketingovo is **open source** under the [Apache License 2.0](LICENSE), an
OSI-approved license that grants patent rights and permits commercial use,
modification, and redistribution. See
[ADR 0001](docs/adr/0001-apache-2-0-relicense.md) for why the project moved off
the Elastic License.

Contributions are accepted under the same license; there is no separate
contributor agreement. See [CONTRIBUTING.md](CONTRIBUTING.md).

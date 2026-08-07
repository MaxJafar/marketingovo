# Release status

## Unreleased — in preparation

The tree has grown past the approved 1.1.0 record and the additions below are
**not yet covered by any acceptance record**. They ship with the next approved
release (1.2.0 by the additive-change precedent of ADR 0003), which needs its
own `release/acceptance/1.2.0.json` with all seven gates re-observed and both
human attestations — attestations an agent must never fill in.

**What the tree adds since the 1.1.0 record:**

- **Multi-channel marketing.** Meta and Google Ads read-only audits into the
  shared action queue, landing alignment between ads and the crawl, the
  content calendar, the brand-kit email builder, campaign links and QR codes,
  and bounded public-web OSINT — growing the workflow tool registry from nine
  to nineteen tools (the five terminal session tools are unchanged).
- **The cross-channel report is the full 360° view.** A competitors section
  quotes the newest public-web research inside the period and compares it
  against the pass before — citation counts with stated availability, never
  market share. Sections carry charts drawn only from measured values (an
  unmeasured row is named beneath the chart, never drawn as an empty bar), and
  the client document exports as a PDF rendered locally with pdf-lib, so the
  download works on installs with no browser.
- **Scheduled reports.** Schedules carry the workflow they run end to end:
  `claimDueSchedules` now returns `workflow_id`/`options_json` (previously
  dropped on the claim path, so every schedule executed an audit), the REST
  schedule inputs accept `workflowId`/`options`, and the dashboard's
  Monitoring page can create daily, weekly, or monthly report schedules.
- **Report CLI.** `marketingovo report list|generate|show|export` brings the
  report surface to the terminal, including PDF export.
- **The demo sample set is gone.** The console home and the social research
  page no longer fall back to labelled sample numbers; a panel whose source
  has not reported now states the reason and links to the workspace that can
  change it. The social mentions and brand sentiment panels — which had no
  collector at all — were removed rather than dressed up.

## 1.1.0 — approved

Every engineering gate passes and the evidence is recorded in
`release/acceptance/1.1.0.json`, re-observed against the tree being released
rather than carried forward. Both human attestations are approved and named, so
`node scripts/validate-public-release-approval.mjs --tag v1.1.0` passes.

Approval covers the source, CLI, MCP plugin and npm-packable surfaces. It does
not cover signed native installers, the updater channel, or npm registry
publication; those remain declared deferred channels in the same record.

1.1.0 is additive. The nine-tool workflow registry, the REST surface it already
published, the SDK, the CLI, and the `.marketingovo` bundle format are
unchanged, so no existing integration breaks.

**What it adds:**

- **The agent terminal.** The dashboard is now a console, and the prompt along
  its bottom edge is a two-sided pipe between the browser and an agent harness
  the operator already runs. Marketingovo performs no inference and holds no
  model credential for it. Ten `/api/v1/agent/sessions` routes carry it: the
  browser side authenticates with the same-origin cookie and CSRF token, the
  agent side with the local service token plus the `agentId` minted at attach.
  One agent holds a session at a time, liveness is decided by a lapsing lease
  rather than a clean goodbye, and transcripts stay in memory — never SQLite,
  exports, or backups.
- **Five terminal session tools** in a registry separate from the nine workflow
  tools, so conversational access and crawl access can be allowlisted
  independently. `client.terminal` exposes the same operations to the SDK.
- **The console dashboard**, with a live boot log of real connector state, and
  the ten marketer-facing sections beside a workbench cluster for the action
  queue, issue review, pages, integrations, settings, and health.

**What preparing this release found and fixed:**

- The packaged browser journey had **not** been passing on this branch. It
  navigated through a sidebar entry the monorepo consolidation removed, so it
  failed before reaching any assertion. The acceptance evidence for 1.0.0
  predates that consolidation.
- Working it through end to end surfaced **eleven WCAG AA contrast failures**
  that predate this release — success, warning and danger badges and several
  inline states carried light-theme foregrounds scoring between 1.8:1 and
  3.2:1 on their own dark backgrounds. All now sit between 6.2:1 and 10.7:1.
- Two design tokens, `--purple-dark` and `--focus-ring`, were referenced only
  through `var()` fallbacks and never defined, so every use silently shipped a
  light-theme literal at 2.29:1. Both are now defined on the dark ramp.
- The console shell had stranded six working pages with no link into them, and
  removed the site switcher a multi-project operator needs. Both are restored,
  and a unit test now asserts the whole reachable route set.

**What preparing the repository for publication found and fixed:**

- **The AGENTintel identity was still live.** The wire package was
  `agentintel.v1`, the Python distribution `agentintel-worker`, the daemon
  binaries `agentintel` and `agentinteld`, and the same name ran through every
  schema id, artifact parser version, HTTP header, session cookie, egress user
  agent and data directory. All of it now uses the `marketingovo` namespace.
  Nothing had been published under the old names, so no consumer contract
  broke. The old identity is no longer part of the supported product surface.
- **Two generators were wrong.** `scripts/generate-contracts.mjs` wrote the
  intel daemon's OpenAPI types over `packages/sdk/src/generated/openapi.ts`,
  which the SDK generates from the product server's own document and guards
  with `generate:check`. `scripts/render-agent-config.mjs` emitted
  `AGENTINTEL_API_URL` at port 7465, while the MCP package reads
  `MARKETINGOVO_API_URL` and the product serves 3210 — the config it produced
  could never have connected.
- **`buf generate` could not run in a fresh checkout.** `protoc-gen-es` is not
  a declared dependency, and nothing imported the generated TypeScript, so that
  target was removed. Go and Python bindings still generate.
- **The secret scan had never run on this history.** CI triggers on push to
  `main` and pull requests, and the consolidation branch was never pushed.
  Gitleaks 8.30.1 over all 78 commits now reports no leaks. It first flagged the
  synthetic `sk_live_…` canary that proves bundle import rejects secret
  material; `.gitleaks.toml` records that one exception, scoped to the exact
  literal in the exact file.

**Known limits carried into 1.1.0:** the demo-flagged panels on the console
home — social mentions, brand sentiment, and the mentions trend — have no
connector behind them and say so in the interface. Backlinks states plainly
that crawling your own site cannot measure referring domains. The terminal-UI
pixel art and its OFL font are not generated yet; the console ships inline SVG
stand-ins and the platform monospace stack until they are.

## 1.0.0 — released state

Marketingovo 1.0.0 declares a stable public surface: the REST API and its OpenAPI
document, the generated SDK, the nine-tool agent contract registry, the CLI, and
the `.marketingovo` project bundle format. Breaking changes to any of these now
require a major version.

**What 1.0.0 covers:** source, CLI, MCP plugin (Claude Code, Codex, OpenClaw,
Cursor, VS Code and generic MCP), and the npm-packable packages.

**What it does not cover:** signed native installers, the Tauri updater channel,
and npm registry publication. These are declared as deferred channels in
`release/acceptance/1.0.0.json` rather than left to be inferred. A stable native
release still requires a verified upgrade from an older signed installer, and no
signing identity has been procured.

1.0.0 includes the Audit Intelligence Pack:
source-aware internal redirects, click-depth and inlink diagnostics, structural
markup and hreflang checks, exact URL cohort audits, provider-cost transparency,
an evidence-first Codex marketer workflow, and a durable Issue Review workspace
for intentional and false-positive findings. It also includes versioned Project
Context, an append-only marketer journal, secret-safe portable history, and a
read-only agent context resource.
The first public-web OSINT layer is now available as the bounded
`osint-research` workflow, dashboard `/osint` page, and agent start tool. It
keeps exact source links and missing/insufficient states visible, and repeat
passes expose cited added/removed/changed signals without treating a blocked
target as a disappearance. It does not enable people-search, authenticated
scraping, identity resolution, or dark-web collection. New passes now expose
stable claim fingerprints and a dossier-level provenance digest so report
changes are detectable without overstating source truth. The first-run setup
wizard now offers this bounded pass by default, with an explicit opt-out and a
private-target safety gate. See [the OSINT layer contract](osint-layer.md).
Audit details now include a versioned, paginated evidence workbench for crawl
paths, redirect chains, reciprocal hreflang, sitemap coverage, and bounded
custom extraction results. A corrected reciprocity model and sitemap-index
fixtures protect this UI from simply making old false positives more visible.
Any terminal run can now be replayed into an independent run from its stored
workflow and options. The operation is idempotent, exposes a versioned
configuration hash, records structural provenance, and leaves every source
result and artifact immutable.
Audits now includes a server-computed comparison workbench for any valid pair
of completed snapshots. It separates new and worsened issues from resolved and
reduced findings, exposes HTTP/indexability changes, run-specific health,
reviewed-noise exclusions, and configuration drift. Migration 10 stores
severity/title/description per issue observation so later rule changes cannot
rewrite old audit history. The same `regression-v1` result is available through
REST, OpenAPI, SDK, and CLI.
The same comparison response now embeds the separately versioned
`link-delta-v1`. It reads immutable `page_links` snapshots, exposes graph
coverage and exact added/removed/modified edges, and classifies only
evidence-backed broken-target regressions or recoveries. Ambiguous editorial
and uncrawled-target changes stay neutral and do not silently alter
`regression-v1`.
Pages now includes a server-computed internal-link explorer backed by migration
11 and `linkGraphVersion: 1` snapshots. New crawls retain bounded anchor text,
placement, follow/nofollow occurrences, requested redirect aliases, and resolved
targets. The workspace exposes exact inlink/outlink totals, redirect and broken
states, search, pagination, REST/OpenAPI/SDK/CLI parity, and explicit
unavailable states for legacy runs. Research runs can no longer replace the
latest audit page inventory.
Settings now includes project-scoped custom extraction rules with immutable
revision history, safe CSS/regex validation, exact-origin static or JavaScript
preview, explicit private-host approval, and automatic revision snapshots for
new audits and replay. The same revisions survive secret-screened project
transfer, together with the sanitized configuration snapshot behind each run.
Its versioned template catalog adds social, editorial, commerce, and migration
packs through a review-required flow: assumptions, selectors, and capture modes
are visible before fresh rules enter the unsaved draft, while duplicate labels
and capacity overflow fail closed.
The local data lifecycle also includes exact-name project deletion with active
job cancellation, orphan-safe SQLite cleanup, two-phase artifact removal, a
bounded receipt, and deliberately retained global BYOK credentials.

## Evidence recorded for 1.0.0

`release/acceptance/1.0.0.json` names every gate with the command that produced
it. All were observed passing on macOS arm64, Node 24.18.1, pnpm 10.34.5:

| Gate                                              | Command                   |
| ------------------------------------------------- | ------------------------- |
| Workspace gate across 17 workspaces               | `pnpm check`              |
| Correctness corpus and benchmark regression       | `pnpm benchmark`          |
| Dependency advisories                             | `pnpm audit:dependencies` |
| Dependency licence policy                         | `pnpm validate:licenses`  |
| Agent host surfaces against the contract registry | `pnpm validate:plugins`   |
| Instruction guardrails                            | `pnpm validate:skills`    |
| Packaged real-browser journey with axe            | `pnpm test:e2e`           |

Additional facts about this release:

- `community-synthetic-v2` detects all 26 labeled defect instances with 1.0
  recall, zero High-severity false positives, and no severity drift on either
  healthy control page. The corpus is small for the confidence it supports;
  expanding it to a larger public corpus is a post-1.0 improvement, not a
  correctness failure.
- Eight High-severity dependency advisories were cleared for this release by
  pinning patched versions of `brace-expansion`, `fast-uri`, `find-my-way`,
  `js-yaml` and `postcss`, and by taking `@fastify/static` to 10.1.2, which is
  the first release fixing a route-guard bypass via path traversal. No patched
  8.x or 9.x exists.
- The benchmark baseline is calibrated to developer hardware with recorded
  provenance, so it can fail; the shared-runner allowance is declared in
  `.github/workflows/ci.yml`.
- The acceptance policy itself changed for this release. See
  [ADR 0002](adr/0002-stable-release-acceptance.md) for which gates were retired,
  which were added, and why.

## Known limits

- The packaged browser journey passes locally on this commit. Running it in the
  canonical tag workflow is still the stronger evidence and has not happened.
- Security coverage exists for SSRF, redirect, DNS-rebinding, browser and
  OAuth-callback paths, but not yet as separately named CI jobs with documented
  case counts.
- Scheduled-work crash safety is proven for report artifacts and project
  deletion. A broader "no duplicate result under a mid-lease kill" proof
  remains a post-1.0 reliability improvement.
- Claims about replacing commercial tools still require a larger reproducible
  public corpus than the one shipped here.

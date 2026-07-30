# Release status

## 1.0.0 — released state

AGENTseo 1.0.0 declares a stable public surface: the REST API and its OpenAPI
document, the generated SDK, the nine-tool agent contract registry, the CLI, and
the `.agentseo` project bundle format. Breaking changes to any of these now
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
read-only agent context resource. See the
[reference-tool reverse-engineering record](reference-tool-reverse-engineering.md)
for provenance and deferred work.
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
  expanding it to a larger public corpus is tracked in `PLAN.md` and is a
  post-1.0 improvement, not a correctness failure.
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
  deletion. A broader "no duplicate result under a mid-lease kill" proof is
  tracked in `PLAN.md`.
- Claims about replacing commercial tools still require a larger reproducible
  public corpus than the one shipped here.

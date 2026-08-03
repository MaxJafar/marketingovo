---
title: Release status
description: What 1.1.0 contains, which gates were observed passing, and which channels are deliberately deferred.
---

# Release status

## 1.1.0

The REST API, OpenAPI document, SDK, ten-tool agent contract registry, CLI and `.marketingovo` bundle format are stable: breaking changes to them require a major version. 1.1.0 is additive on top of 1.0.0 and breaks no existing integration.

<div class="status-banner">
  <strong>Approved, with deferred channels</strong>
  <p>Every gate is recorded with the command that produced it, and both human attestations are named. Signed installers, the updater channel and npm publication are deliberately not part of this release.</p>
</div>

## Present in the current source

- local daemon bound to `127.0.0.1`;
- projects, durable runs, actions, schedules, SQLite history, and reports;
- evidence-preserving Issue Review with durable ignored and false-positive
  decisions, per-URL Action scope reduction, and transparent re-scoring;
- versioned Project Context with immutable business/SEO profiles, an
  append-only marketer journal, safe run links, and read-only MCP access;
- exact-name local project deletion with active-job cancellation, orphan-safe
  SQLite cascade, two-phase artifact cleanup, and global credential isolation;
- React dashboard with onboarding and explicit source states;
- versioned audit evidence API and dashboard workbench for crawl paths,
  redirects, hreflang, sitemap coverage, and custom extractions;
- immutable, idempotent run replay with stored configuration provenance;
- immutable audit comparison with configuration drift, issue regressions,
  resolutions, and page-level HTTP/indexability changes;
- server-computed internal-link explorer with anchor, placement,
  follow/nofollow, redirect, broken-target, search, and pagination evidence;
- audit history and Overview health trends backed by immutable run-specific
  page and metric evidence rather than synthetic zeroes;
- page inventory joined to available organic clicks, key events, open findings,
  and measured Core Web Vitals while preserving explicit unavailable states;
- immutable project extraction-rule revisions with safe selector/regex
  validation, exact-origin preview, replay-stable audit snapshots, and
  configuration-preserving project transfer;
- versioned social, editorial, commerce, and migration extraction templates
  with assumption disclosure, explicit draft review, fresh IDs, and conflict
  and capacity safeguards;
- bounded public-web OSINT dossiers with exact source links, evidence states,
  target graphs, repeat-pass change history, and explicit privacy/collection
  limits;
- CLI and typed REST SDK;
- versioned `/api/v1`, OpenAPI, asynchronous runs, SSE events, and problem details;
- ten workflow-level agent tools and read-only resources, plus a separate five-tool terminal session registry;
- Codex and OpenClaw bundles over the same local contracts;
- connector manifests for GSC, GA4, PageSpeed Insights, Trends, SerpAPI, and DataForSEO;
- BYOK credential boundary and encrypted CLI vault option;
- explicit connect, reconnect, rotate, test, and acknowledged local credential
  removal in Integrations, with provider-side revocation disclosed separately;
- authenticated same-origin HTML, PDF, CSV, and JSON actions in Reports;
- a native webview with no privileged Tauri command permissions;
- Apache-2.0 open source, one edition, no paid tier and no hosted service;
- Audit Intelligence Pack with click-depth, inlink, markup, hreflang, exact
  cohort, provider-cost, and evidence-first agent improvements;

“Present in source” is not the same as having cleared every public release corpus. Provider and operating-system readiness must still be checked against current fixtures and release artifacts.

## Known limits

- Native installer signing and target-native automatic-update evidence remain
  release gates. The desktop source now performs a bounded foreground check,
  signature-verified download/install, restart, offline fallback, and explicit
  opt-out; the canonical signed runners still have to prove that behavior on
  every supported target.
- Legacy audits, crawl SQLite data, schedules, custom rules, Google token files,
  and BYOK environment credentials now have a non-destructive, idempotent
  migration corpus. Signed operating-system upgrade evidence remains a 1.0
  gate.
- Every operating-system matrix has not completed final validation.
- Provider authorization and fixtures are not equally exercised across providers.
- The demo-flagged console panels — social mentions, brand sentiment, and the
  mentions trend — have no connector behind them and say so in the interface.
  Backlinks states plainly that crawling your own site cannot measure referring
  domains.
- Schedules require the local service to remain running. Native launchers
  support platform-specific background startup.
- The Windows MSI owns a removable HKCU login-start component for the signed
  desktop executable. macOS and Linux use the packaged CLI's launchd and
  systemd-user definitions. The release matrix installs the real DMG, MSI, and
  deb, checks background health, stop, upgrade data continuity, and uninstall
  cleanup, then runs the AppImage separately. Stable releases require an older
  published installer baseline; source policy is not presented as canonical
  signed evidence. The explicit npm CLI Windows route uses a least-privilege
  Task Scheduler task.
- npm tarballs are packed in dependency order, clean-installed in CI, and must
  match registry integrity plus provenance after OIDC publication. This path is
  implemented but is not claimed released until the canonical tag workflow
  produces its evidence.
- The exact-tag release blocks native builds on the full workspace gate, live
  npm and RustSec advisory checks, packaged Playwright journey, Gitleaks,
  CodeQL, and SBOM evidence.
- Claims of commercial-tool replacement require a reproducible public corpus.

The checked-in contract projection currently covers 20 public schemas and 38
API operations. CI rejects drift between TypeBox contracts, OpenAPI, the typed
SDK, CLI behavior, and dashboard consumers.

## Acceptance gates

Stable release acceptance requires each of the following to be observed
passing and recorded with the command that produced it:

| Gate                                              | Command                   |
| ------------------------------------------------- | ------------------------- |
| Workspace gate across every workspace             | `pnpm check`              |
| Correctness corpus and benchmark regression       | `pnpm benchmark`          |
| Dependency advisories                             | `pnpm audit:dependencies` |
| Dependency licence policy                         | `pnpm validate:licenses`  |
| Agent host surfaces against the contract registry | `pnpm validate:plugins`   |
| Instruction guardrails                            | `pnpm validate:skills`    |
| Packaged real-browser journey with axe            | `pnpm test:e2e`           |

Two further gates are human attestations rather than commands: a release-owner
approval and a licence-compliance review. Both are pending for 1.1.0.

Two requirements that earlier versions of this policy carried — an external
legal review of the Elastic License, trademarks and a CLA, and three
attributable design-partner case studies — were retired because their subjects
no longer exist. See ADR 0002 for the reasoning.

## How to verify your checkout

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm marketingovo doctor
```

Treat a failing gate as evidence, not an inconvenience to hide. Partial or unavailable source states must remain explicit in UI, API, reports, and agent summaries.

## Release claims

Use this language externally:

> Marketingovo 1.1.0 declares a stable public surface: the REST API and its OpenAPI document, the generated SDK, the agent contract registry, the CLI, and the `.marketingovo` bundle format. It covers source, CLI, MCP plugin and npm-packable surfaces. It does not cover signed native installers, the updater channel, or npm registry publication, which are declared as deferred channels rather than left to be inferred.

Do not claim production certification, universal provider availability, or full replacement of a mature proprietary dataset.

<p class="source-note">
  Canonical status: <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/release-status.md">release status</a>.
  Current scope belongs in the <a href="https://github.com/MaxJafar/marketingovo/blob/main/README.md">product README</a>.
</p>

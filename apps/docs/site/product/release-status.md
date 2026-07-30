---
title: Release status
description: Understand what the 0.11 alpha contains and which quality gates remain before public 1.0.
---

# Release status

## 0.11 alpha

The current branch is the production-foundation release. Its acceptance target is a clean local install, correct workflow execution, safe browser networking, durable SQLite history, a real dashboard, and working CLI, MCP, Codex, and OpenClaw surfaces.

<div class="status-banner">
  <strong>Use with care</strong>
  <p>Alpha builds are for design partners and contributors. They are not the public 1.0 candidate and should not be presented as fully hardened across every supported operating system.</p>
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
- CLI and typed REST SDK;
- versioned `/api/v1`, OpenAPI, asynchronous runs, SSE events, and problem details;
- six workflow-level MCP tools and read-only resources;
- Codex and OpenClaw bundles over the same local contracts;
- connector manifests for GSC, GA4, PageSpeed Insights, Trends, SerpAPI, and DataForSEO;
- BYOK credential boundary and encrypted CLI vault option;
- explicit connect, reconnect, rotate, test, and acknowledged local credential
  removal in Integrations, with provider-side revocation disclosed separately;
- authenticated same-origin HTML, PDF, CSV, and JSON actions in Reports;
- a native webview with no privileged Tauri command permissions;
- Apache-2.0 open source and separate MaxJafar product boundary;
- Audit Intelligence Pack with click-depth, inlink, markup, hreflang, exact
  cohort, provider-cost, and evidence-first agent improvements;

“Present in source” is not the same as having cleared every public release corpus. Provider and operating-system readiness must still be checked against current fixtures and release artifacts.

## Important alpha limitations

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
- Provider authorization and fixtures can have alpha-specific gaps.
- Hosted MaxJafar device-link and import calls report unavailable when no
  hosted bridge is configured; Community never simulates hosted completion.
- Community schedules require the local service to remain running. Native
  launchers support platform-specific background startup.
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
- The exact-tag release blocks native builds on the full Community gate, live
  npm and RustSec advisory checks, packaged Playwright journey, Gitleaks,
  CodeQL, and SBOM evidence.
- Claims of commercial-tool replacement require a reproducible public corpus.

The checked-in contract projection currently covers 20 public schemas and 38
API operations. CI rejects drift between TypeBox contracts, OpenAPI, the typed
SDK, CLI behavior, and dashboard consumers.

## Public 1.0 gates

The canonical release status requires, among other checks:

- no known critical or high application or dependency vulnerability;
- correct terminal and partial run states with no recursive workflows;
- passing SSRF, redirect, DNS, browser, OAuth, and secret-leak corpora;
- crash-safe scheduling without duplicated work;
- correct GSC and GA4 pagination and field fixtures;
- clean install, upgrade, package, MCP, Codex, and OpenClaw smoke tests;
- WCAG 2.2 AA dashboard behavior with a first action reachable within 15 minutes;
- at least 95% detection on a fixed correctness corpus with fewer than 5% high-severity false positives;
- no unexplained benchmark regression above 20%;
- three attributable weekly-workflow case studies approved by design partners.

## How to verify your checkout

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm agentseo doctor
```

Treat a failing gate as evidence, not an inconvenience to hide. Partial or unavailable source states must remain explicit in UI, API, reports, and agent summaries.

## Release claims

Use this language externally:

> AGENTseo 0.11 is an active alpha for design partners and contributors. The engine and product surfaces are usable, while signed cross-platform lifecycle evidence, provider matrices, external legal review, and design-partner acceptance are progressing toward the public 1.0 gates.

Do not claim production certification, universal provider availability, or full replacement of a mature proprietary dataset.

<p class="source-note">
  Canonical status: <a href="https://github.com/MaxJafar/AGENTseo/blob/main/docs/release-status.md">0.11 alpha and public 1.0 gates</a>.
  Broader direction belongs in the <a href="https://github.com/MaxJafar/AGENTseo/blob/main/README.md">product README</a> and project planning documents.
</p>

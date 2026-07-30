# Release status

## 0.11 alpha

The current branch is the production-foundation release. Its acceptance target
is a clean local install, correct workflow execution, safe browser networking,
durable SQLite history, a real dashboard, and working CLI/MCP/adapters.

Alpha builds are for design partners and contributors. Native installer signing,
automatic-update and upgrade evidence, and every supported operating-system
matrix remain release gates for the 1.0 candidate.

The current alpha includes the first license-safe Audit Intelligence Pack:
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

## Public 1.0 gates

- no known critical or high application/dependency vulnerability;
- correct succeeded/partial/failed/cancelled states and no recursive workflows;
- SSRF, redirect, DNS, browser, OAuth, and secret-leak corpora pass;
- scheduled work survives process crashes without duplication;
- GSC/GA4 pagination and current field contracts pass fixtures;
- clean install, upgrade, package, MCP, Codex, and OpenClaw smoke tests pass;
- native background-start, stop, upgrade, and uninstall tests pass on every
  supported operating system, including a signed-installer Windows startup
  implementation;
- dashboard meets WCAG 2.2 AA and first action is reachable within 15 minutes;
- fixed correctness corpus detects at least 95% of labeled issues with fewer
  than 5% high-severity false positives;
- no unexplained benchmark regression above 20%;
- three design partners approve attributable weekly-workflow case studies.

Claims about replacing commercial tools require a reproducible public corpus.

Current implementation status: the Windows MSI now owns an HKCU login-start
component that launches the signed desktop executable with only
`--background`. WiX removes that component on uninstall. The background
launcher passes validated packaged runtime paths to the daemon in memory and
never persists a password. The release matrix now has fail-closed destructive
lifecycle scripts for the DMG, MSI, deb, and AppImage. They install an older
published and cryptographically verified baseline when configured, create a
real project, stop the packaged service, upgrade, prove the same project and
release version remain healthy, uninstall, and verify process/package/service
cleanup while retaining user data. Stable tags require
`AGENTSEO_UPGRADE_BASELINE_TAG`; prereleases can only use an explicit
not-tested waiver. The separate npm CLI
uses a least-privilege per-user Task Scheduler task when the user explicitly
runs `agentseo service install`.

The npm release path now version-locks all JavaScript and native surfaces,
packs 13 public packages in dependency order, rejects unresolved `workspace:`
protocols, performs a clean tarball install in CI, and publishes only after the
native matrix passes. Publication requires GitHub Actions OIDC, matching
registry integrity, and npm provenance attestations. No package or signed
native artifact is claimed as released until those gates run successfully on
the canonical tag workflow.

The exact-tag workflow now adds a blocking source-evidence job before any native
build. It reruns the complete Community gate, live npm advisory audit, real
packaged-browser journey, RustSec audits for both native lockfiles, Gitleaks,
CodeQL, and SBOM generation. These controls are fail-closed policy until the
canonical tag workflow produces its evidence; their presence in source is not
reported as a completed public release.

## Locally verified on 2026-07-16

- `pnpm check` exits successfully across all 17 workspaces, including build,
  strict types, unit/integration tests, release and npm policy tests, contract
  and plugin parity, license validation, benchmark, and 13-package tarball
  inspection;
- the SDK exposes a complete OpenAPI-generated typed client and fails its build
  when the checked-in path/parameter/request/response projection drifts from
  the server document; the ergonomic client retains the same strict loopback
  token boundary;
- audit comparison now validates 18 public schemas and 36 API operations,
  rejects invalid run pairs with typed Problem Details, preserves per-run issue
  snapshots across later severity changes, and renders configuration-aware
  regressions, fixes, page changes, and unavailable data without client-side
  recomputation;
- the internal-link explorer extends that boundary to 19 public schemas and 37
  API operations; storage/runtime/API/UI tests cover aliases, broken and
  uncrawled targets, pagination, search, non-audit history isolation, and
  portable graph reconstruction;
- `link-delta-v1` reuses that immutable graph inside audit comparison without
  adding another API operation; storage/runtime/API/UI tests cover full and
  unavailable coverage, exact edge identities, added/removed/modified edges,
  broken-target regression and recovery, bounded output, and neutral
  editorial or uncrawled states;
- the review-first extraction template catalog extends the current boundary to
  20 public schemas and 38 API operations; runtime validation, clone isolation,
  REST/OpenAPI/SDK/CLI parity, draft-only import, label conflicts, and the
  50-rule boundary have dedicated coverage;
- Issue Review now preserves project-scoped adjudications across audits and
  `.agentseo` transfers, narrows grouped Action scope and recalculates priority
  per reviewed URL, hides fully reviewed groups without deleting evidence,
  rejects secret-like reasons, and exposes only read access to MCP agents;
- Project Context now preserves normalized business/SEO profiles as immutable
  revisions and human observations, decisions, constraints, and experiments as
  an append-only journal; cross-project run links, secret-like text, and local
  paths are rejected, while `.agentseo` import remaps the complete history;
- MCP and OpenClaw now derive all six tool names, descriptions, input schemas,
  limits and safety annotations from one `@agentseoapp/contracts` registry;
  contract and bundled-plugin tests reject schema or manifest drift;
- the previously recorded packaged Playwright journey completes onboarding, a real crawl, audit
  history, immutable configuration replay, audit-to-audit regression and fix
  comparison, action workflow persistence, partial
  and complete Issue Review, Project Context revision and journal persistence,
  review-first template inspection and draft import, custom-extraction preview,
  immutable rule save, a second crawl with captured extraction evidence, a
  page-level inlink/outlink investigation with anchor and redirect evidence,
  run-configuration export/import, system diagnostics,
  mobile navigation, exact-name deletion of the imported project, survival of
  the original project, and axe-based accessibility checks against the real
  local daemon. The exact current tree still requires a fresh canonical browser
  record after the latest history and page-inventory assertions; component,
  API, and contract coverage does not substitute for that evidence;
- project-deletion storage/runtime/API tests prove exact confirmation, complete
  project-graph cascade, shared-fingerprint preservation, global-credential
  isolation, deterministic file cleanup, crash-before-commit restoration,
  fail-closed unknown staging, structural receipts, and typed Problem Details;
- the live npm advisory query checks 604 package names with no known High or
  Critical finding, the Community license gate accepts all 573 installed
  package/version pairs, and CycloneDX 1.6 SBOM generation records 698
  components;
- the credential broker passes Rust formatting and `clippy -D warnings`; the
  Tauri launcher passes locked native compilation, formatting,
  `clippy -D warnings`, and all eight Rust policy tests on macOS arm64;
- the native release policy uses the product-scoped `agentseo-node` sidecar,
  validates older-release selection and signatures, and rejects stable records
  without install, background start, single-instance activation, stop,
  data-preserving upgrade, uninstall, and AppImage evidence as applicable;
- the desktop launcher now performs the previously missing foreground update
  lifecycle before its single owned daemon starts, downloads and installs only
  through Tauri's signature-verifying Rust API, restarts after a successful
  install, fails open to the installed version when the release endpoint is
  unavailable, and routes repeated launches through a single-instance
  activation instead of creating a competing updater/runtime owner;
- the updater channel is no longer an unimplemented external endpoint. Every
  native runner exports target-prefixed, hash-verified updater inputs; a final
  fail-closed job requires all four targets and one public key, rechecks the
  transferred bytes, creates the canonical Tauri `latest.json`, attests it, and
  attaches it before the draft release can become public. GitHub `latest`
  intentionally serves stable releases only; prerelease distribution remains a
  manual design-partner flow;
- the native webview now has an empty Tauri capability set: sidecar, updater,
  and window lifecycle authority stays in Rust, while the dashboard reaches
  product operations only through the authenticated loopback API;
- Integrations now exposes clear connect, reconnect, rotate, test, and
  acknowledged local-removal states. Server coverage proves the vault secret is
  deleted globally while non-secret per-project mapping survives, and the UI
  explicitly distinguishes local deletion from provider-side revocation;
- Reports exposes authenticated same-origin HTML, PDF, CSV, and JSON downloads.
  Dashboard URL-safety coverage rejects foreign origins, and server end-to-end
  coverage verifies each media type, attachment name, non-empty artifact, and
  secret-redaction boundary;
- Audits history now reads per-run page counts and SEO Health directly from
  immutable page rows and run-scoped metrics. The list and detail APIs expose
  the same values, while absent health remains unavailable instead of becoming
  a synthetic zero;
- Overview now persists the first health delta as explicitly unavailable,
  calculates later changes against the prior completed audit, and renders up to
  30 dated run-specific health observations. It no longer ships a permanently
  empty trend or labels health-score points as a percentage;
- Pages now joins the latest completed audit to run-scoped performance and
  issue evidence. It exposes real organic clicks and key events when available,
  counts only open findings per canonical URL, derives pass/needs-improvement/
  fail from measured LCP, CLS, and TTFB, and keeps missing measurements nullable
  instead of inventing zeroes. The report index now lists audit workflows only;
- the monorepo test gate bounds both Turbo package concurrency and Vitest worker
  pools. A clean uncached run completes all 34 tasks without starving encrypted
  vault, SQLite, browser fixture, OAuth callback, or user-event suites;
- `community-synthetic-v2` detects all 26 labeled defect instances with 1.0
  recall, zero High-severity false positives, no severity drift, and no High
  finding on either healthy control page;
- the non-destructive legacy migration test imports audits, crawl pages/issues,
  schedules, custom rules, Google token files and BYOK environment credentials,
  preserves every source byte and mode, keeps secrets out of SQLite/receipts,
  and proves the second import is a no-op;
- the consolidated secret canary proves active credentials cannot cross into
  DB/WAL/SHM, events, modules, pages, issues, actions, integration metadata,
  logs, reports, project bundles, or backups.

## Evidence still required before public 1.0

- the exact current commit must complete the packaged Playwright and axe journey
  in the canonical source-evidence job; the latest local browser rerun was not
  available after the history and page-inventory assertions changed;
- the canonical tag workflow must produce signed/notarized installers, updater
  signatures, `latest.json`, checksums, attestations and native lifecycle
  evidence on every supported target from the canonical
  `GolemWorkers/agentseo` repository;
- the newly enforced DMG/MSI/deb/AppImage lifecycle jobs must run successfully
  on canonical signed artifacts; the local source tests do not substitute for
  that target-native evidence, and a published prerelease must be selected as
  the stable upgrade baseline;
- npm publication, registry integrity and provenance must be observed against
  the real public registry;
- qualified legal review of ELv2, trademarks and CLA plus three attributable
  design-partner weekly-workflow approvals remain mandatory stable-release
  inputs.

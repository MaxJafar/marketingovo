# Golem SEO Community — Session Handoff

Date: 2026-07-16  
Workspace: `/Users/maxjafarov/Desktop/golem/golem-seo-main`  
Current version: `0.11.0-alpha.0`  
Target: a public, production-grade Community `1.0.0` release

## Purpose of this document

This is the authoritative handoff for continuing the work in a new Codex
session. It records the product decisions, implementation state, verification
evidence, unresolved release conditions, and the latest zero-cost release
decision. Inspect the current worktree before relying on this record because the
directory is not yet a standalone Git repository and all files currently appear
as one untracked directory from the parent repository.

## Current user directive

Work only on **Golem SEO Community Edition**. Do not continue private
GolemWorkers Full Edition work.

The active objective remains:

> Bring the current `0.11` alpha to a public-release-ready `1.0`.

The newest release constraint supersedes the earlier native-release plan:

> The Community `1.0` release must have zero monetary cost. Source and npm are
> the primary distribution paths. Paid signing, notarization, hosting, domains,
> API credits, advertising, trademark registration, and paid legal review must
> not be required to ship Community `1.0`.

This zero-cost decision has only been discussed. The release workflow and policy
code still enforce signed native artifacts and qualified legal approval for a
stable release. The next session must reconcile those policies instead of
pretending the new boundary has already been implemented.

## Product positioning

Canonical positioning:

> A local-first SEO operations system that turns crawl, Search Console, GA4,
> performance, and SERP data into verified actions.

Primary audience:

- hands-on SEO and growth specialists;
- consultants managing approximately 1–10 sites;
- small agencies as the secondary audience.

Product, UI, code comments intended for users, and public documentation are
English-only.

Community principles:

- local-first and single-user;
- no product account requirement;
- unlimited projects and audits within local machine resources;
- telemetry disabled by default;
- BYOK integrations;
- missing evidence remains unavailable rather than becoming a fake zero;
- analysis is not intentionally crippled to force a hosted upgrade;
- no Docker installation, deployment, documentation, or CI path;
- described as **source-available**, never as OSI open source.

## Legal and brand decisions

The repository currently contains:

- `LICENSE` — Elastic License 2.0;
- `TRADEMARKS.md` — Golem SEO and GolemWorkers brand restrictions;
- `CLA.md` — contributor rights for Community and possible commercial use;
- `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, and
  `CODE_OF_CONDUCT.md`.

Important legal limitation: ELv2 permits use, modification, derivative works,
and redistribution. It does not prohibit forks. It prohibits offering a
competing managed service, removing or obscuring notices, and bypassing
license-key-protected functionality. Trademark policy is the mechanism that
prevents forks from presenting themselves as official Golem SEO.

Do not invent a custom license without qualified review. For the zero-cost
release, keep the unmodified ELv2 text, retain notices, keep the trademark
policy, document that no paid legal opinion is claimed, and look for pro-bono
review after publication if desired.

## Repository architecture

The Community code is a pnpm 10/Corepack, Node 24, TypeScript strict-ESM
monorepo with Turborepo and one lockfile.

Main surfaces:

```text
apps/dashboard             React 19 + Vite localhost dashboard
apps/desktop               Tauri 2 shell (no longer a zero-cost 1.0 blocker)
apps/docs                  VitePress documentation
packages/contracts         TypeBox/JSON Schema source of truth
packages/core              crawler, checks, rule engine
packages/application       workflows, executor, priority scoring
packages/storage-sqlite    SQLite WAL storage and durable jobs
packages/integrations      provider connectors and OAuth
packages/credentials       local vault abstraction
packages/server            Fastify loopback API and OpenAPI
packages/sdk               generated and ergonomic API clients
packages/cli               localhost server and operator commands
packages/mcp               MCP bridge and resources
packages/runtime           Community application services
adapters/openclaw          OpenClaw adapter
plugins/codex/golem-seo    Codex plugin and marketer skill
benchmarks                 reproducible correctness/performance corpus
examples/demo-site         synthetic public demonstration site
launch                     English LinkedIn, X, demo, and case-study assets
```

The local API binds to `127.0.0.1:3210`, uses a short-lived bootstrap ticket and
an HttpOnly SameSite session for the dashboard, keeps CORS disabled, returns
Problem Details errors, uses SSE for progress, and requires idempotency keys for
agent-started jobs.

## Community capabilities already implemented

The following are implemented, not roadmap-only placeholders:

- separate workflow and leaf-module registries with no recursive scheduling;
- runtime input/output validation and bounded DAG execution;
- accurate queued, running, succeeded, partial, failed, and cancelled states;
- static and JavaScript crawling;
- technical, on-page, content, link, redirect, sitemap, hreflang, structured
  data, image, performance, Lighthouse, PSI, and Core Web Vitals checks;
- GSC, GA4, Trends, SerpAPI, and DataForSEO BYOK connectors;
- current GA4 `keyEvents` semantics and paginated GSC/GA4 fixtures;
- redirect-aware SSRF policy for static and browser traffic;
- private-network and cloud-metadata blocking on every DNS resolution and
  redirect;
- scoped cookies, authorization, and custom headers;
- native credential broker plus encrypted headless fallback;
- SQLite WAL, foreign keys, transactions, durable leased jobs, scheduler,
  retries, cancellation, dead-letter state, artifacts, backup, and restore;
- non-destructive legacy import;
- real localhost dashboard with onboarding, overview, actions, issue review,
  audits, pages, keywords/content, competitors, monitoring, reports,
  integrations, settings, and system health;
- transparent `priority-v1` scoring;
- Action evidence, checkpoints, ownership, status, and verification workflow;
- versioned Project Context and append-only marketer journal;
- immutable issue adjudication across later audits;
- exact URL cohort audits;
- immutable run replay and configuration hashes;
- server-computed audit comparison;
- immutable internal-link explorer;
- custom extraction rules, revisions, safe preview, and review-first templates;
- HTML, PDF, CSV, and JSON report downloads;
- secret-screened `.golemseo` export/import;
- REST, OpenAPI, generated SDK, CLI, MCP, Codex, and OpenClaw parity;
- exact six-tool public agent surface;
- launch kit, synthetic demo site, public benchmark, architecture, privacy, and
  threat-model documentation.

## Reverse engineering completed in this session chain

The clean-room analysis covers:

- `every-app/open-seo`;
- `stjudewashere/seonaut`;
- `AgricIDaniel/claude-seo`;
- `siteinspector/siteinspector`;
- `beb7/gflare-tk`;
- `nazuke/SEOMacroscope`.

The canonical record is
[`docs/reference-tool-reverse-engineering.md`](reference-tool-reverse-engineering.md).

No AGPL/GPL implementation code, tests, text, or assets were copied. Those
projects were used only to understand observable workflows. Adopted mechanics
were independently implemented against Golem SEO contracts.

Implemented clean-room takeaways include:

- provider cost transparency;
- source-aware redirect and link diagnostics;
- exact-cohort audits;
- evidence-first agent reasoning;
- durable issue review;
- Project Context and marketer journal;
- immutable evidence workbench and replay;
- audit comparison;
- page-level internal-link exploration;
- versioned custom extraction workspace and templates.

## Latest implementation: `link-delta-v1`

The last Community-owned gap in the reverse-engineering queue was an immutable
internal-link graph delta inside audit comparison. It is now implemented across
the full vertical slice.

Behavior:

- compares exact source URL plus literal target URL edge identities;
- reports baseline/current graph-page coverage and edge counts;
- separates added, removed, and modified edges;
- names target resolution, target indexability, follow policy, occurrences,
  anchor text, and placement changes;
- classifies creation of a captured broken target as a regression;
- classifies removal of a captured broken target as a recovery;
- classifies direct/redirected/broken quality transitions directionally;
- keeps editorial additions/removals and uncrawled targets neutral;
- exposes partial and unavailable legacy coverage;
- bounds detailed output to 200 changes;
- does not silently alter the independent `regression-v1` score before
  design-partner validation.

Important files:

- `packages/contracts/src/index.ts`;
- `packages/storage-sqlite/src/database.ts`;
- `packages/storage-sqlite/src/link-graph.test.ts`;
- `packages/runtime/src/audit-comparison.ts`;
- `packages/runtime/src/audit-comparison.test.ts`;
- `packages/runtime/src/index.ts`;
- `packages/server/src/run-comparison-api.test.ts`;
- `packages/sdk/src/generated/openapi.ts`;
- `apps/dashboard/src/api/contracts.ts`;
- `apps/dashboard/src/components/audit-comparison-card.tsx`;
- `apps/dashboard/src/tests/audit-comparison-card.test.tsx`;
- `apps/dashboard/src/styles.css`.

Documentation was updated in `README.md`, `docs/architecture.md`,
`docs/release-status.md`, `docs/reference-tool-reverse-engineering.md`, and the
VitePress reference-tool page.

## Current verification evidence

The exact current Community tree completed the full gate with `exit_code: 0`:

```bash
pnpm check
```

The command covers:

- Prettier formatting;
- explicit no-container validation;
- build, lint, and strict typecheck across all 17 workspaces;
- unit and integration tests;
- real loopback crawler, OAuth, JavaScript renderer, and Web Vitals fixtures;
- release and npm policy tests;
- correctness and performance benchmark;
- TypeBox/OpenAPI contract validation;
- Codex/OpenClaw manifest and six-tool parity;
- dependency license allowlist;
- 13 publishable npm tarball smoke packs.

Observed final summaries:

- 20 public schemas;
- 38 API operations;
- benchmark correctness passed with 1.0 recall;
- zero High-severity false positives in the labeled corpus;
- benchmark performance gate passed;
- 573 installed dependency licenses accepted;
- 13 publishable artifacts packed and inspected.

The first non-escalated test attempt failed only because the sandbox denied
loopback listener creation. The exact same tree passed when loopback-only
fixture servers were permitted. This was an execution-environment restriction,
not a product defect.

The packaged dashboard Playwright/axe journey has not been freshly recorded for
the exact latest tree. Existing component, API, and crawler-browser tests do not
substitute for that end-to-end evidence. Run `pnpm test:e2e` in the new session
if browser automation is available; do not claim it passed until there is a new
record.

## Current Git and publication state

Authoritative observations at handoff:

```text
Parent repository: /Users/maxjafarov/Desktop/golem
Parent branch: main
Parent remote: https://github.com/MaxJafar/golem.git
Community status from parent: ?? golem-seo-main/
```

`golem-seo-main` is not currently a standalone Git repository. No files were
staged, committed, pushed, tagged, or published in this session.

External authentication state:

- `gh auth status`: the `MaxJafar` account is selected, but its token is invalid;
- `npm whoami`: `ENEEDAUTH`;
- no Apple, Windows, Tauri updater, or npm signing/publishing secrets are
  present;
- no valid local code-signing identity is installed;
- `release/acceptance/1.0.0.json` does not exist.

Do not initialize, transfer, commit, push, publish, or create releases without
the user's explicit authorization and valid account authentication.

## Revised zero-cost release architecture

The primary Community `1.0` distribution should become:

```text
Public GitHub source
        +
Public npm packages with trusted OIDC publication
        +
npx @golem-seo/cli serve
        +
Full authenticated localhost dashboard
        +
CLI / REST / OpenAPI / MCP / Codex / OpenClaw
        +
GitHub Pages documentation
```

Zero-cost infrastructure choices:

- public GitHub repository;
- standard GitHub-hosted runners for the public repository;
- short artifact retention and no paid larger runners;
- public npm registry;
- GitHub OIDC trusted publishing instead of a long-lived npm token;
- GitHub Releases for source archives, checksums, SBOM, and provenance;
- GitHub Pages instead of a paid domain or hosting service;
- GitHub Discussions and Issues for support;
- synthetic demo data and free provider paths;
- user-supplied BYOK credentials for paid providers;
- organic GitHub, LinkedIn, and X distribution;
- no paid telemetry or advertising.

Native desktop handling under the new plan:

- retain Tauri source and build validation;
- do not make Apple notarization or paid Windows signing a Community `1.0`
  release gate;
- label unsigned or locally built desktop artifacts as experimental;
- prefer not to publish scary unsigned installers to nontechnical marketers;
- move signed native installers to a future sponsor-funded or revenue-funded
  milestone;
- never claim an unsigned binary is trusted or notarized.

## Required next implementation tranche

The next session should make the zero-cost decision real in code and policy.

### 1. Rewrite stable release policy

Inspect and update:

- `.github/workflows/release.yml`;
- `scripts/release-policy.mjs` and its tests;
- `scripts/public-release-policy.mjs` and its tests;
- `scripts/validate-release-environment.mjs`;
- `scripts/verify-release-artifacts.mjs`;
- `scripts/npm-release-policy.mjs` and its tests;
- `docs/desktop-release.md`;
- `docs/npm-release.md`;
- `docs/release-status.md`;
- `release/acceptance/README.md`;
- launch claims that currently imply signed native installers are required.

Desired stable source/npm gate:

- exact canonical tag and version parity;
- clean full Community gate;
- packaged localhost browser journey;
- live dependency audit, CodeQL, Gitleaks, SBOM, license scan;
- deterministic 13-package pack/install smoke test;
- npm trusted publication with provenance and registry integrity evidence;
- GitHub release source archive, checksums, SBOM, and attestations;
- no Docker artifacts or documentation;
- no required Apple/Windows signing values;
- no required native lifecycle matrix for source/npm `1.0`;
- desktop status explicitly experimental unless separately signed.

Do not simply delete native policy tests. Separate `community-source-release`
from optional `native-release` evidence so the project retains a credible future
desktop path.

### 2. Reconcile acceptance without fabricated evidence

Keep real design-partner validation because it costs no money and proves
marketer value. Do not fabricate partner names, improvements, quotes, legal
review, or approval timestamps.

Recommended zero-cost stable acceptance:

- explicit release-owner approval;
- three unique design partners completing real weekly workflows;
- at least one verified improvement per partner;
- attributable case-study permission;
- owner confirmation that ELv2, trademark, CLA, and notices are the exact
  published standard documents;
- clear statement that no paid legal opinion is being claimed;
- optional pro-bono legal review when available.

### 3. Make the public repository real

User-controlled prerequisites:

- reauthenticate `gh`;
- create or approve the `GolemWorkers` organization and repository name;
- decide whether to preserve history from an existing private canonical repo or
  initialize this directory as the new public history;
- make `golem-seo-main` a standalone repository;
- configure protected `public-release` and `npm-production` environments;
- enable GitHub Discussions, Pages, CodeQL, Dependabot, and branch protection.

### 4. Configure free npm publication

- create or approve the `@golem-seo` npm organization/scope;
- authenticate once as the owner;
- configure npm trusted publishing from the canonical GitHub workflow;
- publish a prerelease first;
- verify every registry integrity and provenance record before changing the
  stable dist-tag;
- retain the current version until the actual release decision.

### 5. Fresh end-to-end proof

- run the packaged localhost Playwright/axe journey on the exact candidate;
- verify onboarding to first prioritized action within 15 minutes;
- verify integrations remain write-only for secrets;
- verify audit, replay, comparison, `link-delta-v1`, issue review, project
  context, custom extraction, reports, export/import, and deletion;
- archive the evidence in the canonical GitHub workflow.

### 6. Design-partner alpha before `1.0.0`

- publish `0.11.0-alpha.*` or an RC through source/npm only;
- personally onboard 10–20 SEO marketers;
- collect three attributable weekly-workflow case studies;
- validate `priority-v1` and `link-delta-v1` language;
- resolve installation and first-action friction;
- only then create the real `1.0.0` acceptance record and tag.

## Promotion plan with zero spend

Do not lead with a feature inventory. Lead with the verification loop:

```text
Add site → audit → Top Actions → inspect evidence
→ make a fix → repeat audit → verify improvement
```

Recommended sequence:

1. Soft-launch the public alpha to design partners.
2. Personally onboard the first 10–20 SEO practitioners.
3. Record a 60–90 second real or clearly labeled synthetic demonstration.
4. Publish the GitHub repository and release notes.
5. Publish the founder LinkedIn post and carousel from `launch/`.
6. Publish the X thread and engineering deep dive.
7. Publish the reproducible benchmark and explain its limits.
8. Publish three attributable case studies.
9. Continue weekly build-in-public updates.

Primary calls to action:

- install Community;
- star the repository;
- run the first audit;
- report one verified SEO improvement;
- contribute a rule, connector, fixture, or reproducible issue.

Do not buy ads. Do not claim to replace Ahrefs, Semrush, or Screaming Frog
without reproducible evidence. Do not claim `1.0` before the real release gate
and partner evidence pass.

## Useful commands

Run from `/Users/maxjafarov/Desktop/golem/golem-seo-main`:

```bash
corepack enable
pnpm install
pnpm build
pnpm check
pnpm validate:no-containers
pnpm validate:contracts
pnpm validate:plugins
pnpm benchmark
pnpm pack:smoke
pnpm test:e2e
pnpm golem-seo serve
```

The test suite needs permission to bind loopback-only fixture servers. A
sandbox that denies `127.0.0.1` listeners will cause OAuth, renderer, and Web
Vitals fixtures to fail or time out even when the product code is correct.

## Non-negotiable integrity rules

- Community-only scope unless the user explicitly changes it.
- No Docker anywhere in product, docs, CI examples, or release architecture.
- English-only public product and documentation.
- Source-available terminology, not open source.
- Never serialize secrets into API responses, SQLite, logs, reports, bundles,
  backups, crash dumps, or telemetry.
- Missing provider data remains unavailable, not zero.
- No recursive workflows or workflow-as-module scheduling.
- No dormant proprietary Full Edition code in Community.
- No fake design partners, legal approvals, signing evidence, publication
  evidence, customer quotes, or benchmark claims.
- Do not bump to `1.0.0` merely because local tests pass.
- Do not mark the release complete until the exact source/npm candidate,
  packaged localhost journey, registry provenance, public repository state, and
  real design-partner acceptance are all verified.

# AGENTseo — Road to 1.0.0

Plan date: 2026-07-30. Audited tree: branch `agent/ZIL-198-distribution-surfaces`
at `522d80a`, workspace version `0.11.0-alpha.0`.

This document is the sprint plan from the current alpha to a public `1.0.0`
release as an installable agent plugin with a first-class GUI dashboard. It
supersedes nothing in [`docs/release-status.md`](docs/release-status.md) — that
file remains the release-truth record; this file is the sequencing plan on top of
it.

---

## 1. Audit summary

### What is genuinely built

| Area             | State                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code volume      | ~99,000 tracked LOC across 13 packages + 3 apps                                                                                                                              |
| Core engine      | `packages/core` 30.7k LOC — crawl, audit rules, link graph, extraction                                                                                                       |
| Runtime / server | `packages/runtime` 12.5k + `packages/server` 8.8k LOC                                                                                                                        |
| Storage          | `packages/storage-sqlite` 6.5k LOC, migrations through #11, immutable per-run snapshots                                                                                      |
| SDK              | `packages/sdk` 12.1k LOC, OpenAPI-generated, build fails on projection drift                                                                                                 |
| GUI dashboard    | `apps/dashboard` — 18 routed pages, 6,165 LOC of page code, 25 test files including axe accessibility suites                                                                 |
| Agent surface    | 6 MCP tools derived from one `@agentseoapp/contracts` registry; MCP stdio + HTTP, Codex bundle, OpenClaw adapter                                                             |
| CLI              | `packages/cli` 2.6k LOC                                                                                                                                                      |
| CI               | `ci.yml` (full `pnpm check`, dependency advisories, license policy, SBOM, Rust broker matrix, real-browser E2E), `codeql.yml`, `release.yml`, dependabot, issue/PR templates |
| Docs             | 10 docs + a VitePress site under `apps/docs`                                                                                                                                 |
| Legal/governance | LICENSE, NOTICE, CLA, CODE_OF_CONDUCT, GOVERNANCE, SUPPORT, TRADEMARKS, COMMERCIAL, SECURITY, PRIVACY all present                                                            |

This is a real product, not a scaffold. The functionality claim holds: the audit
engine, comparison (`regression-v1`), link delta (`link-delta-v1`), internal-link
explorer, extraction rules, Issue Review, Project Context, and reports are
implemented with storage/runtime/API/UI coverage at each layer. The 1.0 problem is
**identity, distribution, and evidence** — not missing features.

### Release blockers found

**B1 — "Open source" is not accurate today.** `LICENSE` is Elastic License 2.0.
ELv2 is source-available, not OSI-approved; `README.md` already says so. Most
plugin marketplaces, distro packagers, and OSI-license-gated corporate policies
will reject it, and publishing it as "open source" invites a credibility hit.
This is a decision, not a bug — see Sprint 1.

**B2 — Rebrand is ~70% done.** 228 tracked files still contain `golem`.
296 occurrences of `@golem-seo/`, `golem-seo-node`, `GOLEMSEO_*`, or `.golemseo`.
Concretely still un-migrated: the `.golemseo` portable-bundle extension, the
`golem-seo-node` sidecar name, `GOLEMSEO_UPGRADE_BASELINE_TAG` and
`GOLEMSEO_NPM_INSTALL_SMOKE` env vars, the CI SBOM artifact path
`artifacts/golem-seo.cdx.json`, and the `golem-seo service install` CLI verb
documented in `docs/release-status.md`. Package names are clean
(`@agentseoapp/*`, `agentseo`); the runtime/storage/scripts layer is not.

**B3 — Repository identity is split.** `origin` is
`https://github.com/MaxJafar/AGENTseo.git`, but `docs/release-status.md` gates the
release on "the canonical `GolemWorkers/golem-seo` repository", and
`release.yml`/npm provenance depend on that canonical identity. One of the two has
to move.

**B4 — Zero tags, and `main` is 9 commits behind HEAD.** 11 local branches
including 4 `ao/*` roots and two near-duplicate `ZIL-197-dashboard-rebrand`
branches. No release has ever been cut.

**B5 — Agent-plugin coverage is Codex-only.** `plugins/codex/agentseo` plus a
stale `plugins/codex/golem-seo` duplicate. There is no `.claude-plugin/plugin.json`,
no plugin `marketplace.json`, and one skill (`skills/seo-marketer/SKILL.md`). For a
release framed as an _agent plugin_, this is the thinnest part of an otherwise
thick product.

**B6 — npm publication is deliberately disabled.** `npm:prepare-release`,
`npm:publish-release`, and `prepublishOnly` all route to
`scripts/npm-publication-disabled.mjs`. Intentional today, must be reversed under
policy for 1.0.

**B7 — Stale packaged evidence.** `docs/release-status.md` states the packaged
Playwright + axe journey needs a fresh canonical record after the history and
page-inventory assertions changed. No signed installers, updater `latest.json`,
or native lifecycle evidence has ever been produced on a canonical tag.

**B8 — Local toolchain cannot verify this repo.** Installed Node is v26.5.0;
`engines` requires `>=24 <25` with `engine-strict=true` in `.npmrc`. `pnpm` and
`cargo` are absent. `pnpm check` cannot run on this machine as configured.

### Lower-severity findings

- Empty tracked directories `scratch/` and `codex-tasks/`.
- `.DS_Store` files exist on disk but are correctly untracked.
- `docs/session-handoff-2026-07-16.md` is working state, not product docs.
- `packages/credential-broker-native` and the Tauri shell are verified only on
  macOS arm64 locally; CI covers `cargo check`, not the full native matrix.

---

## 2. Assumptions

Stated explicitly because they change the plan materially:

1. **Sprint length is 2 weeks.** Five sprints ≈ 10 weeks to `1.0.0`.
2. **1.0.0 scope is the Community edition only.** Hosted/GolemWorkers Full stays
   out; the editions table in `docs/editions.md` is the boundary.
3. **The license question gets answered in Sprint 1.** Everything downstream —
   marketplace submission, npm publish, README framing — depends on it.
4. Three design partners can be recruited in parallel starting Sprint 1; their
   sign-off is a Sprint 5 gate and is the item most likely to slip for reasons
   outside engineering control.

---

## 3. Sprint plan

### Sprint 1 — Identity, licensing, and repository consolidation

**Goal:** one name, one license, one canonical repo, one branch, one tag.

Scope:

1. **Resolve the license.** Pick one and make the whole tree consistent:
   - _Option A (true open source):_ relicense to Apache-2.0. Requires
     contributor sign-off (only two authors so far, so this is cheap now and
     expensive later), rewriting `LICENSE`, `NOTICE`, all 20 `package.json`
     `license` fields, both `plugin.json` files, `COMMERCIAL.md`, `CLA.md`, and
     the README's "not OSI-approved" paragraph. Unblocks marketplaces and npm
     ecosystem trust.
   - _Option B (keep ELv2):_ stop calling it open source anywhere. Change README,
     docs site, and plugin metadata to "source-available". Accept marketplace
     rejection risk.
   - Recommendation: **Option A for the plugin, adapters, contracts, SDK, and
     CLI; ELv2 retained for `packages/core`/`server` if commercial protection
     matters.** A split license is more work but is the only way to be both
     honestly open source at the plugin surface and commercially defensible at
     the engine. Decide in week 1; do not carry this into Sprint 2.
2. **Finish the rebrand (B2).** Extend `scripts/identity-migration-policy.mjs`
   to fail on _any_ `golem` token outside `packages/legacy-import` and
   `migrations/legacy-v0`. Then migrate, with a compatibility shim in each case:
   - `.golemseo` → `.agentseo` bundle extension, with import-time acceptance of
     the old extension (do not break existing user bundles).
   - `GOLEMSEO_*` → `AGENTSEO_*` env vars, old names honored with a deprecation
     warning for one minor cycle.
   - `golem-seo-node` sidecar → `agentseo-node`; update the Tauri sidecar
     manifest and `scripts/prepare-desktop-runtime.mjs`.
   - `golem-seo service install` → `agentseo service install`, old verb aliased.
   - `artifacts/golem-seo.cdx.json` → `artifacts/agentseo.cdx.json` in
     `scripts/generate-sbom.mjs` and `ci.yml`.
   - Delete `plugins/codex/golem-seo` and `@agentseoapp/codex-plugin-legacy`.
3. **Repository consolidation (B3, B4).** Decide canonical remote. Update
   `release.yml`, `docs/release-status.md`, `plugin.json` `repository` fields, and
   npm provenance config to match. Merge
   `agent/ZIL-198-distribution-surfaces` → `main`. Delete the 4 `ao/*` roots and
   the duplicate `ZIL-197-*` branches. Set branch protection: CI required, no
   direct pushes.
4. **Make the repo verifiable by a new contributor (B8).** Add `.nvmrc`
   alongside `.node-version`, a `CONTRIBUTING.md` toolchain section naming exact
   Node/pnpm/Rust versions, and a `scripts/doctor.mjs` that reports what is
   missing rather than failing with `command not found`.
5. Delete `scratch/` and `codex-tasks/`. Move
   `docs/session-handoff-2026-07-16.md` out of `docs/`.
6. Cut `v0.12.0-alpha.0` — the first tag this project has ever had — to prove the
   tag workflow triggers at all, even if every artifact job fails.

**Exit criteria**

- `pnpm identity:check` fails on any residual `golem` token; the tree passes it.
- `git grep -il golem` returns only legacy-import and legacy-migration paths.
- One license decision recorded in an ADR under `docs/adr/`.
- `main` is the only long-lived branch, protected, and equals the audited work.
- A tag exists and `release.yml` was observed to start.
- A clean checkout on a fresh machine reaches `pnpm check` following
  CONTRIBUTING alone.

---

### Sprint 2 — The agent plugin surface

**Goal:** AGENTseo installs as a real plugin in every agent host that matters,
from one contract source.

Scope:

1. **Claude Code plugin (B5).** Add `.claude-plugin/plugin.json` and a
   `marketplace.json`, generated from `@agentseoapp/contracts` — never
   hand-maintained. Bundle the MCP server, skills, and a `commands/` set
   (`/seo-audit`, `/seo-compare`, `/seo-plan`, `/seo-actions`).
2. **Skills depth.** One `seo-marketer` skill is not a product surface. Author
   discrete skills per workflow — `seo-audit`, `seo-regression-review`,
   `seo-keyword-research`, `seo-content-plan`, `seo-issue-triage` — each with the
   evidence-citation discipline the existing skill already establishes. Every
   skill gets an eval fixture asserting it cites run IDs rather than inventing
   findings.
3. **Host matrix.** Ship verified configs for Claude Code, Codex, Cursor, and
   generic MCP stdio/HTTP clients. Extend `scripts/validate-plugins.mjs` to
   validate every host manifest against the contract registry, so a new tool
   cannot land without appearing in all of them.
4. **Tool-surface review.** The 6 public tools are start/get shaped. For 1.0 add
   what agents actually need and the REST API already supports: fetch issue
   evidence for a run, list pages with link evidence, and read Project Context.
   Read-only, contract-registered, with the same annotation and limit metadata.
5. **Plugin install smoke test in CI.** Install the packed bundle into a clean
   agent host, call each tool against a live local daemon, assert typed
   responses. This is the plugin equivalent of `pack:smoke` and it currently
   does not exist.

**Exit criteria**

- The plugin installs and completes one real audit from Claude Code, Codex, and
  Cursor, each recorded.
- `validate:plugins` fails if any host manifest drifts from the registry.
- Every skill has a passing eval asserting evidence citation.
- Plugin install smoke runs in `ci.yml` on every PR.

---

### Sprint 3 — Dashboard 1.0

**Goal:** the GUI is the product's front door and meets its own stated bar.

Scope:

1. **WCAG 2.2 AA across all 18 pages.** Existing axe coverage is per-component
   and partial. Extend to every route, keyboard-only navigation, focus order,
   visible focus, contrast, and reduced motion. Add a CI axe job that fails on
   any violation, not just on the pages currently asserted.
2. **First action within 15 minutes** — the release-status gate. Instrument the
   onboarding path, then close whatever it exposes. `apps/dashboard/src/pages/onboarding.tsx`
   is 589 LOC; measure it rather than assume it.
3. **Empty, loading, error, and unavailable states everywhere.** `data-state.tsx`
   exists; audit all 18 pages for consistent use. The "missing is not zero"
   discipline in the audit engine must be visible in the UI, not silently
   rendered as a dash.
4. **Fresh packaged Playwright + axe journey (B7).** Re-record the canonical
   journey against the current tree: onboarding → crawl → audit history →
   replay → comparison → link explorer → Issue Review → Project Context →
   extraction preview → reports → deletion. This is an explicit blocker in
   `docs/release-status.md` and must land here, not in Sprint 5.
5. **Responsive and desktop parity.** Verify mobile navigation and the Tauri
   webview render identically; the Tauri capability set is intentionally empty,
   so confirm nothing in the dashboard depends on native APIs.
6. **Visual coherence pass.** Apply one consistent chart/table/color system
   across `trend-chart.tsx`, `data-table.tsx`, and the metric cards. Charts
   currently vary by page.

**Exit criteria**

- Zero axe violations on all routes in CI.
- Median time-to-first-audit under 15 minutes with 3 unfamiliar testers.
- Canonical packaged Playwright + axe journey green on the current commit.
- No page renders an absent measurement as `0`.

---

### Sprint 4 — Correctness, security, and performance evidence

**Goal:** every quantitative claim in `docs/release-status.md` has a reproducible
artifact behind it.

Scope:

1. **Correctness corpus.** `community-synthetic-v2` reports 1.0 recall on 26
   labeled defects — that corpus is too small to support the stated 1.0 gate
   ("≥95% recall, <5% high-severity false positives"). Expand to a public corpus
   of at least 200 labeled instances across technical, on-page, content, link,
   and CWV rules, including adversarial healthy pages. Publish it; the
   release-status doc already says tool-replacement claims require a reproducible
   public corpus.
2. **Security corpora as blocking gates.** SSRF, open-redirect, DNS-rebinding,
   browser-escape, OAuth-callback, and secret-leak suites exist in pieces. Make
   each a named, blocking CI job with a documented case count. Add Gitleaks and
   RustSec to PR CI rather than only to the tag workflow.
3. **Crash and duplication safety.** The gate is "scheduled work survives
   process crashes without duplication." Add fault-injection tests that kill the
   daemon between filesystem artifact publication and SQLite finalization —
   named as separate crash domains in the release-status doc — and assert exactly
   one result.
4. **Run-state correctness.** Assert succeeded/partial/failed/cancelled
   transitions exhaustively and prove no recursive workflow can be scheduled.
5. **Provider contract fixtures.** GSC and GA4 pagination and current field
   contracts, recorded against real responses and replayed offline.
6. **Benchmark baseline.** `pnpm benchmark` exists; commit a baseline and fail CI
   on >20% unexplained regression, which is the stated gate but is not currently
   enforced.
7. **Dependency zero-state.** No known High/Critical advisory across both npm and
   both Rust lockfiles, checked live, plus a documented triage path for
   unfixable transitive findings.

**Exit criteria**

- Public labeled corpus committed; recall/FP numbers reproduced by CI, not by hand.
- Every security corpus is a named blocking job with a case count in the docs.
- Crash-domain reconciliation tests pass; no duplicate results under fault injection.
- Benchmark regression gate enforced with a committed baseline.
- Zero known High/Critical advisories at tag time.

---

### Sprint 5 — Release engineering and GA

**Goal:** ship `1.0.0` as signed installers, published packages, and an
installable plugin — with evidence.

Scope:

1. **Signed native artifacts.** Notarized macOS DMG, signed Windows MSI, deb,
   AppImage — for every supported target, produced by the canonical tag workflow.
   Secrets and signing identities provisioned in Sprint 1's canonical repo.
2. **Updater channel.** Tauri `latest.json` with target-prefixed, hash-verified
   inputs, one public key, attestation, and attachment before the draft release
   goes public. Source support exists; produce the actual artifact.
3. **Native lifecycle matrix.** Run the fail-closed DMG/MSI/deb/AppImage
   install → background start → single-instance activation → stop → upgrade →
   uninstall scripts against real signed artifacts. Select the Sprint 1
   prerelease tag as the `AGENTSEO_UPGRADE_BASELINE_TAG` upgrade baseline.
4. **npm publication (B6).** Replace `npm-publication-disabled.mjs` with the real
   path: 13 packages in dependency order, no unresolved `workspace:` protocols,
   clean tarball install in CI, OIDC + provenance attestations, published only
   after the native matrix passes.
5. **Plugin marketplace submission.** Submit to the Claude Code plugin
   marketplace and Codex, per the Sprint 1 license outcome.
6. **Docs 1.0.** Publish the VitePress site. Rewrite `README.md` for a 1.0
   audience — what it does, install in three commands, a screenshot of the
   dashboard, honest limits. Replace the roadmap-heavy framing.
7. **Legal and partner gates.** Qualified review of the final license,
   trademarks, and CLA. Three attributable design-partner weekly-workflow
   case studies.
8. **Rewrite `docs/release-status.md`** from a gate list into a released-state
   record, then tag `v1.0.0`.

**Exit criteria**

- Signed, notarized artifacts for every supported target, attached to the tag.
- `latest.json` published and an in-app update verified end to end.
- Lifecycle matrix green on real signed artifacts with a real upgrade baseline.
- 13 packages on npm with provenance; `npx agentseo` works from a clean machine.
- Plugin listed in at least the Claude Code marketplace.
- Legal review complete; three partner case studies published.
- `v1.0.0` tagged; `docs/release-status.md` describes a shipped release.

---

## 4. Risk register

| Risk                                             | Impact                                                        | Mitigation                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| License decision deferred past Sprint 1          | Blocks Sprints 2 and 5 simultaneously                         | Hard week-1 deadline; ADR required to close Sprint 1                                          |
| Canonical repo move loses CI/signing config      | Sprint 5 cannot produce artifacts                             | Move in Sprint 1, verify with the throwaway alpha tag                                         |
| Public corpus expansion underestimated           | Sprint 4 slips; the headline accuracy claim stays unsupported | Start corpus authoring in Sprint 3 in parallel                                                |
| Code signing certificates not procured in time   | No 1.0 installers                                             | Procure during Sprint 1; lead times are weeks                                                 |
| Design partners unavailable                      | Stated 1.0 gate unmet                                         | Recruit from Sprint 1; if unmet, ship 1.0 and drop the gate deliberately rather than silently |
| Rebrand shim breaks existing `.golemseo` bundles | User data loss                                                | Import-time dual-extension acceptance, covered by tests                                       |

## 5. Explicitly out of scope for 1.0.0

Hosted GolemWorkers Full, teams/RBAC/audit logs, managed credentials and credits,
white-label report delivery, always-on hosted scheduling, and the GitHub/Jira/
Linear/CMS hosted integrations. `docs/editions.md` is the boundary and should not
move during these five sprints.

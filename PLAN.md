# AGENTseo — Road to 1.0.0

Plan date: 2026-07-30. Baseline: `main` at `v0.12.0-alpha.0`, the first tag this
repository has ever had.

This document is the sprint plan from that tag to a public `1.0.0` release as an
installable agent plugin with a first-class GUI dashboard. It sits on top of
[`docs/release-status.md`](docs/release-status.md), which remains the
release-truth record.

---

## 1. Where the project actually stands

### What is genuinely built

| Area             | State                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code volume      | ~99,000 tracked LOC across 13 packages + 3 apps                                                                                                                              |
| Core engine      | `packages/core` 30.7k LOC — crawl, audit rules, link graph, extraction                                                                                                       |
| Runtime / server | `packages/runtime` 12.5k + `packages/server` 8.8k LOC                                                                                                                        |
| Storage          | `packages/storage-sqlite` 6.5k LOC, migrations through #11, immutable per-run snapshots                                                                                      |
| SDK              | `packages/sdk` 12.1k LOC, OpenAPI-generated, build fails on projection drift                                                                                                 |
| GUI dashboard    | `apps/dashboard` — 18 routed pages, ~6,100 LOC of page code, 25 test files including axe suites                                                                              |
| Agent surface    | 6 MCP tools from one `@agentseoapp/contracts` registry; Claude Code, Codex and OpenClaw bundles plus Cursor/VS Code/generic MCP configs, all generated with a drift gate     |
| CLI              | `packages/cli` 2.6k LOC                                                                                                                                                      |
| CI               | `ci.yml` (full `pnpm check`, dependency advisories, license policy, SBOM, Rust broker matrix, real-browser E2E), `codeql.yml`, `release.yml`, dependabot, issue/PR templates |
| Docs             | 9 docs + a VitePress site under `apps/docs`                                                                                                                                  |

`pnpm check` is green end to end across all 17 workspaces: format,
no-containers, the identity sentinel and its 13 tests, build, lint, strict types,
137 test files, release and npm policy, benchmark, contracts, plugins, licenses,
and a 13-package tarball smoke test.

This is a real product, not a scaffold. The audit engine, comparison
(`regression-v1`), link delta (`link-delta-v1`), internal-link explorer,
extraction rules, Issue Review, Project Context and reports are implemented with
storage/runtime/API/UI coverage at each layer. **The 1.0 problem is evidence and
distribution, not missing features.**

### Resolved since the original audit

These were the release blockers. They are done, and the plan below assumes it.

- **Licensing.** Apache-2.0 throughout, copyright MaxJafar, recorded in
  [ADR 0001](docs/adr/0001-apache-2-0-relicense.md). The LICENSE text is verified
  byte-identical to the canonical upstream text apart from the copyright line.
  The project is open source by the standard definition and now says so.
- **No affiliation, one edition.** No corporate owner, no paid tier, no hosted
  edition, no telemetry, no CLA, no trademark policy, no edition comparison.
  `COMMERCIAL.md`, `docs/editions.md`, `TRADEMARKS.md`, `CLA.md`,
  `GOVERNANCE.md` and the dashboard's edition-cards component are gone.
- **Rebrand complete and guarded.** The identity sentinel now covers `docs/`,
  `launch/` and `release/` as well as code — a bypass that previously let
  old-brand prose survive a rename. Its allowlist shrank from 90 exceptions to
  36, each with a stated reason. Compatibility is retained only where an earlier
  install could have written state (store filename fallback chain, `.golemseo`
  bundle and media type on import, `GOLEMSEO_*`/`GOLEM_SEO_*` env aliases,
  one-time localStorage migration, the pre-0.11 importer). Surfaces that existed
  only via publication were removed rather than aliased, which also narrowed the
  authenticated surface by one session cookie and two headers.
- **Agent plugin surface.** Claude Code plugin with slash commands and a
  marketplace manifest, the Codex bundle, the OpenClaw adapter, and
  Cursor/VS Code/generic MCP configs — all generated from the contract registry
  by `pnpm plugins:generate`, with `validate:plugins` failing on drift, on a
  missing host, on a command referencing an unknown tool, or on a start-shaped
  tool no command can reach.
- **Repository consolidation.** `main` is the only long-lived branch; eight stale
  branches and two orphaned worktree registrations are gone. Canonical identity
  is `MaxJafar/AGENTseo`, matching the actual remote.
- **Toolchain.** `pnpm doctor` reports missing Node, pnpm and cargo with exact
  remedies. `.nvmrc` and `.node-version` pin Node 24; `rust-toolchain.toml` pins
  Rust 1.97.0.

Two latent defects surfaced while doing that work and are fixed: the
packaged-secret guard listed only retired `GOOGLE_DESKTOP_CLIENT_SECRET` names,
so a secret under the canonical name would not have been rejected; and the docs
link validator's regex was case-mismatched against its own canonical prefix, so
canonical links were never actually resolved.

### What still blocks 1.0.0

- **B1 — Stale packaged evidence.** The packaged Playwright + axe journey needs a
  fresh canonical record; the local rerun predates the history and
  page-inventory assertions. This is an explicit blocker in
  `docs/release-status.md`.
- **B2 — No signed artifacts, ever.** No notarized DMG, signed MSI, deb or
  AppImage; no updater `latest.json`; no native lifecycle evidence produced on a
  canonical tag. Code-signing certificates are not procured.
- **B3 — npm publication is deliberately disabled.** `npm:prepare-release`,
  `npm:publish-release` and `prepublishOnly` all route to
  `scripts/npm-publication-disabled.mjs`.
- **B4 — The correctness corpus is too small for its own claim.**
  `community-synthetic-v2` reports 1.0 recall on 26 labeled defects. The stated
  1.0 gate is ≥95% recall with <5% high-severity false positives, and
  `docs/release-status.md` already says tool-replacement claims require a
  reproducible public corpus.
- **B5 — Security corpora are not all blocking jobs.** SSRF, redirect,
  DNS-rebinding, browser, OAuth-callback and secret-leak coverage exists in
  pieces; Gitleaks and RustSec run only on the tag workflow, not on PRs.
- **B6 — Benchmark regression is not enforced.** `pnpm benchmark` runs but no
  committed baseline fails CI on the stated >20% threshold.
- **B7 — Skills are one file.** A single `seo-marketer` skill covers six
  workflows, and no eval asserts that an agent cites run IDs rather than
  inventing findings.
- **B8 — Crash-domain reconciliation is untested.** Filesystem artifact
  publication and SQLite finalization are separate crash domains; nothing proves
  exactly one result survives a kill between them.

### Lower-severity

- `scratch/` and `codex-tasks/` are still tracked and empty.
- Two orphaned directories sit beside this repo in the parent folder —
  `AGENTseo-zil196-review` (553 MB) and `AGENTseo-zil276-integration` (12 MB) —
  each an abandoned worktree pointing at a `.git` that no longer exists. Their
  recorded commits are preserved in this repository's object database. Safe to
  delete once you have confirmed you want nothing from them.
- The native credential broker and Tauri shell are verified only on macOS arm64
  locally; CI covers `cargo check`, not the full native matrix.

---

## 2. Assumptions

1. **Sprint length is 2 weeks.** Five sprints ≈ 10 weeks to `1.0.0`.
2. **One edition, no hosted tier.** Everything in the repository ships to
   everyone; nothing is withheld to sell later.
3. **Solo maintainer.** Sprint content is sized for one person, which is why the
   public corpus in Sprint 3 starts in Sprint 2.
4. Design-partner sign-off was a 1.0 gate inherited from the commercial framing.
   It is now optional — see Sprint 5.

---

## 3. Sprint plan

### Sprint 1 — Agent-surface depth and marketplace readiness

**Goal:** the plugin is not just installable but genuinely good, and provably
correct in every host.

Scope:

1. **Skills per workflow (B7).** Split the single `seo-marketer` skill into
   discrete skills — `seo-audit`, `seo-regression-review`, `seo-keyword-research`,
   `seo-content-plan`, `seo-issue-triage` — each keeping the evidence-citation
   discipline the current skill establishes. They live once in
   `plugins/shared/skills/` and are copied into every host bundle by the
   generator.
2. **Skill evals.** One fixture per skill asserting the agent cites run IDs and
   affected URLs, reports `partial` runs as partial, and never fills an evidence
   gap with generic advice. This is the highest-value guardrail for an
   evidence-first product driven by an LLM, and there is currently none.
3. **Tool-surface review.** The 6 public tools are start/get shaped. Add the
   read-only capabilities agents actually need and the REST API already supports:
   fetch issue evidence for a run, list pages with link evidence, read Project
   Context. Contract-registered, with the same annotation and limit metadata.
4. **Plugin install smoke test in CI.** Install the packed bundle into a clean
   agent host, call every tool against a live local daemon, assert typed
   responses. This is the plugin equivalent of `pack:smoke` and does not exist.
5. **Marketplace submission prep.** Verify the Claude Code marketplace manifest
   installs from a clean clone, and that Codex accepts the bundle directory.
6. Delete `scratch/` and `codex-tasks/`.

**Exit criteria**

- The plugin completes one real audit from Claude Code, Codex and Cursor, each
  recorded.
- Every skill has a passing citation eval.
- Plugin install smoke runs on every PR.
- `validate:plugins` still fails on drift after the tool surface grows.

---

### Sprint 2 — Dashboard 1.0

**Goal:** the GUI is the product's front door and meets its own stated bar.

Scope:

1. **WCAG 2.2 AA across all 18 routes.** Existing axe coverage is per-component
   and partial. Extend to every route, keyboard-only navigation, focus order,
   visible focus, contrast and reduced motion, with a CI axe job that fails on
   any violation rather than only on asserted pages.
2. **First action within 15 minutes.** Instrument the onboarding path, then close
   whatever it exposes. `apps/dashboard/src/pages/onboarding.tsx` is 589 LOC;
   measure it rather than assume it.
3. **Consistent empty, loading, error and unavailable states.** `data-state.tsx`
   exists; audit all 18 pages for consistent use. The engine's
   "missing is not zero" discipline must be visible in the UI, not silently
   rendered as a dash.
4. **Fresh packaged Playwright + axe journey (B1).** Re-record the canonical
   journey against the current tree: onboarding → crawl → audit history → replay
   → comparison → link explorer → Issue Review → Project Context → extraction
   preview → reports → deletion.
5. **Responsive and desktop parity.** Verify mobile navigation and the Tauri
   webview render identically. The Tauri capability set is intentionally empty,
   so confirm nothing in the dashboard depends on native APIs.
6. **One chart and table system.** `trend-chart.tsx`, `data-table.tsx` and the
   metric cards currently vary by page.
7. **Start the public correctness corpus** (see Sprint 3) so authoring is not
   compressed into one sprint.

**Exit criteria**

- Zero axe violations on all routes in CI.
- Median time-to-first-audit under 15 minutes with three unfamiliar testers.
- Canonical packaged Playwright + axe journey green on the current commit.
- No page renders an absent measurement as `0`.

---

### Sprint 3 — Correctness, security and performance evidence

**Goal:** every quantitative claim has a reproducible artifact behind it.

Scope:

1. **Public correctness corpus (B4).** Expand to at least 200 labeled instances
   across technical, on-page, content, link and CWV rules, including adversarial
   healthy pages. Publish it. Recall and false-positive rates must be reproduced
   by CI, not by hand.
2. **Security corpora as blocking gates (B5).** SSRF, open-redirect,
   DNS-rebinding, browser-escape, OAuth-callback and secret-leak suites become
   named blocking CI jobs with documented case counts. Gitleaks and RustSec move
   to PR CI.
3. **Crash-domain reconciliation (B8).** Fault-injection tests that kill the
   daemon between filesystem artifact publication and SQLite finalization, and
   assert exactly one result. Then prove scheduled work survives a crash without
   duplication.
4. **Run-state correctness.** Exhaustive succeeded/partial/failed/cancelled
   transitions; prove no recursive workflow can be scheduled.
5. **Provider contract fixtures.** GSC and GA4 pagination and current field
   contracts, recorded against real responses and replayed offline.
6. **Benchmark baseline (B6).** Commit a baseline and fail CI on >20%
   unexplained regression.
7. **Dependency zero-state.** No known High/Critical advisory across npm and
   both Rust lockfiles, checked live, with a documented triage path for
   unfixable transitive findings.

**Exit criteria**

- Public labeled corpus committed; numbers reproduced by CI.
- Every security corpus is a named blocking job with a documented case count.
- Fault-injection suite proves no duplicate or lost results.
- Benchmark gate enforced with a committed baseline.
- Zero known High/Critical advisories.

---

### Sprint 4 — Release engineering

**Goal:** produce the artifacts a 1.0 actually ships.

Scope:

1. **Procure code-signing identities first.** Apple Developer ID and a Windows
   certificate have lead times measured in weeks; everything else in this sprint
   is blocked on them, so start on day one.
2. **Signed native artifacts (B2).** Notarized macOS DMG, signed Windows MSI,
   deb and AppImage for every supported target, produced by the canonical tag
   workflow.
3. **Updater channel.** Tauri `latest.json` with target-prefixed, hash-verified
   inputs, one public key, attestation, and attachment before the draft release
   goes public. Source support exists; produce the artifact.
4. **Native lifecycle matrix.** Run the fail-closed DMG/MSI/deb/AppImage
   install → background start → single-instance activation → stop → upgrade →
   uninstall scripts against real signed artifacts, using `v0.12.0-alpha.0` as
   the `AGENTSEO_UPGRADE_BASELINE_TAG` baseline.
5. **npm publication (B3).** Replace `npm-publication-disabled.mjs` with the real
   path: 13 packages in dependency order, no unresolved `workspace:` protocols,
   clean tarball install in CI, OIDC + provenance attestations, published only
   after the native matrix passes.

**Exit criteria**

- Signed, notarized artifacts for every supported target, attached to a tag.
- `latest.json` published and an in-app update verified end to end.
- Lifecycle matrix green on real signed artifacts with a real upgrade baseline.
- 13 packages on npm with provenance; `npx agentseo` works from a clean machine.

---

### Sprint 5 — GA

**Goal:** tag `1.0.0` and have the documentation match reality.

Scope:

1. **Marketplace submission.** Submit to the Claude Code plugin marketplace and
   Codex.
2. **Docs 1.0.** Publish the VitePress site. Rewrite `README.md` for a 1.0
   audience: what it does, install in three commands, a dashboard screenshot, and
   an honest limits section. The current README is a good engineering status
   document and a mediocre product front page.
3. **Rewrite `docs/release-status.md`** from a gate list into a released-state
   record.
4. **Optional: design-partner case studies.** Three attributable weekly-workflow
   approvals were a gate inherited from the commercial framing. For an
   unaffiliated open-source release this is marketing, not a correctness gate —
   keep it if you want the credibility, but do not let it block the tag. Decide
   deliberately and say which you chose.
5. **Tag `v1.0.0`.**

**Exit criteria**

- Plugin listed in at least the Claude Code marketplace.
- Docs site live; README rewritten.
- `v1.0.0` tagged; `docs/release-status.md` describes a shipped release.

---

## 4. Risk register

| Risk                                              | Impact                                                           | Mitigation                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Code-signing certificates not procured in time    | No 1.0 installers; Sprint 4 cannot start                         | Procure during Sprint 1, not Sprint 4. Lead times are weeks.                           |
| Public corpus expansion underestimated            | Sprint 3 slips and the headline accuracy claim stays unsupported | Start authoring in Sprint 2 in parallel                                                |
| Solo-maintainer bandwidth                         | Every sprint slips uniformly                                     | Sprints are ordered so each one ships something usable on its own                      |
| Accessibility retrofit larger than expected       | Sprint 2 slips                                                   | Add the CI axe job first so the true violation count is known on day one, not week two |
| Apache-2.0 means someone can host it commercially | Competitive, not technical                                       | Accepted deliberately in ADR 0001; differentiation is execution, not licence terms     |
| Marketplace review rejects the bundle             | Sprint 5 slips                                                   | Sprint 1 verifies a clean-clone install in every host before submission                |

## 5. Explicitly out of scope for 1.0.0

Hosted infrastructure, teams/RBAC/audit logs, managed credentials, white-label
report delivery, always-on hosted scheduling, and hosted GitHub/Jira/Linear/CMS
integrations. There is one edition and it is this one.

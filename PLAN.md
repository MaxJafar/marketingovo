# AGENTintel — Road to 1.0.0

Plan date: 2026-07-30. Audited tree: `e7b8abf`, workspace version
`0.1.0-alpha.0`, still internally named **Golem Intel**.

This document is the sprint plan from the current walking skeleton to a public
`1.0.0` release as an installable agent plugin with a GUI dashboard. It reads
[`docs/status.md`](docs/status.md) as the release-truth boundary and does not
soften it.

---

## 1. Audit summary

### What is genuinely built

Verified locally on 2026-07-30: `go build ./...` clean, `go vet ./...` clean,
`go test ./...` **all 9 packages pass** (api, connectors, daemonlock, governance,
jobs, policy, storage, both cmds).

| Area          | State                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Code volume   | 24,232 tracked LOC                                                                                                                |
| Go daemon     | `internal/` 8,758 LOC + `cmd/` 734 LOC — sessions, jobs, connectors, governance, policy, SQLite                                   |
| Python worker | `workers/intelligence` 4,800 LOC — Arrow/Polars normalization, DuckDB analytics, exact 32-field schema, hypothesis property tests |
| TypeScript    | `packages/` 2,964 LOC (contracts, generated SDK, MCP)                                                                             |
| GUI dashboard | `apps/dashboard` **1 page**, 6 components, 2,809 LOC including tests                                                              |
| Agent surface | 6 MCP tools over stdio + authenticated Streamable HTTP, Codex bundle, OpenClaw adapter, 3 editor MCP configs                      |
| Contracts     | OpenAPI + Protobuf + JSON Schema + Arrow, generated not handwritten, Buf breaking-change gate                                     |
| Docs          | architecture, threat model, quickstart, status, ADRs, metric catalog, model cards                                                 |

The architecture is unusually disciplined for an alpha: the Go authority treats
every Python artifact as untrusted, physically re-decodes Arrow and Parquet,
compares decoded rows, verifies citations and provenance, and publishes by
filesystem rename. The evidence and governance layer is the strongest part of the
codebase and is real.

### The central finding

**There is no live data source.** `internal/connectors/` contains exactly one
connector — `fixture.go`, 378 LOC, synthetic, using reserved `.invalid` URLs. The
"research" workflow is deterministic descriptive synthesis over a single committed
fixture, not research. `docs/status.md` states this plainly, and the README does
too, to the project's credit.

So the honest reading is: **AGENTintel is a well-engineered pipeline with nothing
flowing through it.** Everything in the audit summary above is infrastructure. The
gap to a 1.0.0 product a user would install is therefore much larger than
AGENTseo's, and this plan reflects that — Sprint 2 is where the product actually
starts existing.

### Release blockers found

**B1 — Not open source.** `LICENSE` is Elastic License 2.0. Same situation as
AGENTseo: source-available, not OSI-approved, and the README says so. Blocks
marketplace listing and OSI-gated adoption.

**B2 — 705 MB untracked duplicate.** `AGENTintel/AGENTintel/` is a nested,
untracked, near-complete copy of the repository — the only entry in
`git status`. Almost certainly a botched rename or copy. Must be deleted.

**B3 — No rebrand has happened at all.** Go module is
`github.com/GolemWorkers/golem-intel`. Binaries are `golem-intel` and
`golem-inteld`. Workspace package is `golem-intel-workspace`. Data directory is
`.golem-intel/`. Plugin name is `golem-intel`, display name "Golem Intel".
README title is "Golem Intel". Unlike AGENTseo, there is no partial migration and
no identity-policy script to enforce one.

**B4 — No CI whatsoever.** There is no `.github/` directory. No workflows, no
CodeQL, no dependabot, no issue or PR templates. `pnpm check` exists and is
comprehensive but has never run in automation. For a repository with a Go +
Python + TypeScript + Rust surface, this is the single highest-leverage gap.

**B5 — Governance and legal docs missing.** Present: LICENSE, NOTICE, README,
CONTRIBUTING, SECURITY, PRIVACY. Missing, all of which the sibling AGENTseo repo
has: `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `SUPPORT.md`, `TRADEMARKS.md`,
`CLA.md`, `COMMERCIAL.md`.

**B6 — Dashboard is one page.** `apps/dashboard/src/pages/` contains only
`ResearchPage.tsx`. A "GUI dashboard" release claim needs projects, run history,
an evidence browser, watchlists, reports, and settings. This is a from-scratch
build, not a polish pass.

**B7 — Reverse-engineering corpus is a legal and scope liability.**
`TO REVERSE ENGINEEER/` holds 820 MB of 49 third-party projects. It is correctly
gitignored and correctly blocked from build inputs by
`scripts/reference-lab-validate.mjs`, and `docs/status.md` is candid that
provenance is unresolved. Two unresolved problems remain:

- **License derivation.** Much of that corpus is GPL/AGPL (`minet`, `spiderfoot`,
  `IntelOwl`, `mixpost`, `postiz`, `4cat`, `zeeschuimer`). Reading AGPL source
  and reimplementing behavior into an ELv2 product is exactly the fact pattern
  that produces derivation claims. Gitignoring prevents _distribution_, not
  _derivation_. There is no clean-room process record.
- **Product-boundary conflict.** The corpus is heavily weighted toward account
  enumeration and people-search — `sherlock`, `maigret`, `holehe`, `GHunt`,
  `toutatis`, `yesitsme`, `WhatsMyName`, `Osintgram`, `linkedin_scraper`,
  `social-media-hacker-list`. The README's product boundary explicitly disclaims
  "covert identity enumeration" and "private-account access". Those two facts
  need to be reconciled in writing before a public release, or the first
  reviewer who lists that directory will draw their own conclusion.

**B8 — Zero tags, no releases, no desktop distribution.** No signed desktop
build, no updater channel, no published packages.

**B9 — Scheduler is not durable enough for its own claims.**
`docs/status.md`: single-daemon, no distributed lease/heartbeat/checkpoint/
dead-letter design; filesystem evidence publication and SQLite finalization are
separate crash domains "requiring explicit reconciliation testing" that has not
been done.

**B10 — Local toolchain cannot verify the JS/Rust surface.** Node v26.5.0
installed vs `engines: >=24 <25`; `pnpm` absent; `cargo` absent. Only the Go
surface is verifiable on this machine today.

---

## 2. Assumptions — read this before the sprints

Two-week sprints; five sprints ≈ 10 weeks. **You cannot reach the roadmap's
Phases 2–6 in that window, and this plan does not pretend otherwise.**

`1.0.0` is therefore redefined as: **a narrow but genuinely useful product** —
three real connectors, a real dashboard, real distribution — rather than a partial
delivery of the full vision. Concretely:

- **In for 1.0.0:** Website/RSS, YouTube Data API, and Reddit connectors;
  competitive comparison and monitoring over those three sources; a full
  dashboard; the agent plugin surface; signed desktop distribution.
- **Out for 1.0.0:** Meta, TikTok, Trends, licensed providers, the AGENTseo
  bridge, creator discovery, campaign history, registries/filings/funding/hiring
  signals, coordination networks, and all hosted/multi-tenant work (roadmap
  Phases 3–6).

If that narrowing is not acceptable, the correct response is more sprints, not a
denser plan — the pipeline is sound but the product surface is close to empty, and
compressing three real connectors plus a six-page dashboard plus first-ever CI
plus signed distribution into ten weeks is already aggressive.

---

## 3. Sprint plan

### Sprint 1 — Hygiene, identity, CI, and the legal clean-room

**Goal:** make the repository safe and legible to a stranger, and give it a build
gate for the first time.

Scope:

1. **Delete `AGENTintel/AGENTintel/` (B2).** Confirm nothing unique lives there
   first — `diff -rq` against the parent showed only cache and `.DS_Store`
   differences — then remove 705 MB and add a guard to `pnpm check` that fails on
   a nested self-copy.
2. **Rebrand to AGENTintel (B3).** Go module path
   `github.com/<canonical-org>/agentintel`; binaries `agentintel` and
   `agentinteld`; workspace `agentintel-workspace`; data dir `.agentintel/`;
   plugin name/display `agentintel`/`AGENTintel`; README title. Port AGENTseo's
   `scripts/identity-migration-policy.mjs` approach so the rebrand cannot regress.
   No shims needed — nothing is published yet, which makes this the cheapest it
   will ever be.
3. **Stand up CI (B4).** Model it on AGENTseo's `ci.yml`, which is already good:
   - `quality`: `pnpm install --frozen-lockfile` → `pnpm check` (which already
     chains reference validation, secret scan, contract lint, build, typecheck,
     lint incl. ruff + go vet, and all three test suites).
   - `go`: `go build`, `go vet`, `go test ./...` with race detector.
   - `python`: `uv sync --frozen`, `ruff`, `pytest` including the hypothesis
     property suites.
   - `native`: `cargo check --locked` and `cargo clippy -D warnings` on the Tauri
     shell, matrix across macOS/Windows/Linux.
   - `codeql.yml` for Go + JS/TS + Python; `dependabot.yml` for npm, Go modules,
     uv, and cargo.
   - Issue templates and a PR template.
4. **Resolve the license (B1).** Same decision as AGENTseo and it should be made
   once for both. Recommendation: Apache-2.0 for contracts, SDK, MCP, adapters,
   and the plugin bundle; ELv2 retained for the daemon and workers if commercial
   protection matters. Record as an ADR under `docs/adr/`.
5. **Add the missing governance docs (B5)** — port from AGENTseo and adapt.
6. **Clean-room record for the reference corpus (B7).** This is legal risk, not
   engineering preference, so it gets a named deliverable:
   `docs/reverse-engineering/CLEAN-ROOM.md` recording, per project actually
   consulted: upstream URL, exact commit, archive hash, license, and what was
   taken — _interface shape and observable behavior only_, never implementation.
   Plus an explicit statement that no AGPL/GPL source was copied, and a
   scope-reconciliation section explaining why account-enumeration tooling appears
   in the corpus while the product boundary disclaims that behavior. If any
   connector design cannot be defended this way, drop it. Also: move the corpus
   out of the repository working tree entirely, to a sibling path, so a `find`
   in the repo cannot surface it.
7. **Toolchain doctor (B10).** `.nvmrc`, exact tool versions in CONTRIBUTING, and
   a `scripts/doctor.mjs` that names what is missing.
8. Cut `v0.2.0-alpha.0` to prove the tag path exists.

**Exit criteria**

- `git status` clean; repository under 200 MB.
- No `golem` token anywhere outside license/NOTICE history, enforced by policy script.
- CI green on a PR: Go, Python, TypeScript, Rust, CodeQL all reporting.
- License ADR recorded; all six missing governance docs present.
- `CLEAN-ROOM.md` written and reviewed; corpus outside the working tree.
- A tag exists.

---

### Sprint 2 — Real connectors: the product starts here

**Goal:** replace fixture-only operation with three live sources, each meeting the
project's own shipping bar.

`docs/status.md` already defines that bar, and it is the right one — a connector
ships only with "source policy, credential scopes, rate limits, retention, kill
switch, fixtures and failure tests". Every connector below must satisfy all seven.

Scope:

1. **Website/RSS connector.** Highest value, no credentials, lowest policy risk.
   `robots.txt` compliance, conditional requests, feed discovery, content
   extraction, change detection. SSRF and redirect defenses at the egress layer —
   the daemon owns networking, so this belongs in `internal/policy`, not the
   connector.
2. **YouTube Data API connector.** First-party API, clear terms, BYOK. Channel and
   video metadata, public statistics, quota accounting with a hard kill switch on
   quota exhaustion.
3. **Reddit connector.** Official API with OAuth app credentials, BYOK,
   documented rate limits.
4. **Credential handling.** BYOK vault via the Rust native broker, never in
   SQLite, never in artifacts. Port AGENTseo's secret-canary test: prove active
   credentials cannot reach DB/WAL/SHM, events, artifacts, reports, logs, or
   backups.
5. **Egress policy layer.** Allowlisted schemes, blocked private address space
   with explicit per-project approval, DNS-rebinding defense, redirect-chain
   limits, response size and time bounds, per-source concurrency. One
   implementation, shared by all connectors.
6. **Extend the Arrow schema honestly.** The exact 32-field schema is
   fixture-shaped. Widen it for real multi-source observations, bump the schema
   version, and keep the Go-side physical re-decode and row-equivalence checks —
   that authority boundary is the best property of this codebase and must not be
   relaxed to accommodate real data.
7. **Fixtures and failure paths per connector.** Recorded real responses replayed
   offline; plus 429, 5xx, timeout, truncated-body, schema-drift, and
   credential-revoked paths.
8. **Kill switch.** Per-source disable, honored mid-run, with the run correctly
   ending `partial` rather than `failed`.

**Exit criteria**

- Three connectors live; a real three-brand comparison over real sources
  completes end to end and every claim in the report cites a real observation.
- Each connector has policy, scopes, limits, retention, kill switch, fixtures,
  and failure tests — all seven, all reviewed.
- Secret canary passes across the widened schema.
- The fixture connector still passes, retained as a test-only source.

---

### Sprint 3 — Dashboard 1.0

**Goal:** grow one page into an actual command center.

Scope:

1. **Pages to build (B6).** Beyond the existing Research page:
   - **Projects** — create, list, configure sources, delete by exact name.
   - **Runs** — history, status, cancel, replay, configuration provenance.
   - **Evidence browser** — the differentiator. Every observation traceable to
     source, snapshot hash, and manifest. This is what the governance layer
     already supports and nothing currently exposes.
   - **Watchlists** — monitored brand/creator sets and what changed.
   - **Reports** — HTML/CSV/JSON export with citations intact.
   - **Integrations/Settings** — BYOK connect, rotate, test, remove, with local
     removal clearly distinguished from provider-side revocation.
   - **System health** — daemon, worker, job queue, disk.
2. **Reuse, do not reinvent.** AGENTseo's `apps/dashboard` has a working
   `data-state`, `data-table`, `trend-chart`, `app-shell`, and accessibility test
   pattern. Port the patterns.
3. **Accessibility from the start.** WCAG 2.2 AA, axe in CI on every route from
   the first page. Retrofitting this is more expensive than the pages.
4. **Missing-is-not-zero in the UI.** The Python layer is rigorous about
   denominator safety and contradiction preservation; the UI must surface
   warnings and unavailable states rather than flattening them.
5. **Real-browser E2E.** Playwright journey against the live daemon: onboarding →
   project → real crawl → run → evidence trace → replay → report → deletion.
6. **Time to first result.** Instrument it; target under 15 minutes from install
   for a first-time user, matching the sibling project's gate.

**Exit criteria**

- Seven routes shipped, tested, zero axe violations in CI.
- Every rendered claim reaches its source evidence in no more than three clicks.
- Playwright journey green against real connectors.
- First result under 15 minutes with 3 unfamiliar testers.

---

### Sprint 4 — Agent plugin surface and durability

**Goal:** installable in every agent host, and trustworthy under failure.

Scope:

1. **Multi-host plugin.** Currently Codex-only. Add `.claude-plugin/plugin.json`
   and `marketplace.json`, generated from `packages/contracts`, plus verified
   Cursor and generic-MCP configs. Replace the `/absolute/path/to/...` placeholder
   in `integrations/*.mcp.json` with a real installed-path resolution.
2. **Skills.** One `intelligence-researcher` skill today. Add per-workflow
   skills — competitive comparison, source investigation, evidence tracing,
   watchlist review — each with an eval fixture asserting it cites run IDs and
   observation IDs and never asserts an uncited conclusion. This is the
   highest-value guardrail for an evidence-first product driven by an LLM.
3. **MCP tool surface for real data.** The 6 tools were shaped around the fixture.
   Add read-only evidence retrieval, source listing, and watchlist status, all
   contract-registered with limits and safety annotations, and a plugin-parity
   test that fails when a tool is added without appearing in every host manifest.
4. **Scheduler durability (B9).** Job leases, heartbeats, checkpointing, and a
   dead-letter path. Then fault-injection tests killing the daemon between
   filesystem manifest publication and SQLite finalization — the two crash domains
   `docs/status.md` names — asserting exactly one durable result and no
   duplication.
5. **Run-state correctness.** Exhaustive succeeded/partial/failed/cancelled
   transitions; prove no recursive workflow is schedulable.
6. **Python worker sandbox.** `docs/status.md` is explicit that developer Python is
   a trusted same-user process, not an OS sandbox. For 1.0, either implement real
   process isolation for the packaged path or state the trust boundary
   unambiguously in the threat model and README. Do not leave it implied.
7. **Benchmark.** The million-observation benchmark is an open gate. Build it,
   commit a baseline, fail CI on >20% unexplained regression.

**Exit criteria**

- Plugin installs and completes a real research run from Claude Code, Codex, and
  Cursor.
- Every skill has a passing citation eval.
- Fault-injection suite proves no duplicate or lost results across both crash
  domains.
- Benchmark baseline committed and enforced.
- Python trust boundary either enforced or documented explicitly.

---

### Sprint 5 — Security, distribution, and GA

**Goal:** ship `1.0.0` with evidence.

Scope:

1. **Security suites as blocking gates.** SSRF, redirect, DNS-rebinding,
   credential-leak, artifact-tampering, and path-traversal corpora, each a named
   CI job with a documented case count. Gitleaks and RustSec on every PR.
   `pnpm reference:scan:strict` already in `pnpm check` — keep it blocking.
2. **Dependency zero-state.** No known High/Critical across npm, Go modules,
   PyPI, and cargo. SBOM generation (CycloneDX) for all four ecosystems — a
   four-language SBOM is harder than AGENTseo's and should not be left to the
   last week.
3. **Signed desktop distribution (B8).** Notarized macOS DMG, signed Windows MSI,
   deb, AppImage. Tauri updater `latest.json`, hash-verified per target, attested
   and attached before the release goes public. Destructive lifecycle tests:
   install → background start → single-instance → stop → upgrade from the Sprint 1
   baseline tag → uninstall → verify cleanup with user data retained.
4. **Package publication.** SDK, MCP, contracts, and adapters to npm with OIDC
   provenance. Go install path for the CLI.
5. **Plugin marketplace submission,** per the Sprint 1 license outcome.
6. **Docs 1.0.** Publish a docs site. Rewrite `README.md` for a shipped product:
   what it does, three-command install, dashboard screenshot, and an honest
   limits section naming the three connectors and the deferred phases. The current
   README is an excellent engineering status document and a poor product front
   page.
7. **Model cards and metric catalog** updated for real data — the fixture-era
   `MODEL_CARD.md` and metric catalog will not describe live-source behavior.
8. **Legal review** of the final license, trademarks, and CLA.
9. **Rewrite `docs/status.md`** from a phase boundary into a released-state
   record: 1.0.0 ships three connectors, and Phases 3–6 are the post-1.0 roadmap.
   Then tag `v1.0.0`.

**Exit criteria**

- All security corpora blocking and green; zero known High/Critical advisories.
- SBOM covering Go, npm, PyPI, and cargo.
- Signed artifacts for every supported target; updater verified end to end;
  lifecycle matrix green on real signed builds.
- Packages published with provenance.
- Docs site live; README rewritten; model cards accurate for live sources.
- `v1.0.0` tagged; `docs/status.md` describes a shipped release.

---

## 4. Risk register

| Risk                                                        | Impact                                                                                     | Mitigation                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Three real connectors underestimated                        | Sprint 2 slips and everything downstream stalls, since Sprints 3–5 all depend on real data | Ship Website/RSS first and independently; if only one connector is ready by end of Sprint 2, cut 1.0.0 to that one rather than delaying          |
| AGPL derivation claim from the reference corpus             | Existential legal risk to the release                                                      | Sprint 1 clean-room record; drop any connector whose design cannot be defended                                                                   |
| Product boundary vs. corpus contents read as bad faith      | Reputational, on day one of a public release                                               | Written reconciliation in Sprint 1; corpus moved out of the tree                                                                                 |
| Four-language CI and SBOM harder than the AGENTseo template | Sprint 1 and 5 both slip                                                                   | Build CI incrementally in Sprint 1 — Go first, then Python, then TS, then Rust                                                                   |
| Platform ToS change on YouTube or Reddit                    | A shipped connector becomes non-compliant                                                  | Kill switch per source, already in the Sprint 2 bar                                                                                              |
| Dashboard built from one page in one sprint                 | Sprint 3 slips                                                                             | Port AGENTseo's component patterns rather than authoring new ones; Projects/Runs/Evidence are mandatory, Watchlists/Reports can slip to post-1.0 |
| Python sandbox deferred                                     | Ship with a weaker boundary than users assume                                              | Sprint 4 decision point: enforce or document, never leave implied                                                                                |

## 5. Explicitly out of scope for 1.0.0

Meta, TikTok, Trends, and licensed-provider connectors; the AGENTseo bridge;
licensed creator discovery and campaign history; registries, filings, products,
funding, and hiring signals; cross-source semantic clustering and coordination
networks; aggregate workforce intelligence; and all hosted GolemWorkers
storage/workers/tenancy/RBAC/billing. These are roadmap Phases 3–6 and stay there.

The product boundary in `README.md` — no authentication bypass, CAPTCHA evasion,
stolen sessions, private-account access, breach data, biometric correlation,
protected-trait inference, covert identity enumeration, candidate ranking,
employee monitoring, or automated employment decisions — is a permanent
constraint, not a scope item. Nothing in these five sprints may erode it.

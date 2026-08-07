# Architecture

Marketingovo is a local-first system with one daemon as the authority for jobs,
SQLite, scheduling, sessions, artifacts, and credentials.

```text
React dashboard ─┐
CLI / SDK ───────┼── 127.0.0.1:3210 ── runtime daemon
MCP / adapters ──┘                         │
                    ┌──────────────────────┼────────────────────┐
                 SQLite                vault broker         job workers
                    │                      │                    │
              WAL + artifacts       OS key store       engine + connectors
                                                               │
                                                         egress policy
```

## Repository

```text
apps/dashboard       React 19 and Vite control plane
apps/desktop         Tauri 2 launcher, service control, updater
apps/docs            Product documentation site
packages/contracts   TypeBox and JSON Schema source of truth
packages/core        Crawler, checks, rule engine, report primitives
packages/application Workflows, executor, action scoring
packages/storage-sqlite Migrations, repositories, durable jobs
packages/integrations Connector manifests and normalized data
packages/credentials Vault contract and credential broker clients
packages/server       Fastify local API, sessions, SSE, OpenAPI
packages/sdk          Generated and typed API client
packages/cli          User-facing command line client
packages/mcp          Bundled stdio MCP bridge
packages/runtime      Service composition and lifecycle
adapters/openclaw     OpenClaw runtime adapter
plugins/codex         Installable Codex bundle
benchmarks            Fixed performance and correctness corpora
migrations/legacy-v0  Non-destructive legacy importer
```

## Execution model

Leaf modules and workflows are separate registries. A workflow creates an
execution plan but cannot be scheduled as a leaf, making recursive workflow
execution impossible by construction. The executor builds topological layers,
runs each layer through a bounded pool, validates inputs and outputs, resolves
requirements, and records module version, timing, coverage, and errors.

Run states are `queued`, `running`, `succeeded`, `partial`, `failed`, and
`cancelled`. Missing provider configuration is a module-level `skipped` result
that may make a workflow partial but does not masquerade as a failure.

Issue instances are stable across runs through a fingerprint of module, rule,
and canonical URL. New passes replace the prior pass output for that module;
they do not append duplicates.

Each `issue_instances` observation also owns an immutable severity, title, and
description snapshot. The shared fingerprint row can track the current rule
definition without retroactively changing a prior audit. Historical comparison
therefore reads the run snapshot and applies current project adjudication only
as an explicit review overlay.

Human adjudications are separate from immutable issue observations. The
`issue_adjudications` table stores only a project-scoped `ignored` or
`false_positive` override and its bounded reason. Reopening removes the
override. Reads calculate the effective status, future runs inherit it, and
grouped actions remove reviewed URL instances and recalculate URL reach. An
action is omitted from live priorities only when all of its active issue
instances are reviewed; raw actions remain available in history and portable
exports. Import reconstructs action-to-issue links from canonical rule/module
identities so this behavior survives a `.marketingovo` transfer.

## Agent terminal sessions

The dashboard presents itself as a console, and the prompt along its bottom edge
is a real one: a two-sided pipe between the browser and an agent harness the
operator already trusts. The daemon does not implement a chatbot and holds no
model credential. It stores turns, wakes waiting readers, and expires leases.

That split is deliberate. This process already owns provider credentials and a
marketer's crawl history, so adding a model API key beside them would widen the
blast radius of the one component most worth keeping boring. A harness — Claude
Code, Codex, anything speaking MCP — already has a model, already has consent to
act, and already reaches the workflow tools. It only lacked a way to be spoken
to from the browser.

The two sides authenticate differently and the difference is load-bearing. The
browser arrives with a same-origin session cookie plus a CSRF token; the harness
arrives with the local service token, which the auth hook accepts ahead of the
cookie path. Neither can impersonate the other, so "who said this" is decided by
transport rather than by a role field a caller could set. Agent-side routes
additionally carry the `agentId` minted at attach, so a second process holding
the same service token still cannot write into a session it does not hold.

Only one agent holds a session at a time. Liveness is decided by silence rather
than by a clean goodbye: every poll renews a lease, and a harness that crashes
mid-turn has its lease lapse so the console can say so instead of showing an
agent that will never answer. History is bounded and in-memory — this is a live
console, not an audit log, and nothing typed into it is written to SQLite.

## Project Context and human memory

Project Context keeps operator intent separate from observed SEO state. The
`project_context_versions` table is append-only: each save creates the next
project-scoped revision containing the normalized profile, a bounded change
summary, local actor, and timestamp. The current profile is derived from the
highest revision; prior revisions are never overwritten by the product API.

The `project_context_journal` table records ordered observations, decisions,
constraints, and experiments. A journal entry may reference a run only when
that run belongs to the same project. Entries have stable sequences and no
update or delete endpoint. A later entry records a correction explicitly.

These records guide interpretation but do not replace crawl or provider
evidence. MCP exposes them as a read-only project resource; the workflow
tools remain unchanged. Secret-like text and local paths are rejected before a
write, while audit events record only structural metadata. `.marketingovo` transfer
includes the complete stored context and remaps project, entry, and linked-run
identifiers on import.

New project bundles also include the sanitized options snapshot behind each
run. Import remaps that snapshot together with its run and verifies that any
referenced extraction-rule revision exists, so a later replay preserves crawl
scope and extraction configuration. Earlier version 2 bundles without run
configuration snapshots remain importable; secrets and local paths are never
added to the transfer.

## Storage and jobs

SQLite runs with WAL, foreign keys, a busy timeout, transactions, file-mode
hardening, and one writer daemon. Jobs use a lease, heartbeat, idempotency key,
retry/backoff, cancellation, and dead-letter status. Schedules persist timezone
and `next_run_at`; process timers are only wake-up mechanisms.

Large snapshots and reports are artifacts referenced by database metadata. Each
completed audit also writes a checksum-verified, versioned `run-evidence.json`
summary for sitemap coverage and evidence availability. Page-level crawl paths,
redirect chains, hreflang matrices, and extraction results remain in SQLite for
server-side filtering and pagination; the JSON report preserves the complete
captured cohort for reproducible review. Missing or corrupt evidence is exposed
as unavailable or partial with nullable source-dependent metrics, never as a
fabricated zero.
New audits also persist bounded link observations inside each portable page
snapshot and normalize them into `page_links` migration 11. The graph stores a
run-scoped source, literal destination, resolved crawled page, distinct anchor
samples, placement, and follow/nofollow counts. Indexed source and target views
serve page-level inlinks and outlinks without reconstructing a graph in the
browser. Import rebuilds the normalized table from sanitized `.marketingovo` page
snapshots, while older runs remain explicitly unavailable until replayed.
Custom extraction configuration is stored as immutable project revisions in
`project_extraction_rule_versions`. Each revision has a stable SHA-256 over the
ordered normalized rules. A new audit stores either the current revision number
or an explicit `null` snapshot in its options; replay therefore keeps the same
rules even after Settings changes. Draft preview renders one URL on the
project's exact origin through the production redirect, DNS, private-network,
and Chromium policy. Private hosts require a per-preview opt-in and cloud
metadata remains blocked. Preview never writes a revision or run.

The built-in extraction template catalog is versioned public contract data,
not project state. `GET /api/v1/extraction-rule-templates` serves the same
review-required catalog to the dashboard, SDK, and CLI. Template-local IDs are
never persisted directly: a client must display all assumptions and fields,
reject duplicate labels or capacity overflow, and materialize fresh rule IDs
only into an unsaved draft. The normal runtime validation and explicit
revision save remain the authority.

Project deletion is a deliberate two-phase lifecycle operation: the runtime
requires the exact current name, cancels active work, moves deterministic
artifact and project directories into private deletion staging, commits the
SQLite cascade plus orphan-safe issue cleanup, and then removes staging. A
failed database commit restores staged files. A content-free recovery manifest
lets a restarted daemon consult SQLite: it restores staged files when the
project still exists and finishes cleanup only when the project is absent.
Unknown or conflicting staging fails closed and degrades system health instead
of deleting data. Provider credentials remain a separate global BYOK lifecycle
because they may serve more than one project.
Online backups use SQLite's snapshot API, then validate integrity, foreign
keys, schema version, and SHA-256 before publication. Restore is deliberately
offline: it requires the single-writer lease, validates the snapshot twice,
removes stale WAL state, and retains the previous database as a dated rollback
file. Legacy sources are never deleted automatically.

## Public contracts

TypeBox schemas provide runtime validation and drive OpenAPI for routes that
declare request and response schemas. The SDK ships a complete low-level
`openapi-fetch` client whose 7,000+ lines of path, parameter, media-type,
authentication-error, and response types are generated deterministically from
that document. Builds fail when the checked-in generated projection drifts;
the ergonomic workflow client remains a reviewed wrapper over the same API and
keeps its stricter localhost token boundary.

`POST /runs/:id/replay` is an idempotent copy-on-start operation. It hashes the
versioned workflow/options envelope, creates a distinct run, records only the
source ID and hash as structural provenance, and leaves the source graph
immutable. A replay re-reads the current website and provider state; it
reproduces execution configuration rather than pretending external inputs are
frozen.

`GET /runs/:id/comparison?baselineRunId=...` is a read-only historical diff.
The runtime rejects cross-project, non-audit, active, same-run, and reversed
pairs before reading evidence. It compares effective issue-presence sets and
immutable page snapshots, retrieves health by exact run ID, names stored
configuration differences without returning raw options, and bounds detailed
result arrays. Missing or partial evidence changes the comparison state and
warnings; it never fabricates a zero.

The same response embeds a separately versioned `link-delta-v1` projection.
SQLite supplies run-scoped normalized edges and coverage for both snapshots;
the runtime compares exact source and literal target identities and returns
added, removed, and dimension-specific modified edges. Only observed broken
target creation/recovery and direct/redirect/broken quality transitions are
directional. Editorial changes and uncrawled destinations remain neutral, and
the link projection does not alter the independent `regression-v1` score.

`GET /runs/:id/links?pageUrl=...&direction=...` is a read-only projection over
one immutable audit graph. It accepts only an exact page from that run, returns
bounded pagination and server-computed totals, and distinguishes direct,
redirected, broken, and uncrawled targets. Active runs, non-audit workflows,
malformed URLs, and cross-snapshot page guesses fail through typed Problem
Details.

The nineteen workflow-level agent tools have one TypeBox/JSON Schema registry
in `@marketingovo/contracts`. MCP derives Zod validators from those schemas and
OpenClaw derives typed `Unsafe` projections without redefining their fields.
Build and bundle tests verify strict objects, defaults, numeric and collection
limits, URL protocols, safety metadata, manifest parity, and the exact
nineteen-tool surface across MCP, Codex, and OpenClaw.

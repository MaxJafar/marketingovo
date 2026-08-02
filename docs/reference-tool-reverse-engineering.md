# Reference-tool reverse engineering

This document records the license-safe behavioral audit used to improve
Marketingovo. It is an engineering decision record, not a claim that
the referenced projects endorse Marketingovo.

Snapshot date: **2026-07-15**. Each repository was inspected at the exact commit
listed below. Marketingovo's implementation remains TypeScript under
Apache-2.0 and follows its local-first, same-origin, native-process
architecture.

## Method and legal boundary

We evaluated each product on five axes: marketer leverage, evidence quality,
fit with Marketingovo's canonical contracts, security and data correctness, and
license compatibility.

- MIT references may be adapted with the required notice. The features in this
  tranche were nevertheless implemented against Marketingovo's own contracts
  rather than copied file-for-file.
- AGPL and GPL references were used only to understand observable behavior and
  workflow design. No source, tests, text, or assets from those repositories
  were copied into Marketingovo.
- Deployment-specific container and Cloudflare mechanics were excluded by product
  policy.
- A heuristic from another tool is not automatically truth. Marketingovo exposes
  the threshold, evidence, affected cohort, and intent assumptions.

## Reference matrix

| Reference                                                                                                     | Snapshot and license | Strongest mechanics                                                                                                                                | Decision in Marketingovo                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Open SEO](https://github.com/every-app/open-seo/tree/61c0b0c65791b855d83cdc5d0f299a8c7b87527d)               | `61c0b0c`, MIT       | Provider-centric research workflows, actual DataForSEO cost accounting, explicit data-source routing, reusable project context, agent/MCP surfaces | **Adopted now through Marketingovo contracts:** provider economics and actual DataForSEO task cost; versioned business/SEO profiles; append-only marketer journal; read-only MCP context; secret-safe `.marketingovo` transfer. **Excluded:** original deployment and hosted billing code.                           |
| [Seonaut](https://github.com/stjudewashere/seonaut/tree/880b312c28fab8b0bf7fe4f9449dc4746dbb82ff)             | `880b312`, MIT       | Persistent crawl/report model, small composable reporters, replay/archive workflow, deep technical rule coverage                                   | **Adopted now:** usable viewport, duplicate DOM id, large DOM, image dimensions/fallback, richer hreflang, click-depth diagnostics, idempotent local run replay, and evidence-based archive comparison with configuration provenance.                                                                                |
| [Claude SEO](https://github.com/AgricIDaniel/claude-seo/tree/6cf1ea9fe4c2088b2ad3089797f846850fd66164)        | `6cf1ea9`, MIT       | Goal router, evidence-first audit discipline, layered outputs, quality gates, explicit limitations, dependency-aware action planning               | **Adopted now:** Marketingovo's Codex marketer skill observes before scoring, states assumptions, challenges contradictory evidence, orders gating constraints, and defines success and failure conditions.                                                                                                          |
| [SiteInspector](https://github.com/siteinspector/siteinspector/tree/7493e509cc11420f7f31ee17a959478d78ac580c) | `7493e50`, AGPL-3.0  | Custom rules, false-positive adjudication, crawl sessions/cancellation, content QA, shareable report links                                         | **Adopted now through a clean implementation:** durable, reversible issue adjudication with evidence, reasons, project isolation, audit events, future-run persistence, REST/SDK/dashboard/MCP surfaces, and `.marketingovo` transfer. Public share links are out of scope: there is no hosted service to host them. |
| [Greenflare](https://github.com/beb7/gflare-tk/tree/4e6e90299c96071a6e1466d49eae21e181643d75)                 | `4e6e902`, GPL-3.0   | Desktop list crawl, include/exclude controls, custom extraction workbench, inlink inspection                                                       | **Adopted now through a clean implementation:** exact URL cohort audits use the durable runtime and dashboard Expert scope. Custom extraction has immutable project revisions, draft preview through the production egress policy, bounded paginated evidence, safe regex validation, and explicit truncation.       |
| [SEO Macroscope](https://github.com/nazuke/SEOMacroscope/tree/62e67130ecbe3062ad2bca2c43686c34a2ff49c1)       | `62e6713`, GPL-3.0   | Click-path analysis, redirect-chain workbench, inlink/outlink evidence, hreflang matrix, sitemap and spreadsheet artifacts                         | **Adopted now through a clean implementation:** crawler depth and first referrer, redirect paths, reciprocal hreflang matrix, sitemap coverage, and a page-level inlink/outlink explorer are backed by immutable run evidence.                                                                                       |

## Integrated tranche: Audit Intelligence Pack

### Link intelligence

The crawl index now preserves `crawlDepth` and `discoveredFrom`. The link module
adds:

- `internal-link-to-redirect`: identifies the source pages that must be edited,
  not only the redirected target;
- `excessive-click-depth`: reports indexable pages more than three link hops
  from a seed and includes the discovery path evidence;
- `low-inlink-discoverability`: finds deep indexable pages with no more than one
  distinct inlink;
- normalized fragment-free orphan comparisons; and
- explicit inlink counts in the top-hub evidence.

The three-hop value is a transparent diagnostic, not a ranking guarantee.

### Structural and international diagnostics

HTML is parsed once and reused by checks. New evidence includes the viewport
value, element count, duplicate ids, HTML language, images without intrinsic
dimensions, and `<picture>` elements without an `<img>` fallback.

New issue contracts cover:

- missing or empty viewport;
- duplicate DOM ids and large DOMs;
- missing image dimensions and picture fallbacks;
- `noimageindex` and `nosnippet` intent reviews;
- missing language-specific hreflang self-references;
- relative hreflang URLs;
- HTML language conflicts; and
- optional `x-default` review.

Intent-sensitive directives are deliberately Low priority and carry
`intentRequired: true`. Marketingovo must not instruct a marketer to remove a valid
restriction without understanding the business intent.

### Transparent provider economics

Research results now carry:

```ts
interface ResearchProviderUsage {
  requestMade: boolean;
  billable: boolean;
  actualCostUsd: number | null;
  costSource: "free" | "provider-reported" | "not-reported";
}
```

DataForSEO costs are summed from successful task responses. SerpAPI remains
`not-reported` because the current response does not establish a per-call cost.
The keyless fallback is `free` only after a request is made. Keyword profiles
aggregate known cost and count billable calls whose cost is unavailable.

### Exact-cohort audit workflow

The dashboard now accepts an exact list of absolute project URLs. Fragments and
duplicates are removed in the browser, and the runtime validates every URL
again, enforces the project origin, and passes the cohort as both crawl scope
and independent seeds. This makes template QA and migration verification
possible without crawling unrelated site sections.

### Versioned Project Context

The local Project Context workspace provides reusable strategy memory without
turning human notes into analytics. A normalized profile records audiences,
markets, languages, conversion goals, priority topics, competitors, and
constraints. Every save creates a new immutable revision with an explicit
change summary.

An append-only journal records observations, decisions, constraints, and
experiments, optionally linked to a run from the same project. Runtime checks
reject secret-like material, local paths, malformed profiles, and cross-project
run references. Audit logs contain only structural metadata. Export/import
preserves the full history while remapping project, journal, and run identifiers.

Agents read `marketingovo://projects/{id}/context` before overview and issue
resources. The resource is read-only and does not expand the exact six-tool
workflow surface. Journal observations remain hypotheses until crawl or
provider evidence verifies them.

### Agent reasoning contract

The Codex marketer skill now requires:

- source freshness and coverage before conclusions;
- a causal hypothesis plus contradictory evidence;
- dependency ordering (`depends on` and `unblocks`);
- a measurable success condition and falsifiable failure condition;
- exact-cohort verification; and
- honest treatment of unavailable data and unreported provider cost.

### Evidence-preserving issue review

The local Issue Review workspace is the human quality-control layer between a
rule firing and an action entering the marketer backlog. A reviewer can search
and filter the latest finding state, inspect raw evidence and occurrence
history, then classify it as intentionally ignored or a false positive only
after recording a reason and confirming the decision.

Adjudications are scoped by project and fingerprint, survive future audits,
and can be reopened. A reviewed URL instance is removed from its grouped
Action scope and `priority-v1` is recalculated; the Action leaves live
priorities only when every active instance in that rule/module group is
reviewed. Nothing deletes the issue instance, old run, or evidence. Notes are bounded,
rejected when they resemble credentials or local paths, excluded from audit-log
payloads, and transferred in secret-screened `.marketingovo` bundles. Agents receive
the result through a read-only project resource and cannot change it through a
default workflow tool.

### Versioned audit evidence workbench

The audit detail page no longer stops at issue totals and event names. Every new
audit persists `evidenceVersion: 1` page payloads plus a checksum-verified
`run-evidence.json` summary. The REST API and SDK page four evidence sections:
crawl paths, redirects, hreflang, and custom extractions. Every response exposes
the full matching total, offset, limit, next offset, capture state, and warnings.

The hreflang checks and UI use the same matrix. Reciprocal language is compared
with the source page's language-specific self-reference, so a valid English to
French pair returning as French to English is not misclassified. Target state,
observed return languages, self-reference, and unavailable evidence remain
visible.

Sitemap collection now distinguishes `urlset` from `sitemapindex`, expands a
bounded same-origin child set through the shared SSRF-aware renderer, and keeps
the exact source-file inventory. Coverage includes indexable URLs absent from
the sitemap, declared URLs not observed in the crawl, and declared URLs with
captured HTTP errors. Missing or failed sitemap capture returns nullable counts,
never fabricated zeroes. UI samples are labelled with their complete totals;
the JSON report retains the complete captured sitemap cohort.

### Immutable local run replay

A terminal run can be replayed through the runtime, REST API, generated SDK, or
dashboard. Replay copies the stored workflow and exact options into a new run;
it never updates the source row, pages, issues, artifacts, timestamps, or event
history. The response exposes `configurationVersion: 1` and a stable SHA-256 of
the workflow/options envelope without serializing the options themselves.

Starts require an idempotency key scoped to the source run. Repeating the same
request returns the same replay run and does not enqueue duplicate work. Active
sources and unsupported legacy workflows fail closed. The new run records the
source ID and configuration hash in a structural event. Live pages and current
provider connections are deliberately queried again: this is reproducible
execution configuration, not a claim that an external website is frozen in
time.

### Immutable audit comparison

The Audits workspace can compare two succeeded or partial audit runs from the
same project without scheduling another crawl. The daemon, rather than the
browser, computes new, resolved, persistent, and severity-changed findings;
HTTP-family and indexability changes; captured-page coverage; and run-specific
SEO Health. Ignored and false-positive adjudications are excluded explicitly,
and unavailable health remains `null`.

Every issue instance now stores its own severity, title, and description
snapshot. This closes a historical-integrity defect where a later rule update
could otherwise change the presentation of an earlier run sharing the same
fingerprint. Migration 10 backfills existing observations without deleting or
rewriting the source runs.

`regression-v1` is intentionally inspectable: new issues add severity weight
(critical 8, high 5, medium 3, low 1), fixes subtract it, HTTP regressions add
3, and indexability regressions add 2. The comparison exposes stored
configuration fingerprints and named scope differences. URL additions and
removals remain neutral because a changed crawl scope can produce either
without proving a site regression. The same typed result is available through
REST, generated OpenAPI SDK types, the ergonomic SDK, and
`marketingovo run compare`.

### Immutable internal-link explorer

The crawler now records bounded per-anchor evidence before the in-memory graph
is released: normalized target URL, anchor text, follow/nofollow state, and the
nearest header, navigation, main, aside, footer, or body placement. The report
aggregates occurrences by source and target, and the runtime stores this as
`linkGraphVersion: 1` page evidence.

Migration 11 normalizes those portable observations into indexed `page_links`
rows without making the normalized table a second source of truth. Requested
redirect aliases resolve to the crawled final page while preserving the literal
target URL. This lets the server distinguish direct, redirected, broken, and
uncrawled destinations and calculate exact inlink-source, outlink-target, and
occurrence totals.

The Pages workspace opens a page-scoped explorer with anchor and placement
evidence, follow/nofollow counts, search, bounded pagination, honest legacy-run
states, and direct links to the observed pages. REST, generated OpenAPI types,
the ergonomic SDK, and `marketingovo run links` expose the same server result. The
browser never recomputes the graph, and `.marketingovo` import rebuilds the index
from the sanitized immutable snapshots.

### Immutable link-graph comparison

The Audits comparison now consumes the same run-scoped `page_links` evidence
instead of rebuilding links from a live site or the browser. `link-delta-v1`
compares exact source URL plus literal target URL identities, reports graph-page
coverage and edge totals for both runs, and separates added, removed, and
modified edges. Modifications name the observed dimension: target resolution,
target indexability, follow policy, occurrence count, anchor text, or placement.

The classifier deliberately stays narrow. Creating a link to a captured broken
target is a regression; removing one is a recovery; and transitions between
direct, redirected, and broken destinations receive directional impact.
Editorial additions/removals and changes involving an uncrawled destination
remain neutral because the crawl does not prove intent or target health. Partial
and legacy coverage is visible, detailed output is bounded, and the link delta
does not silently change the published `regression-v1` score. REST, generated
OpenAPI types, the ergonomic SDK, CLI JSON, and the dashboard receive the same
server-computed result.

### Versioned custom extraction workspace

Greenflare's observable extraction workbench informed the marketer workflow,
not the implementation. Marketingovo now owns a clean project-scoped contract for
up to 50 ordered rules. A rule selects text, inner HTML, or one attribute and
may apply the existing bounded regex language. CSS selector compilation,
attribute semantics, duplicate labels, unsafe regex structures, and contract
limits are rejected before a crawl or network preview begins.

Every save creates an immutable SQLite revision with a configuration SHA-256.
New audits snapshot that revision into stored options; replay keeps the source
revision even when the project has moved on. Project transfer carries the
immutable rule history plus the sanitized configuration snapshot for every run,
validates all run/revision references, and keeps earlier bundle-v2 files
importable. The Settings preview accepts only the selected project's exact
origin, removes URL fragments, sends no custom credentials, and runs through
the shared redirect/DNS/browser egress policy. Private-host preview and repeat
audits require an explicit exact-host approval; metadata addresses stay
blocked. Preview results are bounded and structurally redacted, and previewing
a draft does not persist rules or create a run.

### Review-first extraction templates

The dashboard now discovers a canonical
`extraction-template-catalog-v1` through the authenticated local API. The
initial packs cover social previews, editorial articles, commerce products,
and migration markers. Each pack carries a recommended page and explicit
assumptions, and the review table exposes every field, selector, and capture
mode before import.

`importMode: review_required` is part of the public contract. Selecting a pack
does nothing; **Add fields to draft** materializes fresh local rule IDs only
after review. Existing labels and the 50-rule boundary block the operation
instead of silently renaming, dropping, or overwriting fields. Import never
saves a revision or starts a crawl. REST, generated OpenAPI types, the ergonomic
SDK, and `marketingovo extraction templates` expose the same read-only catalog,
while the normal exact-origin preview and immutable save remain authoritative.

## Explicitly not adopted

- No container deployment files, installation route, or runtime concepts.
- No AGPL/GPL implementation code or UI assets.
- No arbitrary site, audit, or 5,000-URL product limit.
- No client-side commercial feature gates or dormant Full Edition code.
- No claims that content length, click depth, or DOM size alone determines
  ranking.
- No scraping result is presented as search volume or market share.

## Follow-up queue

The next highest-value clean-room tranche is:

1. design-partner validation of `link-delta-v1` classification and language
   before any link signal is allowed to affect the aggregate regression score.

These are sequencing decisions, not Marketingovo paywalls.

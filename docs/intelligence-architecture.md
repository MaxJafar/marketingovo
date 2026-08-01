# Marketingovo intelligence architecture

**Status:** proposal. No product code written against it yet.
**Scope:** the social, competitive-intelligence and market-analysis layer.
**Written:** 2026-08-02, immediately after the AGENTintel merge.

Marketingovo is now one repository holding three runtimes and two product
lineages. This document says how the social and competitive-intelligence layer
should be built on top of that, what it must refuse to do, and in what order.

---

## 1. What actually exists today

Naming this precisely matters, because the gap between "we have competitor
features" and "we have a competitive intelligence product" is where this plan
lives.

### Already shipped and working

| Capability                | Location                                           | What it really does                                                    |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Competitor feed cadence   | `packages/core/src/integrations/feed.ts`           | Publishing rhythm from a site's own RSS/Atom, with honest denominators |
| Brand presence            | `packages/core/src/integrations/brand-presence.ts` | Reachability of a brand's profile pages, typed rather than boolean     |
| Content gap               | `packages/core/src/integrations/content-gap.ts`    | Topic coverage held by competitors and missing from the project        |
| Audit comparison          | `packages/core/src/compare.ts`                     | New / resolved / severity-changed across two runs, no zero-filling     |
| Competitors dashboard     | `apps/dashboard/src/pages/competitors.tsx`         | Presents the above                                                     |
| SERP / Trends / providers | `packages/core/src/integrations/`                  | SerpAPI, DataForSEO, Google Trends, PSI, Lighthouse, GSC, GA4          |

### Ported but not yet wired to the product

| Capability                  | Location                                              | State                                             |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Intelligence daemon         | `services/intel-daemon/`                              | Builds, vets, 12.8k LOC Go, full test suite green |
| Connector router + protocol | `services/intel-daemon/internal/connectors/`          | Website, fixture and Python-worker connectors     |
| Governance / policy engine  | `services/intel-daemon/internal/{governance,policy}/` | Rights state, retention, permitted purpose        |
| Analytics worker            | `services/intelligence-worker/`                       | Arrow/Parquet pipeline, 32 tests green            |
| Competitive Pulse metrics   | `docs/intel/metric-catalog/competitive-pulse-v1.md`   | Written contracts, no live connector behind them  |
| Worker protocol             | `contracts/proto/agentintel/v1/worker.proto`          | Stable, versioned, generates Go / Python / TS     |

### Does not exist

Social platform connectors. Not one. `brand-presence.ts` checks whether a
profile page is _reachable_; it reads no posts, no followers, no engagement.
Every social metric in the catalog is a contract with nothing behind it.

That is the honest starting line.

---

## 2. The one rule that shapes everything

Both lineages independently converged on the same discipline, and it is the
most valuable asset in this repository:

> **An absent measurement is never a zero.**

AGENTintel encoded it as a five-state enum
(`contracts/proto/agentintel/v1/worker.proto:78`):

```
UNSPECIFIED · MISSING · INSUFFICIENT · CONTRADICTORY · AVAILABLE
```

Marketingovo encoded it as typed reachability and as cadence carrying its own
numerator and denominator.

**Decision: unify on the five-state model.** Extend it to every social metric.
`BrandReachability` and the feed-cadence result types become expressions of it
rather than parallel inventions.

This is what makes the product defensible. Competitive-intelligence tools
routinely present a scraped follower count as fact, an engagement rate with an
undisclosed denominator, and a zero where the API simply refused. A tool that
says _"insufficient — 3 of 12 posts lacked a timestamp"_ is more useful to a
marketer making a budget decision than one that confidently reports a number it
invented.

---

## 3. Package and service boundaries

```
packages/
  core/                     existing crawl, SEO, SERP, evidence
  intelligence/             NEW — platform-agnostic intelligence domain
  connectors-social/        NEW — one adapter per platform, no domain logic
  contracts/                extend with intelligence contracts

services/
  intel-daemon/             Go: scheduling, rights/retention policy, run store
  intelligence-worker/      Python: Arrow/Parquet cohort analysis
```

**`packages/intelligence`** owns: the availability model, metric definitions
from the catalog, cohort statistics, share-of-voice, positioning, and gap
analysis. It never touches a network socket. This is what keeps the metrics
testable and the definitions honest.

**`packages/connectors-social`** owns: authentication, pagination, rate limits,
and the mapping from a platform's payload to observations. Each connector
declares — in a manifest, not in prose — which metrics it can support and under
what terms. `contracts/json-schema/connector-manifest.schema.json` already
exists for exactly this and should be reused.

**Why the split:** the metric catalog says an engagement rate must pair a
numerator with the follower count under "the connector's documented temporal
matching rule." That rule differs per platform. Forcing every connector to
_declare_ its rule, rather than letting it quietly pick one, is the difference
between a comparison and a fabrication.

### Runtime boundaries

The Node path stays the default and complete product. Go and Python are for
work Node should not do:

- **Go daemon** — long-running scheduled collection, lease/lock discipline
  (`internal/daemonlock`), rights and retention enforcement. It already fails
  closed on invalid recovered evidence.
- **Python worker** — cohort analysis over large local observation sets, where
  Arrow/Parquet genuinely beats JS.

`pnpm check` remains Node-only; `pnpm check:native` covers the other two. Do
not let the daemon become required for a basic audit — that is precisely the
five-toolchain install AGENTintel warned about, and it is now a live risk.

---

## 4. Social connectors: the part that needs a decision, not code

This is where the project can quietly become something the user cannot ship.

`TO REVERSE ENGINEEER/` holds 50 OSINT projects — Instaloader, sherlock,
minet, zeeschuimer, Osintgram, telegram-tracker. They are excellent, and most
work by scraping against platform Terms of Service. The corpus is correctly
quarantined: gitignored, zero build inputs, guarded by
`scripts/reference-lab-validate.mjs`.

**It must stay that way.** Studying how a problem was solved is legitimate.
Copying implementation from an AGPL scraper into an Apache-2.0 product is a
licence violation, and shipping ToS-violating collection is a product risk that
lands on the user, not on the library author. AGENTintel's own archive note
flags that a clean-room provenance record was _planned and never written_ —
anyone reviving connector work derived from that corpus needs to write it
first.

Proposed tiering, in build order:

**Tier 1 — owned and first-party.** The project's own accounts via official
APIs: Meta Graph, LinkedIn, YouTube Data, Reddit, X. BYOK, user's own
credentials, full metric fidelity. Uncontroversial and immediately useful.

**Tier 2 — public and permitted.** What competitors publish deliberately: RSS/
Atom (already built), sitemaps, YouTube public data, Reddit public API, open
web mentions. This is where competitive intelligence actually lives, and it is
defensible.

**Tier 3 — licensed providers.** DataForSEO, SerpAPI and similar for SERP,
share-of-voice and ad intelligence. The provider carries the compliance burden.
`packages/core/src/integrations/research-provider-fetch.ts` already has the
BYOK pattern.

**Tier 4 — user-supplied exports.** A marketer's own platform data export. The
`competitive-pulse-import-v1` fixture and the whole `imports.py` /
`internal/domain/imports.go` path already handle this: validated, schema'd,
rights-tagged. This is the highest-fidelity social data the product can get
without touching a scraper, and **the pipeline for it is already built and
tested.**

**Explicitly out:** authenticated scraping, credential-based collection against
platforms the user does not own, and anything requiring bot-detection evasion.

Tier 4 is the recommended starting point. It is the shortest path from
"contracts with nothing behind them" to a real social metric, and it reuses
~2,000 lines of already-green code.

---

## 5. Competitive intelligence and market analysis

Concrete capabilities, each tied to something that exists:

**Share of voice.** SERP visibility across a keyword set per competitor.
Builds on the existing rank tracking, which already "refuses to fabricate a
position."

**Positioning map.** Where each competitor is strong: topic clusters
(`cluster.ts`) crossed with rank and cadence. Answers "what do they own that we
do not."

**Publishing and content strategy.** Cadence (built) plus format mix and topic
mix from the catalog. Answers "what are they actually investing in."

**Movement detection.** The compare engine (`compare.ts`) generalized from
"two audits of my site" to "this competitor across time." New pages, new
keywords, abandoned topics, cadence changes. This is the highest-value feature
and the engine is already written.

**Market sizing.** Trends plus SERP breadth plus PAA/related-searches
(`paa.ts`, `related-searches.ts`) to size topic demand. Must carry explicit
confidence — it is inference, not measurement, and should be labelled as such.

**Market analysis must never present inference as observation.** The metric
catalog's prohibited-interpretation clauses (followers ≠ customers ≠ revenue)
should extend to every derived market metric.

---

## 6. Dashboard surfaces

Existing pages to extend rather than replace: `competitors.tsx`,
`overview.tsx`, `keywords.tsx`, `reports.tsx`.

New: **Intelligence** (cross-competitor comparison), **Signals** (movement over
time), **Market** (demand and sizing).

The dashboard already has the right primitive — `data-state.tsx` — which
renders typed unavailability instead of an empty chart. Every new surface must
use it. A social dashboard that renders "0 followers" when an API call failed
would discard the single thing that makes this product trustworthy.

AGENTintel's four plugin commands (`intel-research`, `intel-compare`,
`intel-evidence`, `intel-status`) are preserved in git history and are a
reasonable starting shape for the agent-facing surface.

---

## 7. Sequencing

1. **Unify the evidence model.** Five-state availability across `packages/core`
   and the new `packages/intelligence`. Foundational; everything else assumes it.
2. **Stand up `packages/intelligence`** with the catalog metrics implemented
   against fixtures only. No network. Provable correctness first.
3. **Wire Tier 4 imports end to end** — export file to dashboard. Reuses the
   built import pipeline and produces the first real social metric.
4. **Tier 1 connectors**, one platform end to end before the second.
5. **Movement detection** generalized from `compare.ts`.
6. **Decide the daemon's role.** Whether scheduled collection is core or
   optional determines whether Go stays.

Steps 1–3 need no new external dependency, no credentials, and no ToS
exposure.

---

## 8. Open decisions

**Proto and Python identity.** The wire package is still `agentintel.v1` and
the Python package `agentintel_worker`. Deliberately left alone during the
merge — renaming a working protocol is churn with real breakage risk and no
user-visible gain. Worth doing once, before the first external consumer.

**Does the Go daemon earn its place?** It is genuinely good — lease discipline,
fail-closed recovery, rights enforcement. But it is a second runtime for
scheduling. If scheduled collection turns out not to be core, this decision
should be revisited honestly rather than defended because the port is done.

**Where does market analysis stop?** Sizing and forecasting drift toward
inference. The project's credibility rests on not doing that silently.

**Clean-room provenance.** Still unwritten. Required before any connector work
derived from studying the corpus.

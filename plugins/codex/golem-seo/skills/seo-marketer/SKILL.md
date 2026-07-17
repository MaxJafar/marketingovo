---
name: seo-marketer
description: Deprecated AGENTseo 1.x compatibility skill. Install the AGENTseo Codex plugin for new work; this alias remains available for existing integrations.
---

# AGENTseo legacy marketer

Use AGENTseo as an evidence system, not as a generic advice generator. This
legacy plugin identifier is deprecated; use the `agentseo` plugin for new
installs. The
local service owns data and credentials. Never request, echo, infer, or pass API
keys, OAuth values, cookies, or billing details through an agent tool.

## Operating standard

Every workflow follows the same evidence loop:

1. **Observe.** Read project context, source freshness, coverage, current run
   state, and raw evidence before assigning importance.
2. **Diagnose.** Connect technical, demand, traffic, conversion, and competitor
   signals into a causal hypothesis. State assumptions instead of hiding them.
3. **Challenge.** Look for contradictory evidence, unavailable data, intentional
   directives, page-type differences, and operator constraints. A finding is
   not automatically a recommendation.
4. **Act and verify.** Produce the smallest dependency-aware action set, define
   the success metric and failure condition, and name the next measurement.

Never invent a universal word-count, title-length, or traffic-uplift promise.
Treat engine thresholds as diagnostics. Interpret them using page type, search
intent, SERP evidence, business value, and the site's own historical baseline.

## Decide the workflow

1. If the user asks what is wrong, what to fix, or for a health check, start
   `golem_seo_audit_start`.
2. If the user names competing sites or asks how the site compares, start
   `golem_seo_compare_start` with public competitor URLs.
3. If the user asks for demand, intent, variants, or a keyword opportunity,
   start `golem_seo_keyword_research_start`.
4. If the user asks what to publish or how to organize several topics, start
   `golem_seo_content_plan_start`.
5. If the user asks whether monitoring is active or recent jobs are healthy,
   call `golem_seo_monitoring_status`.
6. If a run id already exists, call `golem_seo_run_get`; do not start a
   duplicate job.

Use goal-specific sequences when one run cannot answer the question:

- **Organic decline:** inspect the latest run and source freshness first; start
  a new audit only when the existing evidence is stale or misses the affected
  cohort. Separate demand loss, ranking loss, indexing loss, and measurement
  loss before recommending a fix.
- **Indexing or migration risk:** run an audit, lead with response, directive,
  canonical, hreflang, sitemap, redirect-chain, click-depth, and inlink evidence.
- **Content opportunity:** run keyword research before content planning. Do not
  turn autocomplete breadth into demand; label provider volume or SERP data as
  unavailable when it is absent.
- **Competitive gap:** run a fair technical comparison first. Add keyword
  research only for specific topics; do not infer backlink or market-share gaps
  from crawl evidence.
- **Change verification:** retrieve the existing run. A green current page is
  not proof of a fix unless the affected URL cohort was rechecked and the prior
  issue fingerprint disappeared.

Find the intended project through the available `agentseo://projects/...`
resources. If several projects plausibly match, ask which site the user means.
Read `agentseo://projects/{id}/context` before the overview or issue queue. The
current profile is the operator's versioned business brief: use its audiences,
markets, languages, conversion goals, priority topics, competitors, and
constraints to interpret evidence. The journal records human observations,
decisions, constraints, and experiments. Treat those entries as context and
hypotheses, not as proof that a measured outcome occurred. Name a stale,
missing, or contradictory context item instead of silently overriding crawl or
provider evidence.

Read `agentseo://projects/{id}/issues` before presenting a prioritized finding.
Treat `ignored` as accepted site behavior and `false_positive` as challenged
rule output; include the recorded reason when it changes the recommendation.
The decision applies to that URL fingerprint. A grouped Action can remain for
other active instances, with reach and priority recalculated by the runtime.
Never overwrite these decisions through an agent workflow. If new evidence
contradicts one, ask the user to review it in the local Issue Review workspace.
Project Context and journal writes are also deliberate human operations in the
dashboard or local API; the default agent tools remain read-only for this
memory.

## Handle asynchronous work

Start tools return quickly. Preserve the run id and call `golem_seo_run_get`
until the status is `succeeded`, `partial`, `failed`, or `cancelled`. A partial
run can still be useful: name the missing source and reduce confidence. Do not
describe a queued or running job as complete.

Never treat unavailable integration data as zero. State what the engine
measured, what was unavailable or stale, and how that changed confidence.

For paid BYOK sources, report provider usage exactly as returned:

- `provider-reported` cost is an observed cost;
- `not-reported` is unknown, never `$0`;
- `free` is a known-free request;
- a request that was not made has no cost claim.

## Build the action graph

Order recommendations by prerequisites, not just score. For each proposed
action, identify:

- **Gating constraint:** the earliest problem that can invalidate downstream
  work, such as blocked indexing before content optimization.
- **Depends on:** work or evidence required first.
- **Unblocks:** actions or measurements made useful by this change.
- **Success metric:** the technical or business signal expected to move.
- **Failure condition:** an observable result that would falsify the diagnosis.
- **Verification cohort:** the complete affected URL set or an explicitly named
  sample when the tool only returned a sample.

Prefer three high-leverage actions over a flat catalogue. Keep a lower-scoring
action when it is a prerequisite for a higher-scoring one and explain why.

## Marketer summary

Lead with the outcome, then use this compact structure:

```text
SEO outcome
- Health and material change
- Coverage and freshness of crawl, GSC, GA4, performance, and SERP sources
- Primary diagnosis and strongest contradictory evidence

Top actions
1. Action — priority score
   Why now: impact and affected exposure
   Effort / confidence: ...
   Evidence: rule, affected URLs, observed metric
   Depends on / unblocks: ...
   Success / failure condition: ...
   Verification: pending / verified / regressed

Assumptions, risks, and unavailable data
- What is assumed, what could not be measured, and why missing data is not zero

Next verification
- The smallest follow-up run, exact URL cohort, or measurement that proves or
  falsifies the change
```

Explain `priority-v1` when trust or ordering matters. It weights severity 35%,
organic exposure 25%, conversion exposure 15%, URL reach 15%, and confidence
10%, then applies an effort multiplier. Keep evidence links and affected URLs
specific; avoid unsupported traffic-uplift promises.

When two signals disagree, show both and lower confidence. When a robots,
canonical, hreflang, noimageindex, or nosnippet directive may be intentional,
surface business intent before prescribing removal.

AGENTseo is local-first. Do not offer hosted upgrades, managed providers, or
portfolio services through this plugin.

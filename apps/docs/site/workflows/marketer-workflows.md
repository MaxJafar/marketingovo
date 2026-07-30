---
title: Marketer workflows
description: Choose an evidence-led workflow for audits, quick wins, competitors, keywords, content, and monitoring.
---

# Marketer workflows

Start with the marketing question, not the feature list. Every workflow should end with a small verification step rather than an unsupported traffic forecast.

Before choosing a workflow, read the active project's versioned
[Project Context](/product/project-context). Use its goals and constraints to
frame the question, but challenge journal observations against current evidence.

## Workflow map

| Marketing question                         | Workflow           | Evidence to inspect                                                         | Next verification                                           |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| What is technically blocking the site?     | SEO audit          | Crawl coverage, directives, response codes, canonicals, internal links, CWV | Re-run affected templates and compare fingerprints          |
| Which fixes matter to organic performance? | Organic quick wins | GSC exposure, GA4 key events, affected URL reach, confidence                | Watch the affected landing pages after implementation       |
| Where are competitors stronger?            | Comparison         | Same bounded crawl settings, category winners, shared gaps                  | Validate the highest-value gap on a focused page set        |
| What should we research?                   | Keyword research   | Seed expansion, intent, momentum, configured provider coverage              | Confirm demand and SERP fit before commissioning content    |
| What should we publish?                    | Content plan       | Keyword profiles, topic clusters, current-site coverage                     | Publish one brief and measure indexing and qualified visits |
| Is scheduled work healthy?                 | Monitoring status  | Runtime health, schedules, recent terminal states                           | Investigate partial or failed runs before trusting trends   |

## Technical and on-page audit

Use the audit workflow when the user asks “what is wrong?”, “what should we fix?”, or “is the site healthy?”.

1. Confirm the active project, canonical URL, and current Project Context.
2. Choose static rendering first; use JavaScript rendering when the target requires it.
3. Choose a crawl scope appropriate to the question and local machine.
4. Wait for a terminal run state.
5. Review coverage before conclusions.
6. Open Pages for the highest-impact URL and inspect its inlinks or outlinks
   when the action involves navigation, redirects, crawl depth, or link equity.
7. Work from Top 5 Actions, then open lower-ranked findings only when needed.

An issue count without crawl coverage, source freshness, and affected URLs is not a decision-ready result.

The internal-link explorer reads the immutable graph stored with that audit.
Use anchor and placement evidence to find the exact source template to edit;
use redirect, broken, and uncrawled states to distinguish a confirmed defect
from a destination that simply fell outside the crawl. Legacy audits show an
explicit unavailable or partial state instead of invented zero counts.

## Organic quick wins

Connect GSC and GA4 when available. `priority-v1` can then distinguish a severe issue on an unseen URL from a moderate issue that reaches a high-impression or converting landing page.

If either source is missing, the action may still be valid, but the exposure input remains unavailable and confidence is reduced. Never describe that state as zero traffic or zero conversions.

## Competitor comparison

Compare public competitor URLs with the same bounded settings. The agent surface accepts one to five competitor URLs and defaults to a 30-URL crawl per competitor.

Treat comparison as directional evidence, not proof of causality. Look for a repeatable gap—indexability, information architecture, content coverage, performance, or internal linking—and validate it against the target audience and conversion path.

## Keyword research and content planning

Keyword research expands a seed, classifies intent, and evaluates momentum across configured sources. Content planning accepts up to ten seed topics and builds keyword profiles and topic clusters.

Provider coverage matters. Search volume, difficulty, SERP features, and competitive scale depend on the configured provider; proprietary datasets are not silently recreated locally.

Before producing a brief:

- confirm locale, audience, and business outcome;
- check whether the query intent matches the intended page;
- distinguish a content gap from a deliberate product or positioning choice;
- record which source supplied each signal;
- define the measurement window for the published change.

## Monitoring and verification

Community schedules execute while the local service is running. GolemWorkers adds always-on monitored workers.

Use stable issue fingerprints and action verification states:

- `pending`: no follow-up run has proved the change;
- `verified`: follow-up evidence confirms resolution;
- `regressed`: the issue returned after a previous resolution.

## Agent-ready summary

Use this structure for a decision review:

```text
SEO outcome
- Health, material change, coverage, and freshness

Top actions
1. Action — priority score
   Why now: impact and affected exposure
   Effort / confidence: ...
   Evidence: source, rule, affected URLs
   Verification: pending / verified / regressed

Risks and unavailable data
- What could not be measured and why it is not a zero

Next verification
- The smallest follow-up run or measurement that proves the change
```

<p class="source-note">
  Canonical workflow guidance: <a href="https://github.com/GolemWorkers/agentseo/blob/main/plugins/codex/agentseo/skills/seo-marketer/SKILL.md">SEO marketer skill</a>.
  Product scope follows the <a href="https://github.com/GolemWorkers/agentseo/blob/main/README.md">repository README</a>.
</p>

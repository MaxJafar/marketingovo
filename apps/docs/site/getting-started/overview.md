---
title: What is Golem SEO?
description: Understand the local-first SEO operations model, product boundaries, and core evidence loop.
---

# What is Golem SEO?

Golem SEO is a local-first SEO operations system. It combines technical crawl observations with available search, analytics, performance, and research signals, then turns them into prioritized actions that a marketer can inspect and verify.

The product is deliberately narrower than a claim to replace every mature SEO suite. Its testable promise is that evidence from several sources becomes one explainable action queue.

## The operating loop

```text
Add site → establish context → connect evidence → choose a goal → run workflow
        → review Top 5 Actions → assign or resolve → verify
```

Each run has an explicit state: `queued`, `running`, `succeeded`, `partial`, `failed`, or `cancelled`. A provider that is not configured can make a workflow partial, but it is not reported as a successful measurement or a zero.

## One local authority

The local daemon owns:

- projects, jobs, schedules, and run history;
- SQLite records and report artifacts;
- browser sessions and the local REST API;
- the credential boundary and provider connections;
- workflow execution and normalized evidence.

The React dashboard, CLI, typed SDK, MCP bridge, Codex bundle, and OpenClaw adapter all use this same authority. Agents do not receive provider credentials.

## What marketers get

- a baseline for technical and on-page health;
- URL-level evidence and stable issue fingerprints;
- versioned business/SEO context and an append-only marketer journal;
- organic and conversion context when GSC and GA4 are available;
- transparent `priority-v1` ordering;
- comparison, keyword, content-plan, report, and monitoring workflows;
- clear freshness and source-availability states;
- a re-audit path to verify that work had the intended technical effect.

## Product boundary

Community Edition is a local, single-user product with analysis limited only by the resources of the machine and the provider access you bring. GolemWorkers is a separate proprietary service for always-on execution, collaboration, managed providers, portfolio operations, hosted artifacts, approval workflows, and commercial support.

The commercial value is infrastructure and collaboration—not deliberately incomplete local analysis.

## License boundary

<div class="license-note">
  Community Edition is <strong>source-available under Elastic License 2.0</strong>. It is not OSI-approved open source. The license permits use, copying, distribution, and modification subject to its terms, including the restriction on providing substantial product functionality to third parties as a hosted or managed service.
</div>

Read the license itself before relying on a summary. Product names and marks have separate terms.

## Where to go next

- [Start and complete the first onboarding flow](/getting-started/quickstart)
- [Choose a marketer workflow](/workflows/marketer-workflows)
- [Understand the action score](/product/dashboard-actions)
- [Create durable Project Context](/product/project-context)
- [Compare Community and GolemWorkers](/product/editions)

<p class="source-note">
  Canonical sources: <a href="https://github.com/GolemWorkers/golem-seo/blob/main/README.md">product README</a>,
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/docs/architecture.md">architecture</a>,
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/LICENSE">Elastic License 2.0</a>, and
  <a href="https://github.com/GolemWorkers/golem-seo/blob/main/TRADEMARKS.md">trademark policy</a>.
</p>

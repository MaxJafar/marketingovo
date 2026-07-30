---
title: Reference-tool audit
description: See how AGENTseo evaluates public SEO tools, preserves license boundaries, and turns proven workflows into testable product behavior.
---

# Reference-tool audit

AGENTseo studies public products to identify durable workflow mechanics, not to
assemble a clone. Every candidate is screened for marketer value, evidence
quality, architectural fit, security, and license compatibility.

## What changed in the Audit Intelligence Pack

The 2026-07-15 reference audit produced these connected improvements:

- source-aware internal redirect, click-depth, inlink, and orphan evidence;
- mobile, DOM, image, directive, and hreflang diagnostics with visible
  thresholds and intent states;
- exact URL cohort audits for migrations, template QA, and verification; and
- provider economics that distinguish observed cost, unknown paid cost, and a
  known-free request; and
- versioned Project Context with an append-only marketer decision journal,
  read-only MCP access, and secret-safe project transfer.
- a versioned audit evidence workbench for crawl paths, redirect chains,
  reciprocal hreflang, sitemap coverage, and bounded custom extraction values.
- idempotent local replay that copies a terminal run's stored configuration
  into a new immutable run and exposes a versioned configuration hash.
- immutable audit comparison that separates regressions from verified fixes
  without rewriting older issue observations, plus a separately versioned
  internal-link delta with explicit graph coverage and neutral intent states.
- an immutable page-level inlink/outlink explorer with anchor, placement,
  follow/nofollow, redirect, broken-target, search, and pagination evidence.
- a project-scoped custom extraction editor with immutable revisions,
  bounded CSS/regex validation, exact-origin live preview, and rule snapshots
  that remain stable through audit replay.
- a versioned extraction-template catalog whose assumptions, selectors, and
  capture modes must be reviewed before fresh rules enter an unsaved draft.

The sitemap panel distinguishes unavailable capture from a measured empty set.
The hreflang matrix uses the same reciprocity model as the checks, including the
source page's self-declared language on return links. Section results are
server-paginated and always show the complete matching total.

The Pages explorer is also server-computed. New audits retain bounded link
observations in the portable page snapshot and normalize an indexed local graph
for fast inlink and outlink queries. Legacy runs report unavailable rather than
zero; replay creates a new graph without changing the source audit.

Audit comparison reuses that immutable graph. It reports exact added, removed,
and modified source-to-target edges, while classifying only captured broken-link
creation or recovery as directional impact. Editorial edits and uncrawled
destinations remain neutral until a marketer reviews intent.

The Codex marketer workflow also requires a causal hypothesis, contradictory
evidence, action dependencies, a success metric, and a falsifiable failure
condition.

## License-safe boundary

MIT projects can be adapted with their notices. AGPL and GPL projects were used
only to understand observable behavior; no implementation code, tests, text, or
assets from them were copied into Community Edition.

| Reference                                                       | License  | High-value behavior selected                                          |
| --------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| [Open SEO](https://github.com/every-app/open-seo)               | MIT      | Actual provider cost, explicit source routing, shared project context |
| [Seonaut](https://github.com/stjudewashere/seonaut)             | MIT      | Composable reporters, depth, markup, and local replay behavior        |
| [Claude SEO](https://github.com/AgricIDaniel/claude-seo)        | MIT      | Evidence-first agent routing and quality gates                        |
| [SiteInspector](https://github.com/siteinspector/siteinspector) | AGPL-3.0 | Issue adjudication and content-QA behavior only                       |
| [Greenflare](https://github.com/beb7/gflare-tk)                 | GPL-3.0  | Exact-list crawl and extraction-workbench behavior only               |
| [SEO Macroscope](https://github.com/nazuke/SEOMacroscope)       | GPL-3.0  | Click paths, redirect sources, and matrix artifacts only              |

## Claims remain testable

A threshold is a diagnostic, not a ranking guarantee. Missing provider cost is
not `$0`. An intentional directive is not automatically a defect. A current
green page is not verified until the affected cohort is rechecked and the prior
issue fingerprint disappears.

Read the complete commit-pinned matrix, adopted mechanics, deferred queue, and
implementation contracts in the
[canonical reverse-engineering record](https://github.com/GolemWorkers/agentseo/blob/main/docs/reference-tool-reverse-engineering.md).

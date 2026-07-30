---
title: Dashboard and priority-v1
description: Navigate the local control panel and understand how AGENTseo ranks evidence-backed actions.
---

# Dashboard and priority-v1

The dashboard is a decision surface over the local REST API. It does not carry a second data model, and it does not replace unavailable measurements with sample values.

## Information architecture

| Workspace              | Decision it supports                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Overview**           | What changed, what matters, and which five actions deserve attention now?              |
| **Project context**    | Which audiences, markets, goals, constraints, and decisions should frame the evidence? |
| **Actions**            | What is the full prioritized backlog, and why is each item ranked there?               |
| **Issue review**       | Which findings are actionable, intentional, resolved, or verified false positives?     |
| **Audits**             | Which runs are queued, running, partial, complete, failed, or cancelled?               |
| **Pages**              | Which URLs connect technical observations to traffic and conversion context?           |
| **Keywords & content** | Which queries, intents, and clusters create a credible content opportunity?            |
| **Competitors**        | Where do configured competitors have observable visibility or coverage advantages?     |
| **Monitoring**         | Are schedules active, and do recent alerts or runs require investigation?              |
| **Reports**            | Which completed snapshots are ready to share or export?                                |
| **Integrations**       | Which source is connected, stale, degraded, or not configured?                         |
| **Settings**           | What project and reporting context applies to the active site?                         |
| **System health**      | Is the local API, database, worker queue, and connector layer healthy enough to trust? |

The active-site selector changes the context for every project-specific workspace. System health is global to the local daemon.

Completed audits expose authenticated, same-origin HTML, PDF, CSV, and JSON
downloads in Reports. A missing artifact stays unavailable; the dashboard does
not redirect an authenticated report action to another origin.

Project Context is versioned human memory, not an analytics source. Read the
[profile and append-only journal](/product/project-context) before interpreting
an Action, then challenge human observations against current crawl coverage,
freshness, and provider evidence.

## Honest data states

<div class="data-state-grid">
  <div><strong>Zero</strong><span>The source measured the value and it was zero.</span></div>
  <div><strong>Missing</strong><span>The measurement or required baseline does not exist.</span></div>
  <div><strong>Stale</strong><span>A prior observation exists, but freshness is outside the expected window.</span></div>
  <div><strong>Unavailable or failed</strong><span>The provider was not configured, could not be reached, or returned an error.</span></div>
</div>

The UI shows freshness notices, source health, and unavailable labels. A valid empty action list is not presented as a perfect site.

## What every action should explain

An action is useful only when the operator can inspect:

- title and “why now” explanation;
- normalized impact and expected effort;
- confidence and missing inputs;
- priority score and scoring version;
- affected URL reach;
- source evidence and observation time;
- owner, work state, and verification state.

Top 5 is a focus view, not a deletion of the rest of the queue. The full Actions workspace remains available.

## Review findings without erasing evidence

Issue Review keeps rule output and human judgment separate. Search by title,
rule, module, fingerprint, or canonical URL; filter by severity and effective
status; then inspect the evidence and occurrence history before deciding.

- **Keep actionable** removes a manual override.
- **Ignore intentionally** means the behavior exists and is accepted for this
  site.
- **Mark false positive** means the rule does not correctly describe the page
  or implementation.

Ignored and false-positive decisions require a reason and explicit
confirmation. They remain project-scoped and reversible, persist on later
audits, and leave every raw run and issue instance intact. Reviewing one URL
removes that instance from the grouped Action and recalculates URL reach and
priority. The Action stops appearing only after every active instance in its
rule/module group is reviewed.

## The priority-v1 formula

All raw scoring inputs are normalized to `0..1`.

```text
base = 0.35 × severity
     + 0.25 × organic_exposure_for_score
     + 0.15 × conversion_exposure_for_score
     + 0.15 × url_reach
     + 0.10 × adjusted_confidence

priority_score = 100 × base × effort_multiplier

effort_multiplier:
  low    = 1.00
  medium = 0.75
  high   = 0.50
```

The implementation rounds the final score to one decimal place and clamps normalized inputs to their valid range.

### Severity

The current mapping is:

| Severity | Normalized value |
| -------- | ---------------: |
| Critical |             1.00 |
| High     |             0.80 |
| Medium   |             0.55 |
| Low      |             0.30 |
| Info     |             0.10 |

### Exposure

Organic exposure comes from available GSC context; conversion exposure comes from available GA4 key-event context. Both compare the affected URL set with the highest observed exposure in the project data used by the run.

### URL reach

URL reach is the affected URL count divided by the crawled page count, capped at `1`. A widespread template problem should rank differently from the same rule on one low-reach URL.

### Missing exposure is not zero

When organic or conversion exposure is unavailable, `priority-v1`:

1. keeps the public input as `null`;
2. records its name in `scoreInputs.unavailable`;
3. uses a neutral `0.5` only inside the calculation;
4. reduces confidence by 12% for each unavailable exposure input.

The neutral estimate prevents an unconnected provider from silently pushing every affected action to the bottom. It is not an observed metric and must remain labelled unavailable in the UI.

### Impact and rank bands

Impact is calculated separately from severity and exposure:

```text
impact = 0.50 × severity
       + 0.30 × organic_exposure_for_score
       + 0.20 × conversion_exposure_for_score
```

The dashboard adapter currently labels scores `80+` critical, `60+` high, `35+` medium, and lower scores low. Rank is a triage aid, not a forecast of incremental traffic or revenue.

## Read an action responsibly

1. Confirm the run and source freshness.
2. Read the affected URLs and evidence.
3. Check which score inputs are unavailable.
4. Challenge the effort estimate with the team that owns implementation.
5. Assign a verification step before work begins.
6. Re-run the narrowest workflow that can prove resolution.

<p class="source-note">
  Canonical sources: <a href="https://github.com/MaxJafar/AGENTseo/blob/main/README.md">priority model summary</a>,
  <a href="https://github.com/MaxJafar/AGENTseo/blob/main/packages/application/src/priority.ts">priority-v1 implementation</a>, and
  <a href="https://github.com/MaxJafar/AGENTseo/blob/main/packages/contracts/src/index.ts">public action contracts</a>.
</p>

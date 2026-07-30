# Marketer case-study template

Use this template for an attributable design-partner or customer story. Replace every bracketed field. Remove sections that cannot be supported by evidence; never fill a gap with an estimated result unless it is labeled as an estimate and the method is disclosed.

## Publication controls

- Organization: `[approved public name or anonymized description]`
- Participant: `[name, title, approved attribution]`
- Approval owner: `[name and date]`
- Measurement window: `[start date]` to `[end date]`
- Comparison window: `[start date]` to `[end date]`
- AGENTseo version: `[version]`
- Evidence owner: `[person responsible for source verification]`
- Confidentiality notes: `[queries, URLs, revenue, or provider data that must remain private]`

## Headline

`How [team] used AGENTseo to [verified workflow outcome] across [scope]`

Prefer workflow outcomes such as “cut weekly triage time,” “assign the top five technical actions,” or “verify a canonical cleanup.” Do not use a traffic or revenue headline unless attribution and comparison controls support it.

## Executive summary

`[Organization] manages [site or portfolio context]. The team used AGENTseo [AGENTseo / AGENTseo] to combine [available sources], prioritize [issue class], assign [number] actions, and verify [number] changes over [time window].`

**Measured result:** `[one primary result with unit, baseline, end value, and source]`

**Why it matters:** `[one sentence in the participant’s language]`

## Before AGENTseo

Describe the workflow, not a caricature of another tool.

- Team and responsibility: `[who did what]`
- Site/portfolio scope: `[URLs, markets, properties]`
- Audit cadence: `[frequency]`
- Inputs available: `[crawl, GSC, GA4, performance, SERP, other]`
- Decision bottleneck: `[triage, ownership, evidence, verification, reporting]`
- Baseline time or quality measure: `[value and collection method]`
- Known source gaps: `[unavailable or stale sources]`

## The testable question

`Can [team] use an evidence-backed action queue to improve [workflow measure] without hiding missing data or increasing [guardrail measure]?`

Examples of guardrails:

- high-severity false positives;
- time spent validating actions;
- regressions introduced by a fix;
- unassigned actions after one week;
- stale provider evidence used in a decision.

## Setup

| Item                   | Recorded value                  |
| ---------------------- | ------------------------------- |
| Edition                | `[Community / Full]`            |
| Version                | `[exact version]`               |
| Project scope          | `[site count and URL scope]`    |
| Crawl mode             | `[static / JavaScript / mixed]` |
| Connected sources      | `[list with connection date]`   |
| Unavailable sources    | `[list and reason]`             |
| Audit/run IDs          | `[identifiers]`                 |
| Custom rules           | `[none or linked definition]`   |
| Priority score version | `[for example, priority-v1]`    |
| People with access     | `[roles, not personal data]`    |

## Workflow

1. **Baseline audit:** `[date, run ID, scope, terminal state]`
2. **Triage:** `[how Top 5 Actions were reviewed and challenged]`
3. **Assignment:** `[owner, due date, acceptance condition]`
4. **Change:** `[what was changed outside AGENTseo]`
5. **Verification audit:** `[date, run ID, comparable scope]`
6. **Decision:** `[verified, still present, regressed, or inconclusive]`

For each published action, include:

- title and issue class;
- impact, effort, confidence, and priority score;
- the score inputs that were available;
- affected URL count;
- evidence excerpt or artifact link;
- source state and freshness;
- verification condition and final state.

## Results scorecard

| Measure                       | Baseline | End state | Change | Source                      | Confidence/caveat         |
| ----------------------------- | -------: | --------: | -----: | --------------------------- | ------------------------- |
| Weekly triage time            |    `[ ]` |     `[ ]` |  `[ ]` | `[calendar/time log]`       | `[ ]`                     |
| Actions reviewed              |    `[ ]` |     `[ ]` |  `[ ]` | `[action history]`          | `[ ]`                     |
| Actions assigned              |    `[ ]` |     `[ ]` |  `[ ]` | `[action history]`          | `[ ]`                     |
| Actions verified              |    `[ ]` |     `[ ]` |  `[ ]` | `[comparison runs]`         | `[ ]`                     |
| High-severity false positives |    `[ ]` |     `[ ]` |  `[ ]` | `[manual review]`           | `[ ]`                     |
| Organic exposure metric       |    `[ ]` |     `[ ]` |  `[ ]` | `[GSC, exact query/window]` | `[seasonality, coverage]` |
| Conversion exposure metric    |    `[ ]` |     `[ ]` |  `[ ]` | `[GA4, exact event/window]` | `[attribution limits]`    |

Do not combine measured workflow improvement with inferred business impact in one number.

## Claim classification

Label each external claim:

- **Measured:** directly observed with a named source and method.
- **Inferred:** a reasoned interpretation; explain assumptions.
- **Qualitative:** participant opinion or workflow feedback.
- **Unavailable:** not measured or not comparable.

## Participant quote

`“[Approved quote about the decision or verification workflow.]”`

Approval record: `[approver, date, permitted channels]`

Avoid scripting a result the participant did not independently confirm.

## What did not work

- `[source that was unavailable or stale]`
- `[action that did not verify]`
- `[workflow step that required manual work]`
- `[product limitation discovered]`

Explain how these constraints changed confidence or the final decision.

## Edition context

If the local edition was used, state that it is local-first and open source under the Apache License 2.0.

If AGENTseo was used, describe only the managed services actually used, such as always-on monitoring, shared portfolios, RBAC, managed integrations, or hosted reports. Full is a separate proprietary service.

## Reproduce the workflow

Community CTA:

```bash
npx @agentseoapp/cli serve
```

Source and quickstart: https://github.com/MaxJafar/AGENTseo

Managed team workflow: https://github.com/MaxJafar/AGENTseo

## Final evidence review

- [ ] Every number has a source, date range, unit, and baseline.
- [ ] Compared audits use compatible scope and settings.
- [ ] Source freshness and unavailable data are disclosed.
- [ ] Inference is separated from measurement.
- [ ] Participant attribution and quote are approved.
- [ ] Screenshots are redacted and marked if they use demo data.
- [ ] Edition and license language is accurate.
- [ ] The story does not claim causation from a before/after observation alone.

# AGENTseo launch kit

This directory contains the English launch narrative for AGENTseo `0.11` alpha. The assets are ready to adapt for GitHub, LinkedIn, X, a short product demo, engineering content, marketer case studies, and a six-week build-in-public cycle.

## Launch thesis

SEO audits are easy to generate. Deciding what deserves attention, explaining why, assigning the work, and verifying the result are the harder parts.

AGENTseo is a local-first SEO operations system that turns crawl and connected marketing evidence into a transparent action queue. Each action can carry impact, effort, confidence, affected URLs, evidence, and a verification state.

The current release is `0.11` alpha. It is intended for design partners and contributors while installation, migrations, security corpora, accessibility, packaging, and the public correctness benchmark move toward the 1.0 gates.

## Canonical claims

Use these claims consistently:

- AGENTseo is **open source under the Apache License 2.0**.
- Community is local-first, requires no product account, and has telemetry off by default.
- Community analysis is not intentionally limited; project and audit scale depends on the machine running it.
- The product is designed around actions, evidence, source state, prioritization, ownership, and verification rather than a flat issue dump.
- Missing provider data remains unavailable or stale and must not be presented as zero.
- Dashboard, CLI, REST, MCP, Codex, and OpenClaw use the same runtime contracts.
- GolemWorkers Full is a separate proprietary service for managed infrastructure and collaboration: always-on execution, portfolios, teams and RBAC, managed integrations, hosted artifacts, retention, and commercial support.
- Community exports exclude credentials. Integrations must be reconnected after import.

Do not claim that `0.11` replaces mature commercial SEO suites, that every provider path has cleared production readiness, or that the 1.0 quality gates have already passed.

## CTA hierarchy

1. **Install and run locally**

   ```bash
   npx @agentseoapp/cli serve
   ```

2. **Star or inspect the source**

   [github.com/GolemWorkers/agentseo](https://github.com/GolemWorkers/agentseo)

3. **Try GolemWorkers Full** when the buyer needs always-on workflows, portfolio scale, managed integrations, teams, or commercial support.

   [golemworkers.com/seo](https://golemworkers.com/seo)

## Asset map

| Asset                                                           | Primary audience                 | Best use                        | Primary CTA                      |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------- | -------------------------------- |
| [Founder LinkedIn post](founder-linkedin-post.md)               | Founders, marketers, operators   | Launch-day personal post        | Install and star                 |
| [Eight-slide carousel](linkedin-carousel.md)                    | Marketers and agency teams       | Visual launch explainer         | Save, share, install             |
| [X launch thread](x-launch-thread.md)                           | Builders and technical marketers | Fast product narrative          | Star and try locally             |
| [Demo script and storyboard](demo-script-storyboard.md)         | Mixed launch audience            | 60–90 second screen recording   | Run the quickstart               |
| [Engineering deep dive](engineering-deep-dive-outline.md)       | Engineers and agent builders     | Technical article or livestream | Inspect contracts and contribute |
| [Marketer case-study template](marketer-case-study-template.md) | Design partners and customers    | Evidence-backed workflow story  | Reproduce the workflow           |
| [Six-week public calendar](build-in-public-calendar.md)         | Founder and product team         | Sustained launch cadence        | Alternate install, star, Full    |

## Channel rules

- Lead with the user decision, not the feature inventory.
- Put the alpha qualifier near the first product claim, not in fine print.
- Use one primary CTA per post and move secondary links to a reply or final frame.
- Show real UI, real terminal output, or a clearly labeled fixture. Never present a staged result as customer evidence.
- Redact project names, queries, URLs, credentials, tokens, account identifiers, and provider errors before recording.
- When quoting a result, include the source window, audit/run identifier, comparison method, and source state.
- Use “Community Edition” and “GolemWorkers Full” exactly; do not imply that Full is hidden inside the Community repository.

## Link and tracking pattern

Use the canonical links above. Add channel-specific UTM parameters only at publication time so the committed copy remains readable.

Suggested campaign values:

```text
utm_campaign=agentseo-alpha-launch
utm_source=linkedin | x | github | demo
utm_medium=organic-social | repository | video
utm_content=<asset-and-variant>
```

## Pre-publish checklist

- [ ] Every sentence is English.
- [ ] `0.11 alpha` is visible.
- [ ] The license is described as Apache-2.0 open source.
- [ ] Community and GolemWorkers Full are clearly separated.
- [ ] Product footage contains no secrets or private customer data.
- [ ] Metrics have a source, date range, baseline, and caveat.
- [ ] The primary CTA is install, star, or try Full.
- [ ] GitHub and Full links resolve.
- [ ] Image and video alt text is included.
- [ ] Claims still match [release status](../docs/release-status.md) and [edition comparison](../docs/editions.md).

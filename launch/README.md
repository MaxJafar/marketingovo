# Marketingovo launch kit

This directory contains the English launch narrative for Marketingovo `1.1.0`. The assets are ready to adapt for GitHub, LinkedIn, X, a short product demo, engineering content, marketer case studies, and a six-week build-in-public cycle.

## Launch thesis

SEO audits are easy to generate. Deciding what deserves attention, explaining why, assigning the work, and verifying the result are the harder parts.

Marketingovo is a local-first SEO operations system that turns crawl and connected marketing evidence into a transparent action queue. Each action can carry impact, effort, confidence, affected URLs, evidence, and a verification state.

## Canonical claims

Use these claims consistently. Every one of them is checkable against the repository.

- Marketingovo is **open source under the Apache License 2.0**.
- It is local-first, requires no product account, and has telemetry off by default.
- **There is one edition.** No paid tier, no hosted service, no commercial support contract, and no capability withheld to sell later. Everything in the repository is available to everyone.
- Analysis is not intentionally limited; project and audit scale depends on the machine running it.
- The product is designed around actions, evidence, source state, prioritization, ownership, and verification rather than a flat issue dump.
- Missing provider data remains unavailable or stale and must not be presented as zero.
- Dashboard, CLI, REST, MCP, Codex, and OpenClaw use the same runtime contracts.
- Exports exclude credentials. Integrations must be reconnected after import.

**Do not claim** that Marketingovo replaces mature commercial SEO suites, that every provider path is equally exercised, that signed installers or an npm package exist, or that there is a commercial edition.

## Status language

1.1.0 declares a stable public surface — the REST API and its OpenAPI document, the SDK, the agent contract registry, the CLI, and the `.marketingovo` bundle format. Breaking changes to those require a major version.

Three things are **not** shipped and must not be implied:

- signed desktop installers,
- the Tauri updater channel,
- npm registry publication.

They are declared as deferred channels in [`release/acceptance/1.1.0.json`](../release/acceptance/1.1.0.json), not left to be inferred. Building from source is currently the only install route.

## Launch loop

The launch kit now has a machine-checked readiness and learning loop in
[`launch-loop.json`](launch-loop.json), with the operating rules in
[`launch-loop.md`](launch-loop.md). It separates repository evidence from
audience signals, requires a source window, baseline, target, and caveat for
every metric, and keeps the initial cycle in `ready` state until a human records
real observations. It does not claim that a campaign ran or publish anything.

Run `pnpm validate:launch-loop` to verify the cycle, or `pnpm launch:loop` to
verify it alongside the deterministic benchmark corpus.

## CTA hierarchy

1. **Run it locally from source**

   ```bash
   git clone https://github.com/MaxJafar/marketingovo
   cd marketingovo
   corepack enable && pnpm install && pnpm build
   pnpm marketingovo serve
   ```

2. **Star or inspect the source**

   [github.com/MaxJafar/marketingovo](https://github.com/MaxJafar/marketingovo)

3. **Read what was actually verified**

   [Release status](https://github.com/MaxJafar/marketingovo/blob/main/docs/release-status.md) names every gate with the command that produced it.

## Asset map

| Asset                                                           | Primary audience                 | Best use                        | Primary CTA                      |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------- | -------------------------------- |
| [Founder LinkedIn post](founder-linkedin-post.md)               | Founders, marketers, operators   | Launch-day personal post        | Install and star                 |
| [Eight-slide carousel](linkedin-carousel.md)                    | Marketers and agency teams       | Visual launch explainer         | Save, share, install             |
| [X launch thread](x-launch-thread.md)                           | Builders and technical marketers | Fast product narrative          | Star and try locally             |
| [Demo script and storyboard](demo-script-storyboard.md)         | Mixed launch audience            | 60–90 second screen recording   | Run the quickstart               |
| [Engineering deep dive](engineering-deep-dive-outline.md)       | Engineers and agent builders     | Technical article or livestream | Inspect contracts and contribute |
| [Marketer case-study template](marketer-case-study-template.md) | Design partners and contributors | Evidence-backed workflow story  | Reproduce the workflow           |
| [Six-week public calendar](build-in-public-calendar.md)         | Founder and product team         | Sustained launch cadence        | Alternate install and star       |
| [Launch loop](launch-loop.md)                                   | Founder and product team         | Evidence → feedback → next test | Validate the cycle               |

## Channel rules

- Lead with the user decision, not the feature inventory.
- Put the "source install only" qualifier near the first CTA, not in fine print.
- Use one primary CTA per post and move secondary links to a reply or final frame.
- Show real UI, real terminal output, or a clearly labeled fixture. Never present a staged result as customer evidence.
- Redact project names, queries, URLs, credentials, tokens, account identifiers, and provider errors before recording.
- When quoting a result, include the source window, audit/run identifier, comparison method, and source state.
- Never imply a paid tier, hosted edition, or withheld capability. There is none.

## Link and tracking pattern

Use the canonical links above. Add channel-specific UTM parameters only at publication time so the committed copy remains readable.

Suggested campaign values:

```text
utm_campaign=marketingovo-launch
utm_source=linkedin | x | github | demo
utm_medium=organic-social | repository | video
utm_content=<asset-and-variant>
```

## Pre-publish checklist

- [ ] Every sentence is English.
- [ ] The version stated is `1.1.0`.
- [ ] The license is described as Apache-2.0 open source.
- [ ] No sentence implies a paid tier, hosted edition, or commercial support.
- [ ] No asset tells a reader to run `npx @marketingovo/cli` — it is not published.
- [ ] Product footage contains no secrets or private customer data.
- [ ] Metrics have a source, date range, baseline, and caveat.
- [ ] `pnpm validate:launch-loop` passes and the cycle status matches what was actually observed.
- [ ] The primary CTA is install from source or star.
- [ ] Every GitHub link resolves.
- [ ] Image and video alt text is included.
- [ ] Claims still match [release status](../docs/release-status.md).

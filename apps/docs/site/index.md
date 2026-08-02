---
layout: home

hero:
  name: Marketingovo
  text: Evidence into action.
  tagline: A local-first SEO operations system that connects crawl, search, analytics, performance, and research signals to a transparent action queue.
  image:
    src: /brand-mark.svg
    alt: Marketingovo brand mark
  actions:
    - theme: brand
      text: Start in ten minutes
      link: /getting-started/quickstart
    - theme: alt
      text: See marketer workflows
      link: /workflows/marketer-workflows
    - theme: alt
      text: View source
      link: https://github.com/MaxJafar/marketingovo

features:
  - icon: ↗
    title: Actions, not an issue dump
    details: Rank work by severity, organic and conversion exposure, URL reach, confidence, and effort—then keep the evidence attached.
    link: /product/dashboard-actions
    linkText: Understand priority-v1
  - icon: ◉
    title: Local-first control
    details: The daemon, dashboard, SQLite history, schedules, and credential boundary run on your machine with telemetry disabled by default.
    link: /trust/security-privacy
    linkText: Review the trust model
  - icon: ⌁
    title: Human and agent parity
    details: Dashboard, CLI, REST, MCP, Codex, and OpenClaw use the same runtime contracts and asynchronous run states.
    link: /agents/agent-surfaces
    linkText: Connect an agent
  - icon: ≋
    title: Honest source states
    details: Zero, missing, stale, unavailable, and failed are different. Missing integrations reduce confidence instead of becoming invented performance.
    link: /integrations/byok
    linkText: Connect your sources
  - icon: ✓
    title: Verification loop
    details: Stable issue fingerprints and run history make it possible to verify a fix, detect a regression, and explain what changed.
    link: /workflows/marketer-workflows
    linkText: Follow the workflow
  - icon: ◫
    title: Reusable strategy memory
    details: Versioned Project Context and an append-only journal keep goals, markets, constraints, decisions, and experiments beside the evidence.
    link: /product/project-context
    linkText: Build shared context
  - icon: ◆
    title: Open source, one edition
    details: Everything runs locally under the Apache License 2.0. No paid tier, no hosted service, nothing held back.
    link: /product/release-status
    linkText: See what is verified
---

<div class="status-banner">
  <strong>1.1.0</strong>
  <p>The REST API, OpenAPI document, SDK, agent contract registry, CLI and <code>.marketingovo</code> bundle format are stable. Signed desktop installers, the updater channel, and npm registry publication are not part of this release.</p>
</div>

<div class="edition-callout">
  <a href="/getting-started/quickstart">
    <strong>Run it locally</strong>
    <span>Bring your own provider credentials, keep analysis and history on your machine, and use every product surface.</span>
  </a>
  <a href="/product/release-status">
    <strong>Check what is verified</strong>
    <span>Every release gate is named with the command that produced it, and the deferred channels are declared rather than implied.</span>
  </a>
</div>

<p class="source-note">
  Product positioning and release claims follow the canonical
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/README.md">repository README</a>
  and <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/release-status.md">release status</a>.
</p>

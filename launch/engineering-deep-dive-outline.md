# Engineering deep-dive outline

## Working title

**From SEO findings to verifiable actions: the contracts behind Marketingovo**

## Audience and promise

Audience: TypeScript engineers, agent-platform builders, technical SEOs, and contributors evaluating the `0.11` alpha.

Promise: explain the product’s decision model, runtime boundaries, and honest data-state handling with reproducible code references. Do not frame the article as a production-readiness announcement.

Target length: 2,500–3,500 words or a 30-minute technical talk.

## 1. Start with the failure mode

**Question:** Why does a correct crawler still produce a weak weekly workflow?

Cover:

- issue count versus decision quality;
- why severity without exposure, reach, confidence, effort, and verification is incomplete;
- why the domain object is an action backed by evidence rather than a report row.

Proof artifact: a sanitized issue record beside its derived action record.

## 2. One public contract, several surfaces

Walk through the TypeBox contracts in [`packages/contracts`](../packages/contracts/src/index.ts).

Cover:

- projects, runs, issues, actions, integrations, schedules, and source metadata;
- runtime validation and the cost of letting dashboard, CLI, SDK, MCP, and adapters drift;
- why a versioned `/api/v1` boundary makes agent tools inspectable.

Proof artifact: one action response consumed by two different surfaces.

## 3. Asynchronous work is a state machine

Use [`packages/server`](../packages/server/src/index.ts) and the architecture document as references.

Cover:

- `202 Accepted` and a run identifier;
- queued, running, succeeded, partial, failed, and cancelled states;
- idempotent start requests;
- progress events and terminal-state polling;
- why a partial run should preserve usable evidence without pretending every source succeeded.

Proof artifact: a test or trace showing one complete state transition.

## 4. Missing evidence must remain missing

Define the difference between:

- measured zero;
- unavailable source;
- stale source;
- failed request;
- partial coverage.

Explain why the public value can remain `null` while an internal neutral estimate prevents missing data from collapsing ranking, and why confidence is reduced when exposure inputs are absent.

Proof artifact: two otherwise equal actions, one with measured exposure and one with unavailable exposure.

## 5. A transparent priority heuristic

Use [`packages/application/src/priority.ts`](../packages/application/src/priority.ts).

Show:

```text
base = 0.35×severity
     + 0.25×organic_exposure
     + 0.15×conversion_exposure
     + 0.15×url_reach
     + 0.10×confidence

priority = 100 × base × effort_multiplier
```

Discuss:

- input normalization;
- effort multipliers;
- confidence penalties for unavailable exposure;
- score-version storage;
- why the score orders work but does not predict traffic or revenue.

Proof artifact: a table with the inputs, formula, and computed result for three fixture actions.

## 6. Local security and credential boundaries

Reference [`SECURITY.md`](../SECURITY.md), [`docs/threat-model.md`](../docs/threat-model.md), and [`packages/credentials`](../packages/credentials/src/index.ts).

Cover:

- loopback binding and local authorization;
- one-time browser bootstrap, HttpOnly session, and CSRF for browser mutations;
- service-token files for trusted local clients;
- write-only provider credentials and safe metadata;
- encrypted persistent vault when a master password is supplied;
- egress validation for hostile sites, redirects, DNS changes, and private destinations;
- secrets excluded from reports, logs, exports, and default backups.

Claim boundary: distinguish documented security invariants from release gates still being exercised by the alpha corpus.

## 7. Connector manifests are contracts, not availability claims

Use [`packages/integrations`](../packages/integrations/src/index.ts).

Cover:

- authentication mode, requested scopes, host allowlists, request limits, input/output schemas, and retention policy;
- BYOK in Marketingovo;
- explicit connection, freshness, quota, degraded, expired, and failure states;
- why manifest presence does not prove every provider fixture has cleared the 1.0 gate.

Proof artifact: one connector manifest and one sanitized connection-state response.

## 8. Agent parity without secret access

Use [`packages/mcp`](../packages/mcp/src/index.ts), the Codex skill, and the OpenClaw adapter.

Cover:

- the bounded public tool set;
- read versus mutation boundaries;
- run IDs and duplicate prevention;
- why agents can start and inspect work but cannot connect, rotate, or delete credentials;
- token-file indirection and rotation-safe client creation.

Proof artifact: one MCP tool call and its corresponding REST request/response shape.

## 9. Editions are an infrastructure boundary

Reference [`docs/editions.md`](../docs/editions.md) and [`COMMERCIAL.md`](../COMMERCIAL.md).

Explain:

- Marketingovo as the local-first, single-user product;
- Marketingovo as a separate proprietary service for always-on execution, portfolios, teams/RBAC, managed credentials, hosted artifacts, retention, and support;
- project portability without credential portability;
- why paid value does not require weakening local analysis.

Use the phrase “open source under the Apache License 2.0” for Marketingovo.

## 10. What the alpha does not prove yet

Repeat the public 1.0 gates from [`docs/release-status.md`](../docs/release-status.md):

- security and dependency corpus;
- scheduling crash recovery;
- current provider fixtures and pagination;
- clean install, upgrade, package, MCP, Codex, and OpenClaw smoke coverage;
- WCAG 2.2 AA;
- correctness and false-positive benchmark;
- design-partner case studies.

This section is required. It turns limitations into an inspectable engineering agenda rather than hidden fine print.

## 11. Reproduce the path

End with:

```bash
npx @marketingovo/cli serve
```

Then ask the reader to:

1. inspect the contracts;
2. run one fixture audit;
3. trace one issue into an action;
4. recompute its priority inputs;
5. verify a change with a second run;
6. open a focused issue or contribution.

Primary CTA: star and inspect [github.com/MaxJafar/marketingovo](https://github.com/MaxJafar/marketingovo).

Secondary CTA: try [Marketingovo](https://github.com/MaxJafar/marketingovo) for managed team workflows.

## Editorial proof checklist

- Every code claim links to the current file or test.
- Every screenshot identifies fixture versus customer data.
- No benchmark number appears without a public corpus and method.
- No provider is called production-ready solely because its manifest exists.
- The alpha qualifier appears in the introduction and limitations section.
- Marketingovo is called open source under Apache-2.0.

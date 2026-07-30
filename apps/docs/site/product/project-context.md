---
title: Project Context and marketer journal
description: Keep a versioned business brief and append-only decision history beside SEO evidence.
---

# Project Context and marketer journal

Project Context is durable, project-scoped strategy memory. It gives marketers
and agents the same audiences, markets, conversion goals, priorities,
competitors, and constraints without treating a prompt or note as measured SEO
evidence.

## Versioned business profile

Open **Project context** and record:

- the current business and search objective;
- priority audiences and markets;
- languages or locales;
- valuable conversion events;
- priority topics and known competitors; and
- legal, brand, platform, migration, or resourcing constraints.

Every save requires a change summary and creates a new immutable revision. The
previous profile remains in history, so a later audit can be interpreted against
the strategy that was active at the time.

## Append-only decision journal

Use the journal for four explicit kinds of human context:

| Kind        | Use it for                                                             |
| ----------- | ---------------------------------------------------------------------- |
| Observation | An interpretation that current evidence may confirm or contradict      |
| Decision    | A strategy or operating choice                                         |
| Constraint  | A boundary the action plan must respect                                |
| Experiment  | A hypothesis with a measurement and a condition that could disprove it |

An entry can link to an audit from the same project. It cannot be edited in
place. When the evidence changes, append the correction so the decision trail
remains understandable.

Human context is not proof. Always compare it with current crawl coverage,
source freshness, issue evidence, and provider state. A journal statement must
not turn unavailable analytics into a zero or convert a hypothesis into a
verified result.

## Agent and API boundary

The REST API supports:

```text
GET  /api/v1/projects/:id/context
PUT  /api/v1/projects/:id/context
POST /api/v1/projects/:id/context/journal
```

The typed SDK exposes `client.context.get`, `client.context.update`, and
`client.context.append`. MCP exposes the read-only
`marketingovo://projects/{id}/context` resource. Project Context does not create an
additional public workflow tool, and official agents cannot silently rewrite
the operator's memory.

## Safety and transfer

The runtime rejects secret-like text and local filesystem paths. Audit events
store structural metadata, not profile or journal content. A `.marketingovo` export
includes the complete version and journal history, remaps linked run and entry
identifiers on import, and never carries provider credentials.

<p class="source-note">
  Canonical sources: <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/project-context.md">Project Context contract</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/packages/contracts/src/index.ts">public schemas</a>, and
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/packages/runtime/src/index.ts">runtime boundary</a>.
</p>

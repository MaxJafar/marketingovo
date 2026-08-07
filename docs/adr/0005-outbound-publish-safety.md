# ADR 0005 — Outbound publishing safety

Status: accepted and fully implemented, 2026-08-06.
Depends on [ADR 0004](0004-channel-account-model.md).
The mechanics this ADR deferred are decided in
[ADR 0006](0006-publishing-mechanics.md).

The staging half landed on 2026-08-05 and the outbound half on 2026-08-06. The
sequencing was the point: the safety model was a starting constraint the send
button had to satisfy, rather than something retrofitted after the first
unintended charge.

## Context

The goal is a 360 campaign composer: draft an SEO article, an Instagram reel and
a Facebook ad from one brief, and launch them together from one dashboard.

Every version of Marketingovo so far has been **read-only with respect to the
outside world**. It crawls pages, it reads provider APIs, it writes only to local
SQLite. Publishing inverts that. A publish action:

- is irreversible in practice — a deleted post was still seen, and an impression
  served cannot be recalled;
- **spends money**, without a natural upper bound if a budget field is wrong by a
  factor of a thousand;
- is performed under the operator's own brand identity, where a mistake is a
  public one;
- and would be triggered, in the intended design, partly by an **agent**.

The existing architecture already draws the relevant line. The daemon holds no
model credential and implements no chatbot deliberately: it owns provider
credentials and crawl history, and adding a model API key beside them would widen
the blast radius of the component most worth keeping boring. The browser and the
agent authenticate differently — session cookie plus CSRF versus the local
service token — so "who said this" is decided by transport rather than by a role
field a caller could set.

Publishing must be built on that line, not across it.

## Decision

### The pipeline

```
campaign_brief          one intent, many channels
  └── deliverables      per channel: article, reel, ad creative
        └── publish_intents    exact payload + target channel_account
              │
              ▼  human approval in the dashboard   ← the gate
              │
              └── durable job (idempotency key)
                    └── publish_records    immutable: what was sent, what came back
```

`publish_records` stores the exact request payload and the provider's response
identifier. Not a summary. When a campaign misbehaves, the question is always
"what did we actually send", and a reconstruction is not an answer.

### The agent drafts and stages. It never publishes.

An agent may create a brief, write deliverables, and stage a `publish_intent`.
It cannot transition one to published. That transition requires a request
carrying the browser's session cookie and CSRF token — the transport a human
operator uses — and is refused for the service token that agent tooling holds.

This is deliberately not a permission flag or a confirmation prompt the model
answers. Both are things a sufficiently confused or prompt-injected agent talks
its way past. The transport split already exists and already means "a person did
this in a browser"; publishing is exactly the operation that should be pinned to
it.

An agent that has staged intents surfaces them as a review queue. The operator's
work is approval, not authorship — which is the useful division anyway.

### Spend caps are enforced locally, before the call

Each ads-kind `channel_account` carries a daily and total spend cap. Any intent
that creates or enables paid delivery is checked against the cap _in the daemon_
before the outbound request is made. Exceeding it is a refusal, not a warning.

Provider-side budget caps are not a substitute: they are set by the same call
that could carry the wrong number. The local cap is a second, independently
authored bound, and that is the entire point of having it.

### Every intent is dry-runnable and idempotent

An intent renders a complete preview — final copy, creative, targeting, schedule
and budget — from the same payload that would be sent. Approval acts on what was
previewed; if the payload changes, approval is void and must be re-obtained.

Publishing carries an idempotency key so a retried durable job cannot double-post
or double-spend. A provider without idempotency support gets a pre-flight
existence check against the recorded response identifier.

### Failure is partial and stays legible

A 360 campaign is several independent outbound calls. A brief where the article
published and the ad failed reports exactly that, per deliverable, with the
provider error preserved. There is no aggregate "campaign failed" state that
hides a post already live, and no automatic rollback that would delete published
content on the operator's behalf.

## Alternatives rejected

**Let the agent publish with a confirmation step.** The confirmation would be
another model turn. Any control whose enforcement lives inside the thing being
controlled is not a control.

**Approve once for a whole campaign.** The operator approves what they read. A
brief-level approval covering three payloads they never saw is worse than no
approval, because it produces a record of consent that was not informed.

**Skip the local spend cap and rely on the provider's.** One typo in one field
reaches production spend through the same call that sets the provider cap.

**Auto-rollback a partially failed campaign.** Deleting live content on someone's
brand without asking is its own irreversible outward action.

## Consequence

The daemon acquires its first outbound write path, and the two-sided
authentication split described in `docs/architecture.md` becomes load-bearing for
money rather than only for session ownership.

That split is already load-bearing as of the staging implementation: approval is
the first operation in this product that the local service token cannot perform.

## What was required before anything could be sent

All three now exist, in [ADR 0006](0006-publishing-mechanics.md):

- A durable job carrying an idempotency key, with the record written before the
  outbound call so an interrupted attempt is reported as indeterminate rather
  than repeated.
- `publish_records` holding the exact request and the provider's response
  identifier — not a summary.
- Per-destination intents, so failure is partial by construction and no
  aggregate state can hide a post already live.

The MCP registry still exposes no approve or publish tool, and the contract and
server suites assert it: an agent that could approve its own staged payload
would route around the boundary entirely. Adding one fails a build first.

# Unified marketing channels

Where Marketingovo is going, and what has to be true for it to get there.

## The goal

One local-first workspace that unifies every marketing channel and every piece of
research — internal and external — in a single dashboard, with an attached agent
that can read the data, and eventually act on it.

Concretely, the end state a marketer should reach:

- **One workspace per brand**, holding its website (if it has one), its ad
  accounts, its social profiles, its keyword set, its competitors and its notes.
- **One place to ask a cross-channel question.** What did we spend, what did it
  reach, what did it return — across paid, organic and social, with the same
  evidence discipline applied to all three.
- **One prioritized queue.** Paid waste and SEO regressions compete for attention
  in the same ranked list, because a marketer has one budget of attention.
- **One composer.** An SEO article, an Instagram reel and a Facebook ad drafted
  from one brief and launched together.
- **An agent that participates.** Attached over MCP, it reads the workspace,
  drafts campaigns, and stages work for a human to approve.

## What is already true

The foundations this depends on mostly exist, and are the reason the plan is
credible rather than a rewrite:

- **A workspace no longer requires a website.** Social, ads, OSINT and keyword
  research are reachable without one, and surfaces that genuinely need a site say
  which input is missing and how to supply it
  ([ADR 0003](adr/0003-optional-website-and-capabilities.md)).
- **Missing data never becomes a zero.** Metrics are nullable with a separate
  availability state, from the SQLite schema up through the API contracts to the
  dashboard's `Unavailable` rendering and its labelled `demo` flag. This is the
  single most important property to preserve: a cross-channel dashboard that
  quietly fills gaps with zeros is worse than no dashboard, because it produces
  confident wrong answers.
- **A prioritized action queue with evidence, adjudication and verification.**
  Extending it to paid needs new rules, not new machinery.
- **A connector framework with enforced egress.** Exact-host allowlists checked
  at request time, DNS re-resolved per call, redirects refused, credentials in an
  OS vault behind a `secret_ref`.
- **A two-sided agent session.** The daemon holds no model credential; the
  browser and the harness authenticate differently, so "who did this" is decided
  by transport.

## What has to change

### Phase B — the channel layer

**Landed for Meta as of 2026-08-05.** Detailed in
[ADR 0004](adr/0004-channel-account-model.md); the operator-facing result is the
[Meta Ads guide](meta-ads.md). Facebook and Instagram spend, delivery and
creative performance are readable per ad cabinet, split by platform, with paid
findings in the shared action queue. Google Ads, LinkedIn and TikTok reuse the
same tables and the same connector checklist.

Connections become `(provider, account)` rather than one global row per provider,
because one Meta login reaches many ad accounts and different clients need
different logins. `channel_accounts` records which external entity a workspace
reads from; `channel_metrics` is the cross-channel fact table, carrying the
existing `available | partial | unavailable | failed` discipline so a channel
that could not be reached never reads as a channel that produced nothing.

Campaign auditing emits ordinary issues into the existing actions queue.

Credentials support both a pasted long-lived token (the default — no client
secret ever reaches the machine) and a bring-your-own-app OAuth flow (the
advanced path, with automatic refresh).

### Phase C — the composer

**Landed 2026-08-06.** The safety model is
[ADR 0005](adr/0005-outbound-publish-safety.md); the mechanics it required are
[ADR 0006](adr/0006-publishing-mechanics.md); the operator-facing result is the
[content calendar](content-calendar.md).

One post reaches Telegram, X, a Facebook Page and Instagram from one piece of
copy, scheduled and approved in the dashboard, with an immutable record of what
was sent to each. The daemon has its first outbound write path, and the
transport split is now load-bearing for the operator's public voice as well as
their ad budget.

This is the product's first write path to the outside world, and it spends money
under the operator's brand. Its shape is therefore decided by its safety model:
brief → deliverables → intents → **human approval** → durable idempotent job →
immutable record of exactly what was sent.

The agent drafts and stages. It never publishes. Approval requires the browser's
own transport, spend caps are enforced locally before any outbound call, and a
partially failed campaign reports per-deliverable truth rather than an aggregate
that hides a post already live.

## The constraint that does not move

Every one of these phases adds a source, and each new source is a new opportunity
to present a guess as a measurement. The rule that has governed this codebase
from the start governs the expansion too:

> A value that was not measured is `null` with a stated reason. It is never a
> zero, never an estimate presented as an observation, and never a gap the
> interface smooths over.

A unified dashboard makes that harder and more valuable at the same time. Harder,
because six channels means six ways to be partially blind. More valuable, because
the whole point of putting them side by side is comparison — and a comparison
against a fabricated number is worse than no comparison at all.

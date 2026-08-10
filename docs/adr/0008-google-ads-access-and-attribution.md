# ADR 0008 — Google Ads: access, scope, and what its numbers actually mean

Status: accepted
Date: 2026-08-06

## Context

Meta Ads (ADR 0004, 0005) established how a paid channel enters this product:
the operator holds the credential, the daemon reads and audits, an agent may
draft but never approve. Google Ads is the second paid channel and the largest
one for most of the marketers this is built for.

It does not fit the Meta pattern cleanly, in three ways that had to be decided
rather than absorbed.

## Decision 1 — the operator supplies their own developer token

The Google Ads API requires a **developer token** in addition to an OAuth
credential. Tokens are issued against a Google Ads Manager account and must be
approved by Google before they work on production accounts; an unapproved token
reaches test accounts only.

Marketingovo ships no developer token. The reasoning is the same as the pasted
Meta System User token, and stronger:

- A token compiled into a desktop binary is one identity shared by every
  install. Google's rate limits, quality reviews and terms all attach to the
  token holder, so one operator's misuse would suspend everyone.
- It would make this project the accountable party for API use it cannot see.
- Extracting it from a local binary is trivial, so the secrecy is imaginary.

So the operator brings their own, exactly as they bring their own Google Ads
account. The onboarding says this plainly, including that approval takes time,
because discovering it halfway through a connection flow is worse than being
told at the start.

The OAuth half reuses the existing Google desktop flow already used for Search
Console and Analytics. There is no second credential path, and no client secret
on the machine.

## Decision 2 — read and audit, no write

The Meta module can stage campaign drafts for a person to approve. Google Ads
does not get that, at least not in this iteration.

A Meta ad draft is close to a flat object: copy, creative, a destination. A
Google Ads campaign is a tree — campaign, budget, bidding strategy, ad groups,
keywords with match types, negative lists, responsive search assets, extensions
— and every level constrains the others. A "draft" that flattens it would be a
toy that produces work an operator has to redo, which is worse than no draft.

The value in an account review is not composition anyway. It is finding where
money is leaking, and that is entirely a read problem.

## Decision 3 — search terms are in scope, and their absence is a finding

The search terms report is where Google Ads waste is visible: the actual
queries that triggered an ad, what they cost, and whether they converted. An
audit without it can say a campaign is expensive; only with it can the audit
say _which query to exclude_.

This has a consequence the product must state rather than hide. **Performance
Max and Demand Gen campaigns do not expose search terms**, and on many accounts
they are the majority of spend. An audit that quietly analyses the 30% it can
see and reports a clean bill is lying by omission.

So the audit emits an explicit finding when a material share of spend sits in
campaign types whose queries cannot be inspected. The finding names the share
and says the analysis does not cover it. This follows the same rule as ADR
0007: an unmeasured thing is reported as unmeasured, never as zero and never as
silence.

## Decision 4 — Google conversions are not Meta conversions, and neither is GA4

The cross-channel report already refuses to sum conversions across channels
(ADR 0007). Google Ads makes that refusal more necessary, not less, and adds a
second problem of its own.

**Conversions are dated to the click, not the conversion.** A purchase today
from an ad clicked nine days ago is added to that earlier day's row. So a
Google Ads figure for a recent window is systematically incomplete and rises
for days afterwards without anything changing. A report generated on the 1st
and regenerated on the 8th will disagree about the same period, and the second
one is not a correction of an error.

Two things follow:

- Report rows carry the date Google attributed them to, and the report states
  that recent days are still filling in rather than presenting them as final.
- The stored report snapshot (ADR 0007) is even more clearly the right choice:
  a client received a document that was true when it was made.

Google's default attribution is also data-driven across its own surfaces, with
its own conversion window, counting conversions it takes credit for. GA4 counts
key events on a last-click session model. Meta counts on its own click-and-view
window. Three systems, three answers, one purchase. The report continues to
present each channel's own figure and to refuse the total.

## Consequences

- Anyone without an approved developer token can connect nothing. This is a
  real barrier and it is Google's, not one this product can remove; the
  connector says so instead of failing obscurely.
- The audit's coverage varies with account composition. That variance is
  surfaced as a finding rather than smoothed over.
- Paid findings from both Meta and Google land in the same prioritized action
  queue, because a marketer has one budget of attention.

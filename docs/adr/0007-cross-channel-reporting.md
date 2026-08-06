# ADR 0007 — What a cross-channel report may and may not claim

Status: accepted, 2026-08-06.
Depends on [ADR 0004](0004-channel-account-model.md) and
[ADR 0006](0006-publishing-mechanics.md).

## Context

The product now measures paid delivery, organic search, social publishing and
email production. A marketer's actual monthly deliverable spans all four, and
until now the only report it could produce covered one crawl.

The obvious thing to build is a document with a big number at the top. That is
what every reporting tool does, what clients expect, and what an agency is
asked for. It is also where this codebase's central rule — a value that was not
measured is null with a stated reason — is under the most pressure it has ever
been under.

The pressure is specific. This document leaves the building. It goes to a
client who did not run the audit, cannot see the connector states, and will not
ask why one section is thinner than another. Every gap is an invitation to fill
it, and every fill is invisible to the only person who could catch it.

Three totals in particular look reasonable and are not.

**Total conversions.** Meta reports attributed conversions on a click-and-view
window it chooses. GA4 reports key events on a session-scoped last-click model.
The same purchase can appear in both. Adding them produces a number larger than
the number of things that happened.

**Total spend across cabinets.** Two ad accounts billing in different
currencies have no sum without a rate, and no rate was recorded at the time the
money was spent.

**Total reach.** Reach counts unique people per platform. A person on both
Instagram and Telegram is one person, and nothing in the data says which people
overlap.

## Decision

### The report states each channel and refuses the joins it cannot make

Paid, organic, social and email each get a section carrying their own numbers,
their own coverage and their own sources. Where a cross-channel total would be
a fabrication, the report says so in place of the number, in the client's
terms — not a dash, and not a footnote.

> **Conversions are not totalled across channels.** Meta counts attributed
> conversions on its own window; Analytics counts key events on a last-click
> session model. The same purchase can appear in both, so a combined figure
> would be larger than what happened. Each channel's own figure is below.

That sentence is the product. A client who reads it understands their marketing
better than one handed a total, and an agency that ships it is making a claim
it can defend.

### A missing source is a stated absence, never a zero

Every section carries an availability state and the reason for it. A report
covering a month when Search Console was disconnected says Search Console was
disconnected. It does not show organic clicks as zero, and it does not quietly
omit the section — an omitted section reads as "nothing to report", which is
the same lie in a different shape.

This is the existing `available | partial | unavailable | failed` vocabulary,
carried from the connector layer through to the rendered page.

### Change is only reported where both periods were measured

A month-over-month figure requires both months. Where the comparison period is
missing or partial, the report shows the current value and says the comparison
is unavailable, rather than computing a percentage against a period nobody
measured. A 400% increase over a month the connector was down is not a result.

### Reports are immutable snapshots

A generated report stores its own data, not a query to re-run. A client
received a specific document on a specific day; regenerating it later against
changed connectors, a revised brand kit or restated provider figures would
produce something different and equally titled. The stored snapshot records the
brand revision it was rendered against for the same reason.

Meta restates attributed conversions for days after the fact. A report is a
statement of what was known when it was made.

### Email reports production, not performance

The product builds email HTML and does not send it, so it has no opens, no
clicks and no unsubscribes. The section reports what was built and says plainly
that delivery figures live in the operator's own email service. Inferring
engagement the product cannot see would be the worst instance of the failure
this ADR exists to prevent, because email is where clients most expect a
number.

## Alternatives rejected

**Show a combined total with a methodology footnote.** The number is what gets
read, screenshotted and put in a board deck. A footnote does not travel with
it.

**Let the operator opt into cross-channel totals.** The person enabling it is
not the person misled by it, and a setting that produces a defensible-sounding
wrong number is worse than no setting, because it launders the decision.

**Omit sections with no data.** A report with four sections one month and two
the next reads as a business that stopped doing two things, not as a tool that
stopped seeing them.

**Regenerate reports on read.** Cheaper and always current, and it means the
document a client has and the document the operator sees can differ with no
record of why.

## Consequence

The report is the first thing this product makes that is designed to be read by
someone who did not run it. Every honesty rule the codebase has held internally
now has an external audience, which is the point: the discipline was never for
our benefit.

It also makes the deferred `site` → `workspace` rename more pressing, since the
report is the first surface that will be read by people who never used the
product and for whom "site" is simply wrong.

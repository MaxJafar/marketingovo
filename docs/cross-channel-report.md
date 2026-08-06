# Cross-channel report

The document you send a client on the first of the month: paid, organic search,
social publishing and email in one place, with every gap stated.

The decisions behind it are recorded in
[ADR 0007](adr/0007-cross-channel-reporting.md).

## What makes this one different

Every reporting tool puts a big number at the top. This one refuses three of
them, and says why in the client's own terms.

**Conversions are never totalled across channels.** Meta counts conversions it
attributes on its own click-and-view window. Analytics counts key events on a
last-click session model. The same purchase appears in both, so a combined
figure is larger than the number of things that happened. Each channel's own
figure is reported; the total is replaced by that sentence.

**Spend is not summed across currencies.** Two ad accounts billing in EUR and
USD have no sum without a rate, and no rate was recorded when the money was
spent.

**Reach is not combined.** Reach counts unique people per platform, and nothing
in the data says who overlaps.

These refusals are rendered as content, not footnotes. A footnote does not
travel with a number once it has been screenshotted into a board deck.

## A missing source is never a zero

Every section carries an availability state and the reason for it. A report
covering a month when Search Console was disconnected says Search Console was
disconnected — it does not show organic clicks as zero, and it does not omit
the section. An omitted section reads as "nothing to report", which is the same
untruth in a different shape.

Where a figure is missing, **its reason takes the number's place** at readable
weight. A dash reads as zero to anyone skimming, and skimming is what happens
to a monthly report.

Changes work the same way. A month-over-month percentage needs both months, so
where the comparison period was not measured the report shows the current value
and says the comparison is unavailable. A 400% increase over a month the
connector was down is not a result.

## What each section reports

| Section           | Source                                      | Notes                                                     |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| Paid              | `channel_metrics` from linked Meta cabinets | Split by Facebook and Instagram, per cabinet              |
| Organic search    | The most recent audit inside the period     | Search Console and Analytics carry their own availability |
| Social publishing | `publish_records`                           | Posts sent, refusals, and sends whose outcome is unknown  |
| Email             | Template revisions built in the period      | Production only — see below                               |
| Work completed    | The action queue                            | Issues found, resolved, and verified by re-audit          |

Organic evidence is scoped to audits **inside the period**. A July report
quoting a May audit would be describing a different site.

### Email reports production, not performance

Marketingovo builds email HTML and does not send it, so it has no opens, no
clicks and no unsubscribes. The section says so plainly. Email is where a
client most expects a number, which makes it the worst possible place to infer
one.

## Reports are frozen

A generated report stores its own data rather than a query to re-run. A client
received a specific document on a specific day; regenerating it later against
changed connectors, a revised brand kit or restated provider figures would
produce something different under the same title. Meta alone restates
attributed conversions for days after the fact.

The snapshot records which brand revision it was rendered against, for the same
reason.

## Generating one

From the dashboard, or on a schedule — schedules now carry the workflow they
run, so a monthly report can fire on the first without anyone present:

```bash
pnpm marketingovo runs start --workflow marketing-report --project <id>
```

Leave the dates empty for the last complete 30 days. The current day is
excluded because providers restate it, and a report is a statement about
settled figures.

Export the client version as HTML, styled from the brand kit, or as plain text
for a covering email.

## The narrative

The opening paragraph is written by you or by an attached agent, and is never
generated from the metrics. A sentence assembled from numbers reads as insight
while being arithmetic, and a client learns to distrust it.

`marketingovo_marketing_report` gives an agent the full evidence and the
refusals. The rule it is held to is the one this whole document is built on:
report each channel's own figures, repeat the refusals, and never present a
total the report declined to produce.

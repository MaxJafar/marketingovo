# Cross-channel report

The document you send a client on the first of the month: paid, organic search,
social publishing, email, the competitive landscape and completed work in one
place — the full 360° view — with charts for what was measured, every gap
stated, and a PDF ready to hand over.

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
| Paid              | `channel_metrics` from linked ad cabinets   | Split by platform, per cabinet                            |
| Organic search    | The most recent audit inside the period     | Search Console and Analytics carry their own availability |
| Social publishing | `publish_records`                           | Posts sent, refusals, and sends whose outcome is unknown  |
| Email             | Template revisions built in the period      | Production only — see below                               |
| Competitors       | The newest OSINT research inside the period | Citation counts, never market share — see below           |
| Work completed    | The action queue                            | Issues found, resolved, and verified by re-audit          |

Organic evidence is scoped to audits **inside the period**. A July report
quoting a May audit would be describing a different site. The competitors
section works the same way: it quotes public-web research that ran inside the
period, and compares it against the pass before it — schedule the research if
you want the section populated every month.

### Competitors are observed, not estimated

The competitive landscape section reports what changed in each competitor's
public presence: cited public signals per target, publishing cadence where a
feed made it measurable, and the signals added, gone, or changed since the
previous research pass. It refuses traffic, spend and market-share figures
outright — public-web research reads what a competitor publishes, not what
they measure, and a share number here would be invented. A first pass says it
has nothing to compare against, which is different from nothing having
changed.

## Charts only draw what was measured

Sections carry charts — bars for breakdowns, a share donut where the whole was
measured, and paired bars comparing this period against the one before it. A
chart inherits every rule the numbers live by, plus one of its own: **an
unmeasured row is not a zero-height bar.** It is left out of the drawing and
named under it with its reason, because an empty bar reads as "nothing
happened" at exactly the glance a chart exists for.

Three refusals are structural. A share donut is only drawn when every row was
measured — a share of an incomplete total misstates every slice. Paid bars are
declined when accounts bill in different currencies. And competitor citation
counts never become a donut, because a share of citations reads as market
share, which nobody measured.

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

From the dashboard's Report page, or from the CLI:

```bash
pnpm marketingovo report generate --project <id>
```

Leave the dates empty for the last complete 30 days. The current day is
excluded because providers restate it, and a report is a statement about
settled figures.

Export the client version as a **PDF with its charts drawn in** — generated
locally with no browser involved, so the download works on every install — as
HTML styled from the brand kit, or as plain text for a covering email:

```bash
pnpm marketingovo report export <report-id> --out report.pdf
```

## Daily, weekly, monthly — without anyone present

Schedules carry the workflow they run, so a report can generate itself. In the
dashboard's Monitoring page, choose **Cross-channel report** as what to run
and a daily, weekly, or monthly cadence — or create the schedule over the API
with a standard five-field cron:

```bash
curl -X POST http://127.0.0.1:3210/api/v1/schedules \
  -H "Authorization: Bearer $(cat <data-dir>/service-token)" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<id>","cron":"0 8 1 * *","timezone":"Europe/Berlin","enabled":true,"workflowId":"marketing-report"}'
```

`0 8 1 * *` is monthly on the 1st at 08:00; `0 8 * * 1` weekly on Mondays;
`0 8 * * *` daily — each in the schedule's own IANA timezone. Every occurrence
is idempotent, and a schedule that missed occurrences while the daemon was
down fires them on restart rather than skipping them.

One dependency worth pairing: a report only quotes an audit — and competitor
research — that ran **inside its own period**. Schedule those alongside the
report, or their sections will say they were not measured.

## The narrative

The opening paragraph is written by you or by an attached agent, and is never
generated from the metrics. A sentence assembled from numbers reads as insight
while being arithmetic, and a client learns to distrust it.

`marketingovo_marketing_report` gives an agent the full evidence and the
refusals. The rule it is held to is the one this whole document is built on:
report each channel's own figures, repeat the refusals, and never present a
total the report declined to produce.

# Landing pages and paid spend

The join between the crawl and the ad accounts.

## Why this only exists here

An SEO tool knows what every page on a site says and whether it works. An ads
tool knows where the money is being sent. Neither knows the other, and a
surprising share of expensive advertising problems live exactly in that gap:

- An ad group bidding on "waterproof boots" pointing at a page headed "Autumn
  Footwear" is one root cause with three symptoms — a Google quality score
  penalty, a poor conversion rate, and an organic relevance gap. Each tool sees
  one symptom and none see the cause.
- An ad pointing at a page that 404s is the purest waste in advertising, and it
  is invisible in every ad-platform metric, because from the platform's side
  the click happened and was charged.

This product holds both halves already. These rules are what that buys.

## What it checks

| Finding                      | Why it matters                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Destination broken           | Every click billed, none arrive. Most common after a site migration                       |
| Tracking lost on redirect    | The page loads and the visitor arrives, but the click identifier was stripped on the way  |
| Keyword absent from the page | The actionable cause behind a low quality score, which Google can only report as a number |
| Slow under paid traffic      | Visitors leaving before a page they were paid for appears                                 |
| Destination redirects        | Latency on every visit, and a hop where a future change can drop the tracking             |
| Destination not indexable    | Fine for a dedicated landing page; worth confirming that is what it is                    |
| Page shared across ad groups | One page cannot answer several intents equally well                                       |
| Destination unchecked        | Coverage, not a defect — so silence does not read as approval                             |

### The one worth understanding

**Tracking lost on redirect** is the most expensive thing this module finds and
the hardest to notice by hand. The page loads. The visitor arrives. Nothing
looks wrong. But the redirect dropped `gclid` or the UTM parameters, so the
platform never learns the sale happened — and the campaign then reports as
unprofitable and gets cut. That is a wrong decision, made confidently, on data
the redirect destroyed.

The rule only fires on parameters that were actually present on the way in. A
destination carrying no tracking has none to lose.

## Where the page data comes from

The last completed crawl is preferred: it costs nothing and was taken with the
site's own settings, and it carries page speed, which a direct fetch does not.

Anything the crawl never reached is fetched directly, bounded to 40 pages per
pass. This matters because a dedicated paid landing page is routinely absent
from a crawl **by design** — nothing on the site links to it, so nothing
discovers it — and "we did not look at the page your money lands on" is a poor
answer to the question this module exists to ask.

Probes identify themselves as `Marketingovo-LandingCheck`. They go to pages the
operator is already paying to send people to, and a server owner reading their
logs should be able to tell what the traffic is.

## What it declines to say

- A page nothing could be established about is **unchecked**, never broken.
  Reporting an unreachable page as a 404 would send an operator to fix
  something that was fine.
- The relevance rule needs the page's actual words. A crawl recorded before
  this module existed stored a title and nothing else, and judging a page on
  its title alone would report "your page never mentions this" about pages
  whose heading says exactly that. Those decline until the next audit runs.
- Keywords made only of common words — "buy online", "best near you" — are not
  judged at all. They would fire against every page and mean nothing.
- Spend is attributed to a destination only from ad-group metrics. When the
  sync did not read that level, the finding still fires and simply omits the
  money, rather than apportioning a campaign total across its ad groups and
  presenting the guess as a measurement.

## When it runs

At the end of the paid audit, because that is when the destinations are fresh.
It never fails the audit around it: a destination that cannot be established is
reported as unchecked, and a failed probe leaves the rest of the findings
intact.

Findings enter the same prioritized action queue as everything else, under the
module id `landing:paid-alignment`.

# Google Ads

Read and audit. No writes, by design — see [ADR 0008](adr/0008-google-ads-access-and-attribution.md).

## Before you can connect

Google Ads needs two credentials, and one of them takes time to get.

1. **A Google sign-in.** The same desktop OAuth flow Search Console and
   Analytics already use.
2. **Your own developer token.** Issued in the API Center of a Google Ads
   **manager** account, and approved by Google by hand. An unapproved token
   reaches test accounts only.

Marketingovo ships no developer token and never will. One compiled into the
app would be a single identity shared by every install — Google's rate limits,
quality reviews and terms all attach to whoever holds the token, so one
operator's misuse would suspend everyone. It would also be trivially
extractable from a local binary, which makes the secrecy imaginary.

If your account sits under a manager, set the **manager customer ID** too.
Google requires it whenever a credential reaches an account that way, which is
how every agency is arranged, and omitting it produces a permission error that
never mentions managers.

Google publishes no read-only scope for the Ads API — `.../auth/adwords` grants
read and write together. So the read-only guarantee lives in the software
rather than in the permission: this connector issues no mutate call, and the
contract and MCP suites assert that no Google Ads write surface exists.

## What the audit looks for

| Finding                           | What it costs                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Conversion tracking missing       | Spend with no conversions recorded. Invalidates every other conclusion, including this audit's |
| Disapproved ads                   | Google is not running them; they vanish from spend rather than reporting an error              |
| Wasted search terms               | Queries that took money and returned nothing, above a click threshold                          |
| Cross-campaign waste              | The same non-converting query costing money in several campaigns — a shared negative list      |
| Search term blind spot            | How much spend sits where Google reports no queries at all                                     |
| Budget-constrained                | A **converting** campaign losing impressions to its budget                                     |
| Rank-constrained                  | A campaign losing impressions to ad rank — the opposite remedy, and more money does not fix it |
| Broad match without smart bidding | Query selection delegated to Google without a conversion signal to steer it                    |
| Low quality keywords              | A quality score of 4 or below, weighted by what the keyword actually spent                     |
| Duplicate keywords                | The same keyword in several ad groups: no extra reach, and a split performance history         |

Every rule declines when it cannot see its inputs. A null reading is never
treated as a zero — "we could not read this account" and "this account
converts nothing" call for opposite actions, and only one of them is about the
account.

Two rules deserve their reasoning stated:

**The click threshold on wasted terms.** Zero conversions on four clicks is
variance. Excluding a query is not free, and a negative added on that evidence
is as likely to remove revenue as waste. The rule waits for ten clicks.

**The blind spot rule fires about the audit itself.** Performance Max and
Demand Gen report no search terms, and on many accounts they hold most of the
spend. An audit that inspects the third it can see and reports a clean bill is
lying by omission, so when opaque campaigns exceed a fifth of spend, the audit
says so and names them.

## Reading the numbers

**Conversions are dated to the click, not the sale.** A purchase today from an
ad clicked nine days ago is added to that earlier day. So a recent window is
systematically incomplete and rises for days afterwards without anything
changing. A report generated on the 1st and regenerated on the 8th will
disagree about the same period, and the second is not a correction.

**Conversions are never added across providers.** Meta attributes on its own
click-and-view window; Google credits the click that preceded the sale on its
own model. One purchase can be counted by both, so a combined figure would be
larger than what happened. The cross-channel report shows each platform's own
number and refuses the total — the same rule ADR 0007 applies across channels
turns out to apply just as strictly between two paid platforms.

Spend **is** totalled across providers. No platform can double-count another's
budget, so that one is arithmetic rather than a claim.

**Impression share is often absent.** Google withholds it when the auction
pool is too small to anonymise, and does not report it outside Search at all.
It arrives as null with that reason attached.

## Networks

Search and Search Partners are kept apart because partner traffic converts
differently and is switched off separately, and an operator comparing them is
usually deciding exactly that. Performance Max is its own value rather than
being folded into the networks it runs on: Google reports it as one opaque
surface, and filing it under Search would claim a breakdown that does not
exist.

## From an agent

`marketingovo_ads_cabinets` lists linked accounts across both providers.
`marketingovo_ads_performance` reads one account's window, and takes
`include_search_terms` to add the queries worth acting on.
`marketingovo_ads_audit_start` syncs and runs the rules; findings enter the
same prioritized action queue as SEO work.

There is no approve, publish or mutate tool for Google Ads, and the test suites
assert that adding one fails the build.

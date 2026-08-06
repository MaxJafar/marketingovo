# Meta Ads — Facebook and Instagram

Ad cabinets, measured performance, paid-media findings, and a staging path that
stops one step short of spending money.

Facebook and Instagram advertising is one API behind one credential. What
separates them is a breakdown dimension on the insights call, not an endpoint,
which is why connecting Meta once reaches both.

## What this does and does not do

**It reads.** Spend, impressions, clicks, conversions and delivery state for
every ad cabinet you link, split by the platform the impression was served on.

**It audits.** Six deterministic rules turn that evidence into ordinary issues
in the same prioritized action queue as SEO findings, with the same evidence,
adjudication and verification.

**It drafts and stages.** You, or an agent attached over MCP, can write a
campaign brief, its ad copy and the exact payload that would be sent, and put it
in a review queue.

**It does not publish.** There is no outbound write path to Meta in this build —
no route, no SDK method, no agent tool. Approving an intent records your consent
to a specific payload; it does not send anything. That is the shape
[ADR 0005](adr/0005-outbound-publish-safety.md) requires the composer to be
built in, and the safety model exists before the send button does.

## Connecting

Meta's token exchange requires an app secret, and a desktop application cannot
hold one safely — shipping a secret in the binary would make every install share
one identity. So the credential is a **System User access token you generate
yourself**, in your own Business Manager, and paste in like an API key. No
secret ever reaches this machine, and the credential stays yours.

1. In Meta Business Manager, open **Business settings → Users → System users**.
2. Create or select a system user and assign it to the ad accounts you want to
   read, with **View performance** access.
3. Generate a token with the `ads_read` and `business_management` scopes. The
   connector never asks for `ads_management`, because nothing here writes, and
   requesting a write scope to perform reads makes the credential more dangerous
   than the feature that needed it.
4. Paste it into **Integrations → Meta Ads (Facebook & Instagram)**.

**The cost of this path, stated plainly:** the token expires. It does not
refresh, because there is no client secret to refresh it with. Marketingovo asks
Meta for the expiry when you paste the token and shows it on the Integrations
and Ad Cabinets pages, and the connection degrades to `expired` with an
instruction rather than failing silently months later. Rotate before the date.

Optional settings:

| Setting        | What it does                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `graphVersion` | Pins a Meta Graph API version. Meta supports each for roughly two years and changes field behaviour between them, so an unpinned client silently changes its answers. Leave empty to use the version this build was written against. |
| `businessId`   | Limits cabinet discovery to one Business Manager instead of every account the token reaches.                                                                                                                                         |

## Linking cabinets

Connecting Meta links nothing on its own. One login typically reaches several ad
accounts, and which of them a workspace is allowed to read is your decision, not
something a credential implies — an agency holds several clients' cabinets
behind one login and must not have them silently merged.

Open **Ad Cabinets → Find my cabinets**, then link the ones this workspace
should read. Each cabinet records:

- the currency Meta reports for it, or nothing if Meta reported none;
- a **daily and total spend cap you author locally**.

That cap is deliberately independent of any provider-side limit. A provider cap
is set by the same call that could carry the wrong number, so it cannot also be
the check on that number. The local cap is a second, independently authored
bound — that is the entire reason to have it.

## Reading performance

```bash
pnpm marketingovo runs start --workflow ads-audit --project <id>
```

or **Ad Cabinets → Run paid audit**. The run syncs every linked cabinet for the
window, records daily metrics, and files findings.

Three properties govern every number the surface shows, and they are the reason
to trust it:

**A null is not a zero.** Every metric Meta did not report is stored as `null`
with a stated reason and an availability state, never as `0`. "This campaign
spent nothing" and "we could not read this cabinet" call for opposite actions,
and a paid dashboard that collapses them produces confident wrong answers about
money. A cabinet that failed to sync gets explicit `failed` rows for the
requested days, so the outage is visible exactly where the numbers would be.

**Rates are recomputed, never averaged.** A window CTR comes from summed clicks
over summed impressions. Averaging the daily rates would treat a ten-impression
day as equal to a hundred-thousand-impression one.

**Some totals are refused.** Reach counts unique people; adding it across days
or campaigns would count the same person twice. Frequency derives from reach, so
it inherits the refusal. Both come back unavailable with the reason attached,
because no number is better than a plausible wrong one.

Currency is stored per row and never inferred. If the rows behind a total did
not agree on one currency, the total reports `currency: null` and the surface
says "not comparable" rather than adding euros to dollars without a rate.

The most recent day is deliberately excluded from the default window: Meta
restates attributed conversions for several days, and reporting the latest day
as final would present a moving number as a settled one.

## The audit rules

| Rule                                | Fires when                                                           | Why it is narrow                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta-ads.ad-disapproved`           | Meta refuses to run an ad                                            | The one finding insights cannot produce — a rejected ad simply stops spending, which reads as a creative that went quiet                     |
| `meta-ads.no-conversion-signal`     | The cabinet spent money and Meta reported no conversion field at all | A reported zero means the pixel works and the campaign is not converting; that is a performance question, and this rule stays quiet about it |
| `meta-ads.cpa-drift`                | Cost per conversion rose ≥50% between window halves                  | Requires ≥10 conversions in each half. One conversion becoming two has doubled nothing worth reporting                                       |
| `meta-ads.creative-fatigue`         | Frequency ≥3.5 **and** CTR fell ≥25%                                 | Frequency alone is not evidence: high frequency with steady CTR is a campaign working on a small audience                                    |
| `meta-ads.budget-under-pacing`      | An active ad set delivered <50% of its daily budget over ≥7 days     | Under-delivery is money you meant to spend and did not, which wastes a campaign window as surely as overspending wastes a budget             |
| `meta-ads.local-spend-cap-breached` | Daily spend exceeded the cap you set for the cabinet                 | What makes the local cap more than a note in a form                                                                                          |

Every rule declines when it cannot see its inputs. A cabinet nobody could read
produces no findings rather than findings derived from treating null as zero.

Findings carry a deep link into your own Ads Manager, so "fix this ad" is one
click from the finding rather than a search through a cabinet.

## Campaign staging and the approval gate

An attached agent can create a brief, write ad copy for Facebook and Instagram,
and stage the exact payload that would be sent. It **cannot approve one**.

Approval requires a request carrying the browser's session cookie and CSRF
token — the transport a human operator uses — and is refused for the local
service token that agent tooling holds, even though that token is fully
authorized everywhere else in the API.

This is deliberately not a permission flag or a confirmation prompt the model
answers. Both are things a sufficiently confused or prompt-injected agent talks
its way past, because their enforcement lives inside the thing being controlled.
The transport split already means "a person did this in a browser", and spending
money under your brand is exactly the operation that should be pinned to it.

Approval binds to a payload hash. If the payload changed between the render and
the click, no row matches and the approval simply does not happen — an approval
of something nobody read is a record of consent that was not informed, which is
worse than no record at all. Spend caps are re-checked at approval, not only at
staging, so a cap you lower after an intent was staged still binds.

## Agent tools

| Tool                           | Mode                | Purpose                                              |
| ------------------------------ | ------------------- | ---------------------------------------------------- |
| `marketingovo_ads_cabinets`    | Read-only           | Linked cabinets, their currency and local spend caps |
| `marketingovo_ads_performance` | Read-only           | One cabinet's window, split by platform              |
| `marketingovo_ads_audit_start` | Starts network work | Sync the cabinets and run the paid rules             |
| `marketingovo_campaign_stage`  | Writes locally      | Draft a brief and its deliverables for review        |

Plus the `marketingovo://projects/{id}/ads` resource, and the `/meta-ads` slash
command in the Claude Code plugin.

There is no approve or publish tool, and the contract test suite asserts that no
tool matching those names exists. An agent that could approve its own staged
payload would route around the boundary that keeps a person between a draft and
your ad budget.

## Egress

`graph.facebook.com` and nothing else. The exact-host allowlist is enforced
inside the fetch wrapper at request time, DNS is re-resolved on every call so a
rebinding answer fails policy before a cached connection can be selected, and
redirects are refused so no access token follows one to another host. The access
token travels in an `Authorization` header rather than a query string, so no
credential can be lifted out of a URL by a log line or an error message.

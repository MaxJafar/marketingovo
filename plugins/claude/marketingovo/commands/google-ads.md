---
description: Audit a Google Ads account and find where the money leaks.
---

Audit the Google Ads accounts linked to the project in $ARGUMENTS.

1. Call `marketingovo_ads_cabinets` to see which accounts the workspace reads
   and their currency. Ask which project is meant if it is ambiguous — never
   guess.
2. Call `marketingovo_ads_audit_start`, then poll `marketingovo_run_get` until
   the run leaves the running state. A `partial` run means at least one account
   could not be fully read; name which, and why.
3. Call `marketingovo_ads_performance` with `include_search_terms` for each
   Google account. Report Search and Search Partners separately — partner
   traffic converts differently and is switched off separately, which is a
   decision the operator can actually make.
4. Rank findings by measured money at stake, not by rule severity alone.

Read these findings in a specific order, because two of them change how the
rest should be read:

- **Conversion tracking missing comes first.** If no conversion action is
  reporting, nothing in the account can be judged on return — including the
  wasted-query findings, which need conversions to tell waste from working
  spend. Say the rest of the audit is unreliable until it is fixed.
- **The search-term blind spot bounds everything else.** Performance Max and
  Demand Gen report no queries at all. If a large share of spend sits there,
  the wasted-query analysis covers only the rest, and a short list is not
  evidence that nothing is being wasted. Repeat the share; do not summarise the
  account as healthy on the strength of the part you could see.
- **Budget-constrained and rank-constrained have opposite remedies.** More
  money never fixes ad rank. Google reports the two lost-impression shares
  separately precisely so an advertiser can tell them apart, so never merge
  them into "not showing enough".

Two things to state plainly about the numbers:

- A null metric was not measured. Give the stated reason — never report it as
  zero spend, zero conversions, or a cost per result derived from a missing
  denominator, and name what could not be read rather than filling the gap
  with generic advice. Impression share is absent whenever the auction pool
  was too small for Google to anonymise.
- Google dates a conversion to the click that led to it, not to the day it
  happened. Recent days are still filling in and will rise afterwards without
  anything having changed. Do not present them as final, and do not describe a
  later, higher figure as a correction.

If the project also has Meta cabinets, report each platform's conversions
separately and never add them. Each counts what it takes credit for on its own
attribution model, so one sale can appear in both.

---
description: Audit Facebook and Instagram ad cabinets.
---

Audit the Meta ad cabinets linked to the project in $ARGUMENTS.

1. Call `marketingovo_ads_cabinets` to see which cabinets the workspace reads,
   their currency, and the spend caps the operator set. Ask which project is
   meant if it is ambiguous — never guess.
2. Call `marketingovo_ads_audit_start`, then poll `marketingovo_run_get` until
   the run leaves the running state. A `partial` run means at least one cabinet
   could not be fully read; name which, and why.
3. Read `marketingovo_ads_performance` for each cabinet and report Facebook and
   Instagram separately. They are different auctions with different costs, and
   an account total hides which one is working.
4. A null metric was not measured. Say so and give the stated reason rather
   than filling the gap with generic advice — never report it as zero spend,
   zero conversions, or a cost per result derived from a missing denominator.
   Reach and frequency have no window total by design.
5. Rank findings by measured money at stake, not by rule severity alone.

You may draft campaigns with `marketingovo_campaign_stage`. You cannot approve
or publish one, and no tool here can: a person approves what runs under their
brand, in the dashboard. Say the drafts are waiting for review rather than
describing anything as launched.

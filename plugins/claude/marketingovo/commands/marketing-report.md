---
description: Build a client-facing report across paid, organic, social and email.
---

Build the cross-channel report for the period in $ARGUMENTS.

1. Call `marketingovo_marketing_report` for the project named in $ARGUMENTS.
   Ask which project is meant if it is ambiguous — never guess.
2. Read every section, including the ones marked unavailable. A section that
   could not be read is a finding, not an omission.
3. Write the narrative. Report each channel's own figures.

Three things you must not do, because this document goes to a client who
cannot check it:

- **Never add conversions across channels.** Meta counts conversions it
  attributes on its own window; Analytics counts key events on a last-click
  session model. The same purchase appears in both, so a sum is larger than
  what happened. The report refuses this total — repeat the refusal.
- **Never turn an unavailable source into zero.** If Search Console was
  disconnected, say so. "Organic clicks: 0" is a different claim, and a false
  one.
- **Never compute a change against an unmeasured period.** The report already
  withholds those; do not reconstruct them.

Say plainly what the period showed and what could not be seen. A report whose
gaps are stated is worth more to a client than one that reads as complete.

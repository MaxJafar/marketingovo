---
description: Build a tagged campaign link and a QR code that never expires.
---

Build the campaign link described in $ARGUMENTS.

1. Call `marketingovo_campaign_link` for the project named in $ARGUMENTS. Ask
   which project is meant if it is ambiguous — never guess.
2. If it returns blocking findings, nothing was created. Fix them and call
   again; the suggested tagging comes back in the same response.
3. Report the printed width the code was judged against, and its verdict.

Ask where the code will be used before building it. Placement decides both the
error-correction level and the minimum size, and it cannot be inferred from a
URL — a code on packaging is scuffed and curved, one on a poster is read from
across a room, one on a screen is neither.

What this tool refuses, and why it refuses rather than warns:

- **Tagging that splits a campaign.** Capitals and spaces produce two rows in
  reporting that no tool can merge afterwards. Every other check in this
  product records a problem and carries on; this one cannot, because a printed
  code has no second attempt.
- **Manual tags on an already auto-tagged link.** If the destination carries a
  `gclid` or similar, the platform is already tagging it, and adding UTM
  parameters overrides the identifier that supplies the cost and conversion
  data. The reporting gets worse, not better.
- **A code too small to scan.** Error correction recovers damaged modules, not
  ones the camera never resolved. No amount of it fixes a code printed at
  15mm.

Two things worth telling the operator plainly:

- The code encodes the URL directly. Nothing resolves it, so it cannot be
  revoked, metered or taken behind a paywall, and it works for as long as the
  paper does.
- Because of that, it also cannot be changed. If they need a destination they
  can re-point later, generate a redirect config instead and print a short link
  on a domain they already own.

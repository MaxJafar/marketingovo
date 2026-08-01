# AGENTintel — archived

**This project is archived. Its work continues in
[Marketingovo](https://github.com/MaxJafar/marketingovo).**

AGENTintel was a local, evidence-first competitive research daemon. It was
merged into Marketingovo rather than shipped separately, because the two
products answered overlapping questions — "how does my site compare" — and
splitting them meant two installs, two dashboards, and half the value in each.

## Why it was archived rather than released

A brief `v1.0.0` tag existed here. It was never pushed or published, and it is
retracted: it claimed a standalone product that the merge had already absorbed.
Keeping it would have meant publishing two 1.0.0 products, one of which was a
shell. The last tag that describes something real is `v0.2.0-alpha.0`.

## What moved to Marketingovo

- **Competitor publishing cadence.** The RSS/Atom reader and its honest metrics
  — cadence carrying its own numerator and denominator, no cadence at all from a
  single dated post, a count and nothing else from an undated feed, and no
  inferred engagement, audience or reach.
- **The evidence discipline.** Typed unavailability instead of empty results, and
  the rule that an absent measurement is never a zero.
- **The SSRF corpus.** Marketingovo's egress guard turned out to be stronger than
  this one — it validates the address dialled after DNS, which covers the numeric
  shorthand family for free — so the code was not ported. The corpus that found
  bypasses here now protects it, and closed two real gaps there: URL credentials
  and well-known non-HTTP service ports.

## What did not move, and why

- **The Go daemon and Python worker (~17,700 lines).** Marketingovo runs on Node
  alone. Carrying a second and third runtime would have turned `npx marketingovo`
  into a five-toolchain install, which was the single largest barrier to anyone
  using it.
- **The Arrow/Parquet/DuckDB analytics.** Genuinely capable, and the main thing
  lost. If large local analysis becomes necessary, DuckDB has Node bindings and
  can return without the runtime sprawl.

## Unresolved when archived

- **The reference corpus.** `TO REVERSE ENGINEEER/` holds third-party projects,
  many under GPL or AGPL. It is excluded from version control and from every
  build, test and product input, and nothing was copied from it. A clean-room
  provenance record was planned and never written. Anyone reviving connector work
  derived from studying that corpus needs to write it first.
- **Worker SIGTERM responsiveness.** Documented in `docs/status.md`. It did not
  affect production cancellation, which used `Process.Kill()`.

The history is intact. Nothing here was published to any registry.

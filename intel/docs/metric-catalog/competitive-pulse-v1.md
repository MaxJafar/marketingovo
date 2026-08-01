# Competitive Pulse metric definitions v1

These definitions are contracts, not display labels. A report must cite the
observation set used and must not substitute a different denominator silently.

## `followers.v1`

- **Observation:** provider- or page-reported public account follower count.
- **Delta:** chronologically last available observation minus first available
  observation inside the selected period.
- **Missing behavior:** no estimate and no zero fill.
- **Prohibited interpretation:** customer count, customer retention, revenue,
  loyalty or churn.

## `public-engagement-by-followers.v1`

- **Numerator:** the interactions explicitly exposed by the source for one
  content record. The connector records which interaction types are included.
- **Denominator:** public follower count paired to the content observation under
  the connector's documented temporal matching rule.
- **Rate:** numerator divided by denominator when both are available and the
  denominator is greater than zero.
- **Cohort statistic:** median of valid content-level rates; never the ratio of
  two independently aggregated totals unless labeled as another definition.
- **Missing behavior:** exclude the content record from the rate distribution
  and reduce coverage/confidence; do not create zero engagement.

## `posting-cadence.v1`

- **Numerator:** distinct public content identifiers with a permitted published
  timestamp in the selected period.
- **Denominator:** the target/platform observation-coverage window in weeks,
  from the earliest to latest included observation used by the comparison. This
  keeps quiet days inside the monitored period instead of shrinking the window
  to the first and last post.
- **Minimum window:** when the observed span is under seven days, normalize by
  a seven-day window and mark the short-window limitation.
- **Result:** posts per week, with source coverage stated.

## `content-format-mix.v1`

- **Numerator:** distinct included content records for a normalized format.
- **Denominator:** all included content records with a known normalized format.
- **Result:** a distribution that sums to one within floating-point tolerance.
- **Unknown formats:** remain an explicit `unknown` bucket rather than being
  coerced to video, image or text.

## Confidence

Confidence is not model certainty alone. It combines evidence coverage,
freshness, source availability, connector/parser confidence and unresolved
contradictions. The first fixture reports deterministic values for testing, but
production connectors must publish their calibration and known failure modes.

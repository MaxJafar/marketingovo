# Competitive Pulse deterministic baseline — model card

## Identity

- Model ID: `competitive-pulse-baseline@0.1.0`
- Type: deterministic descriptive analytics; no trained parameters
- Owner: Golem Intel Community
- Inputs: validated `golem.observations.v1` evidence selected by target ID
- Outputs: `golem.comparison-report.v1`

## Intended use

The baseline compares public or properly authorized social observations. It
computes follower change, a median engagement rate within one explicit platform
and metric-definition series, weekly content cadence, and content-format mix.
It is an architectural acceptance model for replay, citation, and provenance—not
an audience-authenticity classifier, forecasting system, or decision engine.

## Method

- Follower change is `latest observed follower count - earliest observed
  follower count` within the selected platform and metric-definition version.
- Median engagement is calculated only within the selected platform and exact
  denominator-bearing metric-definition version. Values from different
  definitions are never pooled.
- Weekly cadence is distinct published content divided by the target's observed
  coverage duration in weeks, with a one-week minimum denominator.
- Format mix is the share of distinct content IDs in each observed dimension.
- Metric calculations include only `available`, positive-coverage, rights-permitted
  `observed` or `first_party` rows. Excluded evidence remains in the immutable
  artifacts and is disclosed in the report.
- Confidence is a transparent weighted coverage score: 50% mean source
  confidence, 20% follower endpoint coverage, 20% engagement sample coverage
  (four observations saturates it), and 10% temporal coverage (21 days
  saturates it).

When more than one eligible series exists, the implementation selects the series
with the most observations, then resolves ties lexicographically. It emits a
warning and contradiction; it does not silently aggregate the series.

## Provenance and training data

There is no training data. Acceptance and calibration checks use the synthetic
`fixtures/competitive-pulse` corpus, whose fictional `.invalid` URLs cannot
contact live services. Runtime observations retain connector versions, source
URLs, native IDs, timestamps, confidence, acquisition classification, purpose,
and evidence IDs.

## Evaluation and calibration

Tests assert exact arithmetic against the synthetic corpus, schema and hash
integrity, deterministic replay, denominator isolation, path containment,
corruption simulation, cancellation, and property-based normalization. Because
the output is descriptive rather than probabilistic, the confidence value is a
coverage indicator and is not calibrated as a probability of truth.

## Limitations and prohibited uses

- Public follower change is not customer retention, churn, revenue, or company
  performance.
- Engagement values are only comparable when platform, numerator, denominator,
  period, and metric-definition version are equivalent.
- Missing observations do not mean zero activity. The worker fails closed when
  its required metrics are absent.
- Source-reported counts may be delayed, rounded, deleted, revised, or incomplete.
- This baseline must not be used for employment decisions, protected-trait
  inference, individual surveillance, deanonymization, credit, insurance, or
  eligibility decisions.
- It performs no contact discovery, biometric matching, covert enumeration,
  access-control bypass, or private-data collection.

## Reproducibility and change control

The report timestamp is derived from the latest committed input timestamp, JSON
uses canonical key ordering, rows use a stable sort, and all package versions are
pinned in `uv.lock`. Any formula or selection-policy change requires a new model
version, updated tests, and a revised model card.

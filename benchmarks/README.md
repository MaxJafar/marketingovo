# Correctness benchmark

`pnpm benchmark` runs the fixed `community-synthetic-v2` SEO corpus against a
loopback fixture and the `public-web-osint-synthetic-v1` OSINT corpus against
injected, offline observations. Version 2 contains 26 exact `ruleId + path`
defect instances and two explicitly healthy control pages. The OSINT corpus has
five cases covering linked public signals, missing signals, blocked targets,
target-budget bounds, and the private-target boundary. The gate measures
independent promises:

- at least 95% recall across the labeled instances;
- less than 5% unexpected High-severity findings and no unexpected High finding
  on either healthy control page;
- no severity drift for a detected labeled instance;
- elapsed time no more than 20% above the checked-in release baseline.

The OSINT cases additionally require stable SHA-256 claim fingerprints,
recomputable dossier provenance, source-linked evidence, explicit missing and
failed states, the public-only policy, and a five-target cap. They use reserved
`.invalid` hosts and injected crawl/feed seams, so the benchmark never contacts
the public web. The inspectable manifest is
`fixtures/osint-research-v1/manifest.json`.

Informational and deliberately unlabelled findings remain visible in the
benchmark output, but cannot hide a missed defect, a severity mismatch, or a
High-severity false positive.

The checked-in baseline is calibrated for developer hardware, not for the
slowest runner. `baselineProvenance` in the corpus manifest records the
measurement it came from, so the number is auditable rather than folkloric.

This is deliberately the strict direction. A conservative default sized for
shared CI cannot fail on a fast workstation — at 500 ms against a measured 58 ms
median it had 8.6x of slack, so a doubling of crawl time would have passed
`pnpm check` in silence. Slower environments therefore declare their own
allowance through `MARKETINGOVO_BENCHMARK_BASELINE_MS`, which makes the looseness
visible at the point that needs it; the shared-runner value lives in
`.github/workflows/ci.yml`.

Any baseline update must include the runner specification and benchmark evidence
in the pull request. Raising it only to make a regression pass is not accepted.

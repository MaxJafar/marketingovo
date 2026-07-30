# Community benchmark

`pnpm benchmark` runs the fixed `community-synthetic-v2` corpus against a
loopback fixture. Version 2 contains 26 exact `ruleId + path` defect instances
and two explicitly healthy control pages. The gate measures independent
promises:

- at least 95% recall across the labeled instances;
- less than 5% unexpected High-severity findings and no unexpected High finding
  on either healthy control page;
- no severity drift for a detected labeled instance;
- elapsed time no more than 20% above the checked-in release baseline.

Informational and deliberately unlabelled findings remain visible in the
benchmark output, but cannot hide a missed defect, a severity mismatch, or a
High-severity false positive.

The default baseline is deliberately conservative for shared CI runners. A
controlled release runner may set `AGENTSEO_BENCHMARK_BASELINE_MS` to its
recorded median without changing the correctness corpus. Any baseline update
must include the runner specification and benchmark evidence in the pull
request; raising it only to make a regression pass is not accepted.

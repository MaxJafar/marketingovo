---
description: Compare brands or creators over the same sources.
---

Compare the targets in $ARGUMENTS under identical collection settings.

1. Call `agentintel_compare_start` with every target.
2. Poll `agentintel_run_get` until it finishes.
3. Report denominator-safe metrics only. Missing measurements are unavailable,
   never zero. Name the sources that failed or were skipped.

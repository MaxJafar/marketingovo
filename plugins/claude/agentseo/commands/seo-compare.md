---
description: Compare a project against competitor URLs.
---

Compare an AGENTseo project against competitors under identical crawl settings.

1. Call `agentseo_compare_start` with the project and the competitor URLs in
   $ARGUMENTS. Ask which project is meant if it is ambiguous — never guess, and
   never substitute a competitor URL the user did not give you.
2. Poll `agentseo_run_get` until the run finishes.
3. Report only differences the run actually measured. Separate structural gaps
   from content gaps, and state which competitor pages were not reachable.
4. Use `agentseo_run_evidence` to show the rows behind a claimed gap rather
   than describing it.

Do not infer a competitor's traffic or rankings; AGENTseo does not measure them.

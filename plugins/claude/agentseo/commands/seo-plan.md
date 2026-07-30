---
description: Build a content plan from seed topics.
---

Build an AGENTseo content plan from the seed topics in $ARGUMENTS.

1. Call `agentseo_content_plan_start` with up to ten seeds.
2. Poll `agentseo_run_get` until it finishes.
3. Present clusters with their supporting keyword evidence. Mark any cluster
   whose demand signal is unavailable as unavailable — not as zero.

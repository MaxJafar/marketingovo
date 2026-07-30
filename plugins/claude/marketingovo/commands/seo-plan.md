---
description: Build a content plan from seed topics.
---

Build an Marketingovo content plan from the seed topics in $ARGUMENTS.

1. Call `marketingovo_content_plan_start` with up to ten seeds for the project
   named in $ARGUMENTS. Ask which project is meant if it is ambiguous — never
   guess.
2. Poll `marketingovo_run_get` until it finishes.
3. Present clusters with their supporting keyword evidence. Mark any cluster
   whose demand signal is unavailable as unavailable — not as zero.
4. Do not invent a publishing cadence, word count, or traffic projection. If the
   run could not support a cluster, name the missing evidence rather than filling
   the gap with generic advice.

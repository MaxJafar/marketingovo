---
description: Research keyword demand and intent for a seed.
---

Research keyword demand for the seed in $ARGUMENTS.

1. Call `agentseo_keyword_research_start` for the project named in
   $ARGUMENTS. Ask which project is meant if it is ambiguous — never guess.
2. Poll `agentseo_run_get` until it finishes.
3. Report intent classification and momentum with the evidence behind each.
   Name the configured sources; if a source is not connected, say so.
4. Do not invent search volume. Autocomplete breadth is not demand, and a
   provider value that was not returned is unavailable, never zero. Name the gap
   instead of filling it with generic advice.

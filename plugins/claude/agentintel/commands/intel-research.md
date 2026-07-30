---
description: Run cited research on a company, brand, or market.
---

Run AGENTintel research and separate observations from estimates.

1. Call `agentintel_research_start` for the subject in $ARGUMENTS.
2. Poll `agentintel_run_get` until the run leaves the running state.
3. Report only claims the run cites. Every material conclusion needs an
   observation citation; if there is none, say the evidence is absent instead of
   inferring.
4. Preserve contradictions rather than averaging them away, and repeat the
   run's own warnings (for example that follower change is not customer
   retention).

The daemon owns credentials. Never request, echo, or pass API keys or cookies.

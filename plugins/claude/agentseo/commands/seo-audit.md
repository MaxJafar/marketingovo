---
description: Audit a project and rank the actions that matter most.
---

Run an AGENTseo audit and report prioritized, evidence-backed actions.

1. Call `agentseo_audit_start` for the project named in $ARGUMENTS (ask which
   project if it is ambiguous — never guess).
2. Poll `agentseo_run_get` until the run leaves the running state.
3. Report only findings present in the run's issues. Cite the run id and the
   affected URLs. If the run is `partial`, say which evidence is missing rather
   than filling the gap with generic advice.
4. Rank by measured impact, not by rule severity alone.

Never request or echo API keys, OAuth values, or cookies.

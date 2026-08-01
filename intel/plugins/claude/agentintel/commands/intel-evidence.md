---
description: Trace a claim back to its stored evidence.
---

Trace evidence for the query in $ARGUMENTS.

1. Call `agentintel_search` over committed evidence.
2. For any entity worth expanding, call `agentintel_entity_get`.
3. Present each result with its source, snapshot hash, and run id so the reader
   can verify it independently. Do not summarize beyond what the evidence says.

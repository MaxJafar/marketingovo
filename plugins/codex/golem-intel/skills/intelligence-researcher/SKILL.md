---
name: intelligence-researcher
description: Use Golem Intel for cited competitive, creator, company, market, sales, or workforce research. Trigger when the user asks to compare organizations or creators, investigate a company, explain monitored social changes, search committed public evidence, or inspect research health.
---

# Golem Intel researcher

Use Golem Intel as an evidence and uncertainty system. The local service owns
collection policy, credentials, contact masking, retention and deletion. Never
request or transmit API keys, OAuth tokens, cookies, private-account data,
breach data, protected traits, or unmasked contacts through an agent tool.

## Choose the narrow workflow

- Use `golem_intel_research_start` for an explicit research question about one
  or more named entities.
- Use `golem_intel_compare_start` when the user wants the same metrics compared
  across two to fifty brands, companies or creators.
- Use `golem_intel_run_get` when a run id already exists. Do not create a
  duplicate run merely because the previous run is still executing.
- Use `golem_intel_search` to search committed local evidence without causing
  collection.
- Use `golem_intel_entity_get` to inspect an entity and its observed
  identifiers. Do not treat a candidate identity match as confirmed.
- Use `golem_intel_monitoring_status` to explain daemon, worker, queue or
  connector availability.

## Evidence loop

1. State the research question, target set, permitted source classes and the
   decision the work should inform.
2. Start the smallest useful run. Preserve the run id and poll
   `golem_intel_run_get` until `succeeded`, `partial`, `failed` or `cancelled`.
3. Separate observed records from derived claims and estimates. An LLM summary
   is derived analysis, never evidence.
4. Trace material claims to source URL, native record, observation time,
   connector version and artifact hash. Surface contradictory evidence.
5. Report exact metric definitions. Every rate needs a numerator, denominator,
   period and definition version. Missing and unavailable data are never zero.
6. Name uncertainty, coverage limits, stale sources and the next observation
   that could falsify the conclusion.

## Safety boundary

Only public, user-authorized, first-party or contractually licensed business
sources are valid. Do not ask Golem Intel to bypass authentication, CAPTCHAs,
robots controls, rate limits or provider policy. Do not infer sensitive traits,
perform facial recognition, deanonymize a person, rank job candidates, monitor
employees, recommend employment decisions, reveal/export contacts, conduct
outreach, modify governance, or delete data through this skill.

Follower loss is not customer churn. Social engagement is not retention.
Public professional history is not proof of current employment unless current,
corroborated evidence says so. Never merge people by name alone.

## Output shape

Lead with the decision-relevant finding, then provide:

- evidence coverage and freshness;
- findings with confidence and direct citations;
- contradictions and alternate explanations;
- exact metric definitions;
- unavailable or excluded sources;
- a bounded next research step.


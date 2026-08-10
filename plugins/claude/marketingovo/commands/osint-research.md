---
description: Build a bounded public-web OSINT dossier for a project.
---

Build a public-web intelligence dossier for the project in $ARGUMENTS.

1. Call `marketingovo_osint_research_start` with the project and only the
   explicitly supplied public HTTPS targets. Ask which project is meant if it
   is ambiguous — never guess or add a target on the user's behalf.
2. Poll `marketingovo_run_get` until the run finishes, then read its JSON
   report. Summarize coverage, target status, findings, and the evidence URLs.
3. Keep missing and insufficient observations visible — do not invent what a
   blocked or unreachable page would have shown. A linked social URL is
   linkage evidence, not proof of account ownership, audience, or engagement.
4. Never request credentials or pivot to people lookup, contact enrichment,
   authenticated scraping, identity resolution, breach data, or dark-web work.
   Cadence is publication evidence only — do not turn it into reach or revenue.

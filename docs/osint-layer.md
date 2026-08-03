# Public-web OSINT layer

Marketingovo has a first-class `osint-research` workflow. It is an
evidence-preserving research layer for SEO and competitive intelligence, not a
people-search or credential-enrichment product.

## What it observes

For the project origin and up to four explicitly supplied public HTTPS targets,
the bounded collector records:

- same-origin crawl coverage, page titles, meta descriptions, canonicals, robots
  outcomes, and XML sitemap capture;
- exact public social-profile URLs linked by observed pages;
- schema.org `sameAs` URLs as unverified structured claims;
- public business paths such as contact, about, press, media, security, privacy,
  and terms pages;
- response `Server` headers when exposed; and
- RSS/Atom publication evidence with dated-item counts, freshness, and measured
  intervals.

Every observation carries a source URL, source class, timestamp, confidence,
and one of `available`, `missing`, `insufficient`, or `contradictory`. The
workflow also emits an exact-match entity/relationship graph and descriptive
findings that cite the evidence IDs behind them. Repeating the pass compares
the latest dossier with the previous completed pass and reports added, removed,
and changed public signals. A target that is blocked on the newer pass is
excluded from removal comparisons, so an outage cannot be mistaken for a
disappearance.

## Product surfaces

- Dashboard: `/osint`, with a bounded target form, coverage/policy state, target
  dossiers, findings, graph counts, source links, and cited pass history.
- Runtime: `osint-research`, persisted as `report.json` and available through
  the normal run report endpoint.
- Dashboard API: `/api/v1/osint?siteId=...`, which returns the latest dossier
  and the bounded comparison against the previous completed pass.
- CLI: `marketingovo osint <project-id> [public-target-url ...]`, returning the
  queued run immediately and using the same four-target cap.
- MCP/OpenClaw: `marketingovo_osint_research_start`, which starts the same
  durable workflow and keeps the target cap and public-only language visible to
  agents.

## Hard limits

Collection is public-web-only and same-origin after an explicit target is
provided. Personal data, email/phone registration, breach lookup, contact
enrichment, identity resolution, authenticated scraping, account recovery
probes, dark-web collection, platform API harvesting, and bot-evasion behavior
are disabled. Social output proves that a URL was published by the observed
site; it does not prove account ownership, audience, engagement, or revenue.
Pass history matches exact normalized target URLs only; adding a different
target does not create an inferred identity relationship.

The implementation is authored against Marketingovo contracts and public-web
standards. It does not import, execute, or package third-party source trees.

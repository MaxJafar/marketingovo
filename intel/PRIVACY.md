# Privacy and People-Data Policy

This policy governs AGENTintel development and default product behavior. Deployers may have additional legal duties, but they may not weaken these product guardrails.

## Purpose and source limitation

AGENTintel is for company, market, creator, and campaign research using evidence from public, authorized, or licensed sources. Collection must have a documented purpose before it starts. “Collect everything” is not a valid purpose.

Permitted source classes are:

- public information whose collection and retention are permitted for the use;
- first-party data connected by an authorized workspace owner;
- official APIs used within granted scopes and platform terms; and
- licensed provider data used within its contractual purpose and redistribution limits.

Private, deceptive, stolen, breached, or access-controlled data is not a permitted source. A user-provided URL or identifier does not prove authorization.

## Data minimization

Store the smallest evidence needed to answer the approved research question. Prefer aggregated company/account metrics over person-level records. Preserve source provenance and confidence, but avoid mirroring full pages or media when a hash, excerpt permitted by policy, or derived metric is sufficient.

Raw evidence, derived records, exports, caches, embeddings, and backups must have an owner and an expiration policy. Indefinite retention is prohibited by default. When a source requires shorter retention or deletion, that requirement follows every derived artifact where technically possible.

## People and contact data

Person-level collection is disabled unless a documented workflow requires it and passes privacy review. When enabled:

- collect only public professional fields relevant to the approved business purpose;
- prefer role-based or company-published business contact channels;
- do not collect personal phone numbers, home addresses, personal email addresses, family relationships, private social accounts, or precise locations by default;
- do not unmask, guess, or enrich redacted contact details;
- retain source, collection time, confidence, and whether the field was self-published, company-published, user-authorized, or provider-licensed;
- keep uncertain identity matches separate and require human confirmation before outreach or export;
- honor suppression, correction, access, objection, and deletion requests across search indexes, graphs, caches, exports, and future refreshes;
- prevent bulk export unless the workspace, purpose, source terms, and recipient are explicitly approved and audited.

Public availability does not remove privacy risk. Contact discovery must not become harassment, doxxing, surveillance, or a mechanism to bypass a person’s preferred contact channel.

## HR and high-impact decisions

The product must not score or rank people for employment suitability, performance, retention risk, compensation, promotion, discipline, termination, or workforce reduction. It must not infer sensitive/protected traits or use proxies for them.

Company-level workforce research may use licensed or company-published aggregates. Individual professional histories may be displayed only for a legitimate research purpose, with provenance and uncertainty, and never as an automated employment recommendation.

“Employee retention” must mean an aggregated, methodologically documented metric from authorized first-party or licensed data. It must not be inferred from private activity, personal social behavior, or silent tracking.

## Metrics and inference quality

Every metric must state its population, time window, source coverage, exclusions, transformations, and limitations. Do not present public engagement as customer retention, correlation as causation, or username similarity as confirmed identity.

Sensitive inference—including ethnicity, gender identity, sexuality, health, religion, politics, disability, pregnancy, union status, financial distress, criminality, or precise location—is prohibited even when a reference project demonstrates it.

## AI and third-party processors

- Do not send personal data, secrets, authenticated page content, or quarantined material to an external model provider without an approved processor configuration, contractual coverage, minimization, and user disclosure.
- Redact unnecessary identifiers before model use.
- Embeddings and prompts inherit the retention and deletion rules of their source data.
- Agent conclusions must cite evidence and expose uncertainty. Models may not independently authorize collection, identity merges, outreach, or high-impact decisions.

## User control and transparency

Workspaces must be able to identify active connectors, source classes, credentials/scopes, collection schedules, retained datasets, exports, and deletion status. Material automated collection should be pausable, auditable, and reversible.

Privacy requests must be routed through the deployer’s published contact process. Until that process is configured, person-level production collection must remain disabled. Requests must be authenticated proportionately without demanding additional unrelated personal data.

## Children and vulnerable people

Do not intentionally collect or profile children. If a dataset is likely to include children, vulnerable people, victims, witnesses, or protected communities, collection requires a dedicated safety/privacy review and is disabled by default.

## Reference laboratory

The local reverse-engineering archives are not product datasets. They must not be indexed into product search, embedded, uploaded to model providers, or copied into fixtures. Suspicious paths listed in the quarantine manifest may be handled only under the path-only rules in `SECURITY.md` and the clean-room ADR.

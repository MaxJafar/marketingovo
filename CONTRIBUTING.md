# Contributing to AGENTintel

Contributions must preserve three boundaries: independently authored product code, public/authorized/licensed data access, and privacy-safe treatment of people.

## Before implementation

1. Define the user-visible capability and the evidence required to support it.
2. Classify every source as public-and-permitted, user-authorized first party, official API, or licensed provider.
3. Identify whether person-level data, credentials, authenticated sessions, third-party content, or high-impact use is involved.
4. Add or update product contracts and independently authored synthetic fixtures.
5. Obtain security/privacy review before implementing a high-risk connector, contact workflow, identity resolution, bulk export, or new AI processor.

If authorization, source terms, or the people-data purpose are unclear, stop and ask for review. Do not solve ambiguity with anti-detection or more aggressive collection.

## Reference-lab rules

`TO REVERSE ENGINEEER/` is an isolated research laboratory, not vendored code.

- Never import, execute, compile, mount, symlink, package, or copy from it.
- Never paste archive code into issues, prompts, pull requests, tests, or product documentation.
- Do not translate or structurally paraphrase archive implementations.
- Production implementers work from approved behavioral cards, public standards/API documentation, product contracts, and independently written tests.
- A verified upstream release may be proposed as a normal dependency only after license, security, maintenance, and platform-policy review. The local snapshot is never the dependency source.
- Reciprocal code, platform-restricted samples, and licensed datasets require the exception path in ADR 0001.
- Quarantined files must not be opened in tools that echo content. Never copy their values, even for debugging.

When adding a reference snapshot to the local lab, update both the provenance ledger and behavioral-card index. Record the upstream URL and commit when available, acquisition date, license evidence, capability, risk IDs, decision, and any quarantine paths. An archive without that record is a validation failure.

## Connector requirements

A connector pull request must include:

- a typed input/output contract and normalized evidence schema;
- source classification, permitted purpose, authentication mode, scopes, rate limits, and retention constraints;
- provenance fields and deterministic error categories;
- bounded concurrency, backoff, timeouts, cancellation, and a kill switch;
- SSRF/egress protections and content size/type limits;
- synthetic or licensed fixtures with no real credentials or unnecessary personal data;
- tests for cancellation, replay/idempotency, partial failure, source changes, and redaction;
- documentation explaining what the connector cannot measure or infer.

Unsupported behavior includes CAPTCHA bypass, credential/session acquisition, anti-detection, access-control evasion, account-recovery probing, and automated interaction likely to affect a target account.

## People, contact, and HR contributions

Do not implement protected-trait inference, personal contact unmasking, doxxing, precise-location tracking, or automated employment recommendations. Identity-resolution code must preserve alternatives and confidence; it may not silently merge ambiguous people.

Company-level engagement and workforce metrics must document source coverage and methodology. Do not label public activity as retention. Real retention metrics require authorized first-party or licensed cohort data and privacy review.

## Secrets and fixtures

- Use ignored local environment files or the approved secret store.
- Never commit tokens, cookies, passwords, private keys, real provider responses, or session databases.
- Redact authorization headers, query credentials, personal contacts, and provider payloads from logs.
- Prefer generated fixtures. If a licensed fixture is necessary, document its source, permission, minimization, retention, and deletion path.
- Treat a discovered credential as compromised; report it privately and do not include it in a patch or issue.

## Required reference checks

Run these from the repository root:

```sh
node scripts/reference-lab-validate.mjs
node scripts/scan-reference-secrets.mjs --fail-on-unquarantined
```

The validator must report exactly 50 inventory entries and zero build inputs;
that check does not imply exact upstream provenance is complete. The scanner may
report only relative paths and rule IDs. Do not modify it to print values,
matching lines, snippets, or context.

Also run the component-specific build, type, lint, and test commands relevant to your change. Document what was run and any checks that could not run.

## Review checklist

- [ ] Product code is independently authored and does not reference the archive tree.
- [ ] Dependencies come from verified upstream releases with reviewed licenses.
- [ ] Sources are public-and-permitted, authorized, official, or licensed.
- [ ] People-data and HR guardrails are satisfied.
- [ ] Secrets and fixtures are synthetic, redacted, or properly licensed.
- [ ] Evidence provenance, confidence, retention, and deletion behavior are tested.
- [ ] Agent tools cannot bypass deterministic policy or human-approval gates.

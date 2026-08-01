# Security Policy

AGENTintel is an evidence-first research platform. “Publicly reachable” is not the same as authorized to collect, retain, infer from, or redistribute. Security review covers both conventional software risk and the effect a connector can have on data subjects, platform accounts, and source systems.

## Reporting a vulnerability

Do not put credentials, personal data, exploit payloads, or sensitive source details in a public issue. Use the repository host’s private security-advisory channel or the maintainers’ published private security contact. If neither exists, open a minimal issue requesting a private channel without disclosing technical detail.

Include the affected component/version, impact, safe reproduction preconditions, and a remediation suggestion. Use synthetic accounts and fixtures wherever possible. Do not access data that you do not own or have explicit authorization to test.

## Allowed source policy

A connector may access only a source that is at least one of:

- public and permitted for the proposed automated access and retention;
- explicitly authorized by the account owner or data controller;
- accessed through an official API under valid credentials and scopes; or
- supplied by a licensed data provider whose terms cover the product use.

Every connector must record its source class, authentication mode, permitted purposes, rate limits, retention constraints, and kill-switch owner. A source changing its terms, authentication, robots behavior, or technical controls triggers re-review—not an evasion task.

## Prohibited collection and access behavior

The product and its contributors must not:

- bypass authentication, paywalls, CAPTCHAs, rate limits, access controls, or bot defenses;
- steal, purchase, replay, or solicit session cookies, passwords, API keys, or bearer tokens;
- perform credential stuffing, password spraying, account recovery probing, session hijacking, or unauthorized account challenges;
- exploit a vulnerability to obtain research data;
- use residential proxy rotation, device spoofing, TLS impersonation, or anti-detection techniques to defeat a platform’s controls;
- collect private messages, private groups, non-public profiles, precise real-time locations, or data obtained through deception;
- enrich masked contact fields by attempting to reveal the hidden value;
- crawl or query a target in a way likely to notify, lock, rate-limit, or otherwise affect the target’s account without explicit authorization;
- ingest breach dumps, stolen credentials, malware collections, or dark-web data into the default product path.

Security research exceptions require written scope, authorization, isolation, minimization, and deletion criteria before collection begins.

## Connector security requirements

Connectors must be least-privileged and isolated. New connectors require:

- a typed capability contract and explicit allowed-source classification;
- bounded concurrency, timeouts, backoff, platform-compliant rate limits, and a kill switch;
- strict URL validation and egress controls to prevent SSRF and access to local/cloud metadata networks;
- content-type and size limits before parsing or storage;
- sandboxing for untrusted documents, archives, browser content, and user-supplied transformations;
- idempotency, replay safety, and an immutable audit trail for collection decisions;
- provenance on every artifact: source, retrieval time, connector/version, authorization class, hash, and transformations;
- tests using synthetic or licensed fixtures, never copied personal records.

Agents may propose and plan research, but high-risk collection, new authentication scopes, bulk export, contact enrichment, and destructive actions require deterministic policy checks and explicit human approval. Model output is never authorization.

## Secrets and sessions

- Secrets belong in the approved secret store or local ignored environment configuration, never source, fixtures, logs, telemetry, prompts, screenshots, or exception bodies.
- Long-lived platform sessions are not supported unless a connector has explicit security review and encrypted-at-rest storage with revocation.
- Logs must redact authorization headers, cookies, query credentials, contact fields, and raw provider responses that may contain secrets.
- Suspected exposure is handled as compromise: stop use, rotate or revoke through an authorized operator, preserve path-only evidence, and review downstream access.
- Run `node scripts/scan-reference-secrets.mjs` for the reference lab. Its output may contain only relative paths and rule IDs.

## People and HR safety boundary

AGENTintel must not be used to make or recommend hiring, firing, promotion, compensation, discipline, eligibility, insurance, credit, housing, immigration, or other high-impact decisions about a person. It must not infer protected or sensitive traits, health, religion, politics, sexuality, ethnicity, disability, pregnancy, union status, or precise location.

Public professional information may support company-level research or an explicitly authorized business-contact workflow only when the privacy controls in `PRIVACY.md` are met. A human must review identity matches and material conclusions; ambiguous records stay separate.

## Reference laboratory

`TO REVERSE ENGINEEER/` is untrusted research material. It must never execute in CI or product environments and must never be imported, mounted, symlinked, or packaged. Follow the accepted clean-room ADR and quarantine manifest under `docs/reverse-engineering/`.

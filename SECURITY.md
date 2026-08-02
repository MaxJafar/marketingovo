# Security policy

Security is a release gate for Marketingovo, especially around crawled content,
localhost authorization, browser isolation, SSRF, credentials, and exports.

## Supported versions

| Version             | Security fixes |
| ------------------- | -------------- |
| Latest `1.x` stable | Yes            |
| `0.x` pre-releases  | No             |

## Reporting a vulnerability

Report privately through GitHub's **Report a vulnerability** button on the
[Security tab](https://github.com/MaxJafar/marketingovo/security/advisories/new).
That channel is private to the maintainer until an advisory is published.

Include a description, affected version, impact, and a minimal reproduction. Do
not include real customer secrets. We aim to acknowledge a report within two
business days, provide a status update within five, and coordinate disclosure
after a fix is available.

Please do not open a public issue for a vulnerability, and do not publish a
working exploit before a fix is available.

Do not open a public issue for a working exploit, leaked credential, or bypass
of the egress, vault, localhost session, entitlement, or update-signature
controls.

## Security invariants

- The local API binds only to `127.0.0.1` and rejects untrusted Host and Origin
  values. It does not enable CORS.
- Every user-controlled static, browser, redirect, and webhook destination
  passes through the DNS- and redirect-aware egress policy. Loopback, private,
  link-local, CGNAT, multicast, IPv4-mapped IPv6, and metadata addresses remain
  blocked unless a private-site host/IP is explicitly allowlisted. Metadata is
  never allowlisted. Provider connectors use immutable HTTPS endpoints from
  their manifests, validate every DNS answer, reject redirects, and pin the
  validated address while preserving the provider hostname for TLS/SNI.
- Authorization, cookies, and custom headers are scoped to the exact origin.
- Browser and Lighthouse work runs in child workers with the Chromium sandbox
  enabled. The product fails closed if the platform cannot provide isolation.
- SQLite stores credential metadata and a `secretRef`, never plaintext secret
  values. Secret values are write-only at the API boundary.
- Reports, exports, backups, logs, errors, crash data, and telemetry must not
  contain secrets.
- Project APIs accept identifiers, never arbitrary filesystem paths.
- Installer updates require signatures; release artifacts include checksums,
  an SBOM, and provenance.

The detailed model and acceptance corpus are in
[docs/threat-model.md](docs/threat-model.md).

## Scope assumptions

We defend against a hostile crawled site, malicious local webpage, SSRF and DNS
rebinding, compromised connector, another unprivileged local user, stolen
backup, and dependency compromise. A fully compromised operating system or a
root/administrator attacker is outside the local threat model.

---
title: Security and privacy
description: Understand localhost authorization, egress controls, credential handling, project data, and the threat model.
---

# Security and privacy

Security is a release gate because Marketingovo processes hostile crawled pages, confidential marketing evidence, browser sessions, and provider credentials.

<div class="status-banner">
  <strong>1.1.0</strong>
  <p>Security fixes land on the latest 1.x. Review the supported-version table and report a vulnerability privately rather than in a public issue.</p>
</div>

## Trust boundaries

```text
Dashboard + local daemon, one origin
                │
         session and CSRF
                │
    SQLite metadata + credential boundary
                │
      scoped worker and provider calls
                │
            egress policy
```

The daemon alone owns SQLite and the credential store. The current documented child-process boundary applies to browser and Lighthouse work; those workers receive scoped material and do not open the database or credential store directly. Connector manifests constrain provider hosts and credential shape, but separately isolated connector workers remain a release invariant to verify rather than a current guarantee.

The native launcher keeps sidecar and updater control in Rust. Its dashboard
webview has no Tauri shell, updater, or application command permissions and can
reach product functionality only through the authenticated loopback API.

## Local API authorization

- The API binds only to `127.0.0.1`.
- The server validates `Host` on every request. It validates `Origin` for cookie-authenticated, non-safe browser mutations.
- CORS is not enabled.
- The dashboard exchanges a one-time fragment token for an HttpOnly, SameSite session.
- Browser mutations require a matching origin and in-memory CSRF token.
- Non-browser clients use the private service-token file.
- Rate limits, body limits, CSP, and defensive response headers are applied.

Do not expose the local API through a public proxy or paste the service token into browser fields or agent prompts.

## Egress and hostile sites

Every static request, browser subrequest, redirect, webhook, and provider call is expected to pass through the same egress policy.

The policy blocks loopback, private, link-local, CGNAT, multicast, mapped IPv6, and metadata destinations unless a private-site host or IP is explicitly allowlisted. Metadata destinations are never allowlisted. DNS results and redirects must be validated on every hop.

Authorization headers, cookies, and custom headers remain scoped to the exact origin. Cross-origin redirects and subrequests do not inherit target credentials.

## Credential invariants

- Secret values are write-only at the API boundary.
- SQLite stores metadata and `secretRef`, not plaintext provider secrets.
- Saved values are not returned to the dashboard.
- Engine and connector output is treated as tainted and crosses a run-scoped
  redaction boundary before SQLite, events, reports, exports, backups, or logs.
- Reports, logs, errors, exports, and default backups must not contain secrets.
- The current CLI uses an authenticated encrypted vault when a master password
  is supplied. Without a native broker or master password, the vault remains
  locked and credential writes are refused.
- Credential connection, rotation, and deletion remain human-controlled UI or CLI actions, outside public agent tools.

See [Integrations and BYOK](/integrations/byok) for current setup behavior.

## Privacy model

Marketingovo is local-first. Product telemetry is disabled by default and requires explicit opt-in. Calls made to a configured provider to perform an audit are product functionality, not telemetry.

The first signed desktop process makes one HTTPS update check before the local
daemon starts, whether it was opened by the user or by login startup. Its path
contains the current version, operating-system target, and CPU architecture,
but no stable device identifier, project URL, account, credential, or usage
event. The release host can still receive ordinary HTTPS transport metadata,
including the source IP address and request headers; Marketingovo attaches no
product telemetry identifier. New payloads are installed only after
detached-signature verification. Secondary desktop activations reuse the
existing launcher and npm CLI services do not check; desktop users can opt out
with `--no-update` or `MARKETINGOVO_AUTO_UPDATE=off`.

Projects can contain:

- search queries, clicks, and impressions;
- landing-page and conversion metrics;
- crawl snapshots, page content, and versioned audit evidence;
- competitor inputs and custom rules;
- versioned Project Context and marketer journal entries;
- issue history, actions, reports, and exports.

The user controls project deletion, artifact retention, provider connections,
and optional anonymous telemetry. Local project deletion requires an exact-name
confirmation, stops active work, removes the project graph from SQLite, and
cleans deterministic artifact and custom-rule directories through private
two-phase staging. A structural audit event retains only the opaque project ID
and deleted record counts. Global BYOK credentials remain separately removable
from the local vault because other projects may use them; provider-side
revocation remains a separate operator action. If final file removal is temporarily
blocked, cleanup is retried on service restart. A recovery manifest restores
files when a crash happened before the SQLite commit; unknown staging is kept
and system health becomes degraded rather than deleting data. Project deletion
is a UI/CLI/API operation and is not an agent tool.
There is no hosted edition and therefore no second privacy policy.

## Exports and backups

A `.marketingovo` project bundle can contain configuration, run history, Project
Context revisions, marketer journal entries, issue fingerprints, actions,
metrics, and artifact metadata. It never contains secret values. Context writes
reject secret-like text and local filesystem paths; reconnect each provider
after import.

Treat exported marketing evidence and backups as confidential even when they contain no credentials. Apply the access, retention, and deletion rules appropriate to the underlying analytics and search data.

## Threat model scope

The current model considers:

- a hostile site being crawled;
- a malicious local webpage trying to call the API;
- SSRF, redirect, and DNS-rebinding targets;
- a compromised connector or dependency;
- another unprivileged local user;
- a thief with a project export or backup.

A fully compromised operating system or administrator-level attacker is outside the local threat model.

## Report a vulnerability

Report privately through the **Report a vulnerability** button on the repository's [Security tab](https://github.com/MaxJafar/marketingovo/security/advisories/new), with the affected version, impact, and minimal reproduction. Do not open a public issue for a working exploit, credential leak, or bypass of local authorization, egress, credential, entitlement, or update-signature controls.

The project aims to acknowledge a report within two business days, provide a status update within five, and coordinate disclosure after a fix is available.

<p class="source-note">
  Normative sources: <a href="https://github.com/MaxJafar/marketingovo/blob/main/SECURITY.md">security policy</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/PRIVACY.md">privacy policy</a>, and
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/threat-model.md">threat model</a>.
</p>

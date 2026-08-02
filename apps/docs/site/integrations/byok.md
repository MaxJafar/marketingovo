---
title: Integrations and BYOK
description: Connect provider evidence while keeping credentials write-only and under local control.
---

# Integrations and BYOK

Marketingovo uses a bring-your-own-key model. You choose the provider, account, scopes, and local retention; the local daemon owns the credential boundary. There is no managed-credential alternative — every provider call is made with a credential you supplied, from the machine you run it on.

## Connector catalog

The current source includes these connector manifests:

| Provider              | Authentication contract               | Evidence and capabilities                             |
| --------------------- | ------------------------------------- | ----------------------------------------------------- |
| Google Search Console | OAuth with PKCE, read-only scope      | Search analytics, sitemaps, freshness, paginated rows |
| Google Analytics 4    | OAuth with PKCE, read-only scope      | Landing pages, sessions, engagement, key events       |
| PageSpeed Insights    | API key; optional for supported calls | CrUX, Lighthouse, Core Web Vitals                     |
| Google Trends         | No credential                         | Interest over time and related queries                |
| SerpAPI               | API key                               | SERP results, people-also-ask, related searches       |
| DataForSEO            | Login and password                    | SERP, keyword, content, and competitor data           |

Connector presence does not mean every authorization broker and provider fixture is equally exercised. Use the Integrations workspace and release status to confirm current readiness. The local API returns an explicit error when an authorization broker is not available.

PageSpeed Insights works without an API key for supported public-quota calls.
The dashboard labels its key as optional, does not submit an empty credential,
and lets you test the connection directly. Add a key only when you want your
Google project quota applied.

## Write-only credential flow

```text
Dashboard password field
       │ one same-origin request
       ▼
Local API credential endpoint
       │ validated provider fields
       ▼
Credential store ──► secretRef + masked identifier
       │
       └── scoped material only when a connector runs
```

The dashboard:

- never stores provider secrets in browser storage;
- never reads a saved secret back from the API;
- submits values only to the local credential endpoint;
- renders connection state, safe account labels, sync time, scopes, quota, and redacted errors;
- keeps credential deletion and rotation outside agent tools.

API responses and SQLite records carry a `secretRef` and masked metadata, not plaintext secret values.

**Rotate credentials** replaces the write-only local value. **Revoke local
access** deletes the saved value from Marketingovo for every local project after an
explicit acknowledgement; non-secret per-site mappings remain available for a
later reconnect. Local deletion cannot deactivate an API key or OAuth grant at
the provider, so revoke it in the provider console as well when the credential
itself must stop working.

## Persistent storage

Signed native installers use the operating-system credential vault
automatically: macOS Keychain, Windows Credential Manager, or Linux Secret
Service. The application bundles the broker and refuses to start if that native
credential boundary is missing. Google Search Console and GA4 authorization use
the release's public Google Desktop OAuth client ID with PKCE; there is no
client secret in the application.

The headless CLI route uses an encrypted file vault when a master password is
provided:

Start the local daemon with a master password if provider credentials must survive restart:

```bash
pnpm marketingovo serve --master-password-file /absolute/path/to/password-file
```

The encrypted local vault uses Argon2id key derivation and authenticated encryption. Its directory and file permissions are restricted to the user. Without a master password or native broker, the CLI keeps the vault locked and refuses credential writes.

Do not place provider secrets in shell arguments, repository files, agent prompts, logs, or support tickets.

## Scope and egress

Every manifest declares:

- authentication type and requested scopes;
- allowed provider hosts;
- request rate and concurrency limits;
- provider economics and whether per-request cost is observable;
- credential and configuration schemas;
- normalized output schema;
- raw-payload retention policy;
- declared capabilities.

The egress policy applies to provider calls, redirects, browser subrequests, and private-site access. Provider credentials are scoped to the exact target origin and are not forwarded across cross-origin redirects.

## Source status is part of the result

| State          | Meaning for the marketer                                               |
| -------------- | ---------------------------------------------------------------------- |
| Connected      | The configuration exists; inspect freshness before using the data.     |
| Degraded       | The connector may have a provider, quota, scope, or freshness problem. |
| Expired        | Reauthorization or credential rotation is required.                    |
| Rate limited   | Wait for the reset window or reduce requested work.                    |
| Failed         | The provider call did not produce trustworthy evidence.                |
| Not configured | The source is unavailable and must not be interpreted as zero.         |

## Provider cost is evidence

Research outputs use three explicit cost states:

| Cost state        | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| Provider reported | The provider response contained an observed per-task cost.     |
| Not reported      | The request may be billable, but its cost is unknown.          |
| Free              | The completed request used a source known to be free per call. |

DataForSEO task costs are summed into the latest keyword-research workspace.
SerpAPI quota usage is billable-account context but does not currently report
an observable per-call cost, so Marketingovo never labels it `$0`.

## Provider calls and privacy

Calls to a provider are made only to perform requested product work. They are not product telemetry. Before enabling a connector, confirm the provider, scopes, categories of data sent, and the retention implications for normalized or raw responses.

Project exports omit secrets. Importing a project requires reconnecting integrations.

## Troubleshooting

1. Open **System health** and confirm the daemon and queue are healthy.
2. Open **Integrations** and inspect the exact state, last sync, scope, and redacted error.
3. Use **Test connection** after credential rotation.
4. Run `pnpm marketingovo doctor` for local service and vault context.
5. Treat provider data as unavailable until a successful test and fresh sync prove otherwise.

<p class="source-note">
  Canonical sources: <a href="https://github.com/MaxJafar/marketingovo/blob/main/packages/integrations/src/index.ts">connector manifests</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/PRIVACY.md">privacy policy</a>,
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/SECURITY.md">security policy</a>, and
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/desktop-release.md">desktop runtime configuration</a>, and
  <a href="https://github.com/MaxJafar/marketingovo/blob/main/README.md">project overview</a>.
</p>

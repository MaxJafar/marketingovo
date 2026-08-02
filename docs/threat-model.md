# Threat model

## Assets

- provider API keys, OAuth refresh tokens, cookies, and private-site headers;
- GSC queries, GA4 metrics, conversion data, crawl pages, versioned run
  evidence, Project Context, marketer journal entries, reports, and exports;
- localhost sessions, update keys, audit history, and commercial device tokens.

## Adversaries

- a hostile website being crawled;
- a malicious webpage attempting to call the localhost API;
- an SSRF or DNS-rebinding target, including cloud metadata;
- a compromised connector or dependency;
- another unprivileged local user;
- a thief with a backup or exported project.

Root/administrator compromise and a fully compromised OS are outside the local
threat model.

## Trust boundaries

The dashboard and daemon share one origin. The daemon alone owns SQLite and the
vault. Browser, Lighthouse, and third-party connector work occurs out of process
with an allowlisted environment. Workers receive scoped, short-lived material
and never open the vault or database directly.

Agent terminal sessions add one boundary. A session has a browser side
authenticated by the same-origin cookie and CSRF token, and an agent side
authenticated by the local service token. The daemon never becomes a model
client: it holds no provider key for the conversation and performs no inference,
so a compromised harness gains nothing it did not already have through the
service token it presented. Anything an attached agent writes into a session is
untrusted text authored outside this process; it is rendered as text and is
never interpreted as an instruction by the daemon or the dashboard.

## Required controls

1. Resolve and validate every A/AAAA result for user-controlled crawl and
   webhook destinations on every redirect. Block loopback, RFC1918, link-local,
   CGNAT, multicast, mapped IPv6, metadata names and addresses. Pin the
   validated address for the connection. Provider requests are restricted to
   immutable manifest hosts with redirects disabled and use the same per-call
   DNS validation plus address-pinned HTTPS dispatcher.
2. Route Chromium through the local egress policy; disable direct QUIC, WebRTC
   bypass, and service workers. Sandbox failures stop the job.
3. Scope credentials and cookies to the exact target origin. Cross-origin
   redirects and subrequests receive no target credentials.
4. Keep privileged desktop operations in Rust. The dashboard webview receives
   no Tauri shell, updater, or application command permissions; it reaches the
   daemon only through the authenticated loopback HTTP boundary.
5. Bind to loopback, enforce Host and Origin, disable CORS, use a one-time
   bootstrap exchange, HttpOnly SameSite sessions, CSRF protection, CSP,
   body limits, and rate limits.
6. Store secret material in the OS key store. The headless fallback uses a
   user-provided master password, Argon2id, and authenticated encryption.
7. Use OAuth Authorization Code with PKCE S256, random-port `127.0.0.1`
   callback, one-time state, five-minute expiry, absolute token expiry, and
   refresh serialization.
8. Treat every engine and connector result as tainted. Recursively redact
   structured log messages and context plus the exact credential values active
   for that run before SQLite, events, issues, actions, run-evidence artifacts,
   reports, exports, or backups can receive the result. Backups and project
   exports omit the vault and credential payloads entirely. Evidence artifact
   reads verify containment, declared size, SHA-256, version, and schema before
   returning data.
9. Validate Project Context and journal text at the runtime boundary. Reject
   secret-like values, local paths, malformed profiles, and cross-project run
   references. Keep profile and journal content out of structural audit-event
   payloads and expose agent access as read-only.
10. Keep project deletion outside agent tools. Require an authenticated,
    CSRF-protected mutation and exact current-name confirmation; stop active
    work before staging deterministic project files, commit the SQLite cascade
    before final removal, restore staged files on database failure, preserve
    shared issue definitions, use a content-free recovery manifest to distinguish
    a live project from a committed deletion after a crash, fail closed on
    unknown staging, and retain global credentials as a separate revocable
    lifecycle.
11. Keep desktop updates on the canonical HTTPS GitHub release channel and the
    updater private key outside the repository. Prefix uploaded native assets
    by target, cryptographically verify updater payloads before publication,
    and build `latest.json` only from all four matching verification records
    and byte-for-byte matching payload/signature pairs. Keep the release draft
    until updater metadata, native lifecycle evidence, npm provenance, and
    public-release approval all succeed. The metadata itself selects an update;
    the embedded key, not the transport filename, authenticates the payload.

12. Keep agent terminal sessions credential-free and single-holder. The daemon
    performs no inference and stores no model key for a conversation. Session
    writes require the local service token plus the `agentId` minted at attach,
    so holding the token is not by itself authority to speak into a session
    another agent holds. Leases expire on silence rather than on a clean
    detach, bound message size and history, and keep transcripts in memory so
    free-text typed at the prompt never reaches SQLite, exports, or backups.
    Treat agent-authored session text as untrusted input: render it, never
    execute or interpret it.

## Release abuse corpus

The release suite covers alternate IPv4 encodings, IPv6 and mapped IPv6,
userinfo, IDNA, private DNS, redirect chains, rebinding, metadata hostnames,
unsafe subresources, WebSocket, iframe, service-worker, header leakage,
foreign Host/Origin, CSRF, bootstrap replay, OAuth state/replay/expiry races,
vault tampering, path traversal, project-deletion confirmation/cascade/file
cleanup, updater target gaps, public-key drift, post-verification byte changes,
cross-architecture asset-name collisions, and secret search across
DB/log/report/export/backup outputs. The
consolidated canary test also scans SQLite WAL/SHM files,
run and module errors, integration metadata, HTML/PDF/CSV/JSON reports, project
bundles, and online backups while proving that the encrypted vault can still
recover the original secret.

# ADR 0006 — Publishing mechanics and the media pipeline

Status: accepted, 2026-08-06.
Depends on [ADR 0005](0005-outbound-publish-safety.md), which decided the safety
model. This one decides the mechanics that model requires.

## Context

ADR 0005 built the staging half and deliberately stopped: a brief, its
deliverables, an exact payload, a spend cap, and an approval pinned to the
browser's transport. It listed what had to exist before anything could be sent —
a durable idempotent job, immutable records of what was sent, and per-deliverable
failure — and left them unbuilt.

A unified content calendar is the feature that needs them. A marketer writes one
post and sends it to X, Telegram, a Facebook Page and Instagram at 09:00 on
Thursday. That single sentence contains every hard problem: several providers
with incompatible APIs, an unattended send, a retry that must not double-post,
and four ways to half-fail.

Three properties of the platforms shape everything below, and none of them are
negotiable by us.

**They disagree about media.** Telegram and X accept raw bytes over multipart.
Facebook accepts either bytes or a URL. Instagram accepts **only** a public URL —
its Content Publishing API fetches the asset itself, and there is no upload
endpoint. Instagram also has no text-only post, so an Instagram post without a
publicly reachable asset is impossible rather than degraded.

**They disagree about auth.** Telegram issues a bot token that never expires and
needs no OAuth. X requires OAuth 2.0 PKCE against an app the operator registers,
with refresh. Meta uses the System User token already connected, but publishing
needs write scopes that reading did not.

**None of them offer idempotency.** No provider here accepts an idempotency key.
A retried send is a second post unless we prevent it ourselves.

## Decision

### One intent per destination, and it is the unit of everything

A post to four platforms is one deliverable and four `publish_intents`. Each is
approved, scheduled, sent, retried, recorded and failed independently.

This is not a normalization detail; it is how ADR 0005's "failure is partial and
stays legible" stops being a promise and becomes a property. There is no
campaign-level send, so there is no campaign-level failure state that could hide
a post already live on Telegram while X was rejecting it.

### Publishing is a durable job, not a request

The existing `jobs` table already carries `available_at`, leases, heartbeats,
bounded attempts and dead-lettering. A scheduled post is a job whose
`available_at` is its scheduled time. The calendar therefore needs no scheduler
of its own, and a post survives the daemon being closed between approval and
send.

**Scheduled posts fire unattended.** That is what a calendar means, and it is a
real widening: the daemon performs an outward action with nobody watching. What
makes it acceptable is that the operator approved this exact payload _and_ this
exact time in a browser beforehand, and any change to either voids the approval.
Consent is obtained before the send, not inferred from presence at it.

### Idempotency is ours to provide

Each intent carries an idempotency key generated at approval. The job takes the
key, and the send is guarded by a record written **before** the outbound call:

1. Claim the intent by transitioning `approved → publishing`, conditioned on it
   still being `approved`. A second worker loses the race and stops.
2. Write a `publish_records` row in the `attempting` state with the key.
3. Make the call.
4. Update that row with the provider's response identifier, or its error.

A retry after a crash finds the `attempting` row and does not blindly resend. It
reports the send as `indeterminate` — we know a request left, we do not know
whether it arrived — and asks the operator, rather than guessing. Guessing wrong
in one direction double-posts to the operator's audience; guessing wrong in the
other silently drops a post. Neither is a decision code should make quietly.

### `publish_records` stores the request, not a summary

The exact request body and the provider's exact response identifier. When a post
misbehaves, the question is always "what did we actually send", and a
reconstruction from a template plus current data is not an answer — the template
may have changed since.

Records are immutable and survive the intent, the deliverable and the brief.

### The media pipeline: local by default, relayed only where required

Uploaded assets live on the operator's disk under the workspace, content-
addressed by SHA-256, with the declared media type verified against the actual
file signature rather than trusted from the filename or the client.

For Telegram, X and Facebook the bytes go straight to the platform. **No third
party ever sees the file.**

For Instagram, and only for Instagram, the asset must first exist at a public
HTTPS URL. Two paths, both the operator's choice:

- **Paste a URL you already host.** Nothing is uploaded anywhere; the connector
  validates the URL is public HTTPS and reachable before an intent can be staged
  against it.
- **Configure your own object storage.** S3-compatible credentials in the local
  vault — Amazon S3, Cloudflare R2, Backblaze B2, MinIO, anything speaking the
  same API. Marketingovo signs a PUT with SigV4 and returns the public URL.

The relay is opt-in, it targets a bucket the operator owns, and it exists solely
because Instagram will not take bytes. It is stated in the UI rather than hidden,
because "this file leaves your machine" is exactly the kind of thing a
local-first tool must not do quietly.

### The media relay's egress host is operator-declared

Every connector so far has a compile-time exact-host allowlist. An S3 endpoint
cannot: it is `s3.eu-west-1.amazonaws.com` for one operator and
`<account>.r2.cloudflarestorage.com` or a self-hosted MinIO for the next.

So this one connector's allowlist is authored by the operator in its
configuration. Everything else about the egress policy still applies and is
still enforced at request time: exactly one host, no wildcards, HTTPS only, DNS
re-resolved per call, non-public addresses refused, redirects refused. The
operator widens _which_ host, never _how_ the host is reached.

This is the narrowest form of the change that makes the feature possible, and it
is confined to a connector whose whole purpose is to talk to infrastructure the
operator owns.

### Provider limits are read, recorded and surfaced

X's free tier caps writes to a few hundred posts a month, and Instagram allows
25 published posts per 24 hours per account. A calendar that lets someone
schedule forty Instagram posts for one day and discovers the limit at 09:00 has
failed at the one job a calendar has.

Known limits are checked locally before an intent can be scheduled, and the
provider's own reported remaining quota is stored on the connection when it
returns one. A local check is not authoritative — only the provider knows — so
exceeding it is a refusal at schedule time and a stated reason at send time,
never a silent drop.

## Alternatives rejected

**Publish through MCP instead of provider APIs.** A scheduled post has to fire
whether or not a model is attached. Routing sends through an MCP client would
make the calendar work only while an agent happened to be connected, which is a
reminder rather than a scheduler. Agents keep drafting through the tools they
have.

**One job per deliverable that fans out to every platform.** A partial failure
inside one job has nowhere legible to live, and a retry would resend to the
platforms that already succeeded.

**Resend automatically after an indeterminate attempt.** This is the double-post
that every scheduling tool eventually inflicts on someone. The operator is shown
what we know and decides.

**Host the media ourselves behind a tunnel.** Making a local-first tool serve
public traffic to satisfy one platform's API inverts the product's central
property for a convenience.

**Trust the client's declared media type.** A file's extension and its
`Content-Type` header are both caller-supplied. The bytes are sniffed.

## Consequence

The daemon acquires its first outbound write path, and the two-sided
authentication split becomes load-bearing for the operator's public voice as
well as their ad budget.

The `social` capability from [ADR 0003](0003-optional-website-and-capabilities.md)
becomes derivable rather than reserved, on the same terms `ads` already is: a
credential plus at least one linked account.

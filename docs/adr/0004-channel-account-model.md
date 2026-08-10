# ADR 0004 — The channel account model

Status: accepted and implemented for Meta, 2026-08-05.
Depends on [ADR 0003](0003-optional-website-and-capabilities.md).

Migrations 14 and 15 landed this for the `meta-ads` connector; Google Ads,
LinkedIn and TikTok reuse the same tables and the same checklist below. See the
[Meta Ads guide](../meta-ads.md) for the operator-facing result.

Two things changed between this decision and the implementation, and both are
recorded at the end under **Amendments**.

## Context

The product's next phase unifies marketing channels: ad platforms (Meta, Google
Ads) and social channels (Instagram, LinkedIn, TikTok) alongside the existing
Search Console, GA4, PageSpeed, Trends, SerpAPI and DataForSEO connectors, with
campaign auditing over the paid side.

Three properties of the current design block that, and each needs a decision
before any connector is written.

**A provider is a global singleton.** `integrations` has `provider TEXT PRIMARY
KEY` — no `project_id`, no `account` column. One credential, one status, one
connection per provider for the entire install. `project_integrations` adds only
non-secret config (`{siteUrl}`, `{propertyId}`), one blob per project per
provider. Ad platforms invert this: one login typically reaches _many_ ad
accounts, and different clients need different logins. `CredentialRef.account`
already exists in the vault and is effectively unused — the vault is ready for
multi-account, the metadata layer is not.

**`StoredOAuthCredential` requires a refresh token.** Both the decoder and
`exchangeGoogleAuthorizationCode` reject a payload without a non-empty
`refreshToken`. Meta does not issue one: it returns a short-lived user token
exchanged for a ~60-day long-lived token. TikTok's refresh token carries its own
expiry, and LinkedIn issues them only to approved apps.

**Meta requires a client secret at token exchange.** The existing Google flow is
a public installed-app client using PKCE with no secret, deliberately — a desktop
app cannot hold a client secret safely. Meta's exchange has no equivalent public
mode.

## Decision

### Connections become `(provider, account)`

Widen the `integrations` primary key to `(provider, account)`, defaulting
existing rows to the `"default"` account the OAuth broker and every HTTP entry
point already pass. `credentialReference`, `replaceCredential`, `googleTokenManager`
and the `tokenRefreshes` in-flight map all re-key from `provider` to
`provider + account`. Today two projects sharing Search Console also share one
refresh mutex; after this they do not.

This keeps credentials a global BYOK lifecycle — they may serve more than one
workspace, and stay separately revocable, as the product already documents.

### `channel_accounts` — which external entity a workspace reads

```
channel_accounts
  id             TEXT PRIMARY KEY
  workspace_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  provider       TEXT NOT NULL
  account        TEXT NOT NULL          -- the credential discriminator
  kind           TEXT NOT NULL          -- search | analytics | ads | social
  external_id    TEXT NOT NULL          -- ad account, page, property id
  display_name   TEXT NOT NULL
  currency       TEXT                   -- ads only; never assumed
  created_at     TEXT NOT NULL
  archived_at    TEXT
  UNIQUE(workspace_id, provider, account, external_id)
```

This generalizes `project_integrations`, which today can express exactly one
entity per provider per project. Its config blob remains for connector settings
that are not entity selection.

### `channel_metrics` — the cross-channel fact table

```
channel_metrics
  workspace_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE
  entity_kind        TEXT NOT NULL   -- account | campaign | adset | ad | post | profile
  entity_id          TEXT NOT NULL
  date               TEXT NOT NULL
  metric_key         TEXT NOT NULL   -- impressions | clicks | spend | reach | engagements | ...
  value              REAL            -- nullable, never a substituted zero
  state              TEXT NOT NULL CHECK(state IN ('available','partial','unavailable','failed'))
  currency           TEXT
  source             TEXT NOT NULL
  fetched_at         TEXT NOT NULL
  PRIMARY KEY(channel_account_id, entity_kind, entity_id, date, metric_key)
```

`value REAL` nullable with a separate `state` carries forward the discipline
already enforced by `PerformanceWindowRecord`: a channel that could not be
reached reports `unavailable`, not `0`. A cross-channel dashboard is only
worth building if "we spent nothing" and "we could not ask" stay distinguishable.

Currency is stored per row and never inferred. Summing spend across accounts in
different currencies without a recorded rate is a fabrication, and the roll-up
must decline rather than guess.

### Campaign auditing reuses the existing engine

Ad rules — budget pacing, creative fatigue by frequency, disapproved ads, missing
conversion tracking, CPA drift, audience overlap — emit ordinary `issues` with
stable fingerprints, which flow into the existing prioritized `actions` queue
with its impact/effort/confidence scoring, adjudication and verification.

This is the strongest reuse available in the codebase. The product's "verified
actions, not noise" story extends to paid spend with no new machinery, and
`issue_adjudications` means a marketer can mark a deliberately-high CPA campaign
as an accepted exception exactly as they already do for SEO findings.

### Credentials: support both auth paths

`StoredOAuthCredential` gains a version 2:

```ts
interface StoredCredentialV2 {
  version: 2;
  provider: string;
  account: string;
  kind: "long-lived" | "oauth";
  accessToken: string;
  refreshToken?: string; // absent for long-lived tokens
  tokenType: string;
  expiresAt: string;
  scopes: string[];
}
```

Version 1 payloads stay readable; the decoder accepts both and normalizes.

**Long-lived pasted tokens are the default path.** The operator generates a
System User token in Meta Business Manager (and the equivalent elsewhere) and
supplies it like an API key. No client secret ever reaches the machine, no hosted
component exists, and it reuses the api-key credential path almost unchanged. The
cost is real and should be stated in the UI: setup happens in the provider's
console, and the token must be rotated before it expires. The connector surfaces
`expiresAt` and degrades to `expired` rather than failing silently.

**BYO-app OAuth is the advanced path.** The operator registers their own
developer app and stores its client ID and secret in the local vault, so the full
flow runs on the existing 127.0.0.1 loopback broker against their own app. This
keeps the product local-first for operators who want automatic refresh, and the
secret is theirs rather than one shipped in the binary.

The `GoogleOAuthProvider` union — closed over two Google keys today — lifts to a
provider registry of `{ authEndpoint, tokenEndpoint, scopes, extraAuthParams,
requiresClientSecret, issuesRefreshToken }`. `access_type=offline`,
`include_granted_scopes` and `prompt=consent` move from hardcoded params into
that table.

## Connector checklist

The path is already well-worn; each new connector touches, in order:

1. `packages/integrations/src/egress.ts` — exact hosts, which widens `ConnectorId`
   and makes the compiler point at every exhaustive switch that must be extended
2. `provider-fetch.ts` — a narrow pinned transport
3. `src/index.ts` — the `ConnectorManifest` entry
4. `health.ts` — `HEALTH_ENDPOINTS` and a `buildProbe` case
5. the OAuth provider registry entry, or the api-key credential schema
6. `packages/core/src/integrations/<provider>/` — client plus a pure normalizer
7. `packages/core/src/modules/types.ts` — the `ModuleId`
8. `packages/core/src/modules/integrations/<provider>/index.ts` — exporting
   `<camelCase>Module`, per the loader convention
9. `packages/runtime/src/index.ts` — the credential branch and coverage windows

The egress allowlist is enforced at request time inside the fetch wrapper, with
DNS re-resolved per call and redirects refused, and health probes re-check their
endpoint against the manifest before fetching. New connectors inherit all of
that by construction; none of it should be bypassed for a provider whose SDK
would be more convenient.

## Consequence

`ads` and `social` — already present in the capability vocabulary from
[ADR 0003](0003-optional-website-and-capabilities.md) and reported unavailable —
become derivable from `channel_accounts` without a contract change.

The widened `integrations` primary key is the one genuinely breaking storage
change here, and it is why this ADR is a prerequisite for the 2.0 terminology
rename rather than something to retrofit afterwards.

## Amendments

### `channel_metrics` gained a `platform` column

The table as designed above cannot answer the question a paid marketer actually
asks. Meta bills one cabinet across Facebook, Instagram, Messenger and Audience
Network, and "Instagram costs us three times what Facebook does" is not
derivable from an account total. Every metric row therefore carries the platform
it was measured on, and it is part of the primary key.

`all` is a specific claim — "the provider reported this row without a
breakdown" — and is deliberately distinct from a row that happened to be
Facebook. An unrecognized platform value becomes `unknown` rather than being
folded into `all`, so a new Meta surface cannot make an unattributed row look
attributed.

### `ConnectorManifest.auth.type` gained `long-lived-token`

The ADR anticipated that a pasted Meta token would "reuse the api-key credential
path almost unchanged". It reuses the path, but not the type. An API key that
stops working is a revocation the operator performed; a long-lived token that
stops working is a deadline nobody told them about. Keeping them apart is what
lets the connector read the token's expiry at save time, surface the date, and
degrade to `expired` with a rotation instruction instead of reporting a generic
failure months later.

### Spend caps moved here from ADR 0005

`channel_accounts` carries `daily_spend_cap` and `total_spend_cap` in this
migration rather than in the composer's. The caps are a property of the cabinet,
not of the publish pipeline, and putting them on the cabinet means they exist
and are enforced before the first intent can be staged rather than arriving with
it.

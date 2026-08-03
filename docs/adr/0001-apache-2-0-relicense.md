# ADR 0001 — Relicense from Elastic-2.0 to Apache-2.0

- Status: accepted
- Date: 2026-07-30
- First ADR in this repository
- Applies to: this repository and the sibling AGENTintel repository

## Context

The project's release goal is distribution as an open-source agent plugin across
Claude Code, Codex, OpenClaw, and generic MCP hosts. The Elastic License 2.0 is
source-available but not approved by the Open Source Initiative. That blocked
three things concretely:

1. plugin marketplaces and package ecosystems that require an OSI-approved
   license for listing;
2. adoption inside organizations whose policy gates on OSI approval;
3. accurate public description — the repository could not truthfully be called
   open source, and both the README and NOTICE said so.

ELv2's protection was against a third party offering the product as a competing
hosted service. That protection is real, but it applies to a hosted-service
threat that a local-first, single-user, BYOK product does not primarily face,
and the commercial edition's value is managed infrastructure and collaboration
rather than the local analysis engine.

## Decision

Relicense the entire repository to the Apache License 2.0.

Apache-2.0 rather than MIT because it carries an explicit patent grant, a
trademark reservation compatible with `TRADEMARKS.md`, and a NOTICE mechanism
for attribution — all of which matter for a product with a commercial sibling
service and a distinct brand.

No split license. An earlier proposal kept the engine under ELv2 and released
only the plugin surface as Apache-2.0. Rejected: a split license makes the
project's open-source status conditional and hard to describe, complicates every
package manifest and SBOM, and reintroduces the marketplace problem for anyone
depending transitively on the engine.

## Consequences

Enabling:

- the project is open source by the standard definition, and can say so;
- marketplace listing and package publication are unblocked;
- the patent grant gives downstream users something ELv2 did not.

Costs and risks accepted:

- **The hosted-service restriction is gone.** Anyone may offer this as a
  competing service. Commercial differentiation now rests entirely on execution,
  managed infrastructure, and brand — not on license terms.
- **Trademark becomes the primary brand defense.** `TRADEMARKS.md` and the NOTICE
  trademark reservation carry weight they did not previously carry alone.
- **Third-party dependency hygiene matters more.** Apache-2.0 is one-way
  incompatible with GPLv2, so no GPLv2-licensed dependency may enter this tree.
  `scripts/validate-licenses.mjs` already enforces a permissive allowlist across
  all installed package/version pairs; that gate is now load-bearing for the
  project's own license validity, not only for redistribution comfort.

## Compliance actions taken with this ADR

- `LICENSE` at the repository root and in every publishable package replaced
  with the canonical Apache-2.0 text, verified byte-identical to the upstream
  text apart from the copyright line.
- `NOTICE` rewritten for Apache-2.0 attribution, retaining the trademark
  reservation.
- Every `license` field — `package.json`, `Cargo.toml`, `pyproject.toml`,
  `tauri.conf.json`, plugin manifests, OpenAPI `info.license` — set to
  `Apache-2.0`.
- Automated license assertions updated so the gates fail on drift rather than
  silently accepting either value.

## Follow-up required before 1.0.0

- Confirm `validate:licenses` rejects GPL-family licenses explicitly rather than
  by allowlist omission alone.
- Contributor sign-off on the relicense from every author with commits in this
  repository. Cheap now, with two authors; expensive after outside contributions
  arrive.
- Qualified legal review of the final license, `TRADEMARKS.md`, and `CLA.md`.

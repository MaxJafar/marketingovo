# Stable release acceptance

A stable tag (`MAJOR.MINOR.PATCH`, no prerelease suffix) fails closed until
`release/acceptance/<version>.json` records both passing machine evidence and
two human attestations. Prerelease tags do not claim this acceptance.

The rule lives in `scripts/public-release-policy.mjs` and is checked with:

```bash
node scripts/validate-public-release-approval.mjs --tag v<version>
```

## Why two of these are human

Everything else in the release gate is a command. Commands prove the software
works; they cannot prove that a person decided to publish it, or that anyone
read the licence file. Those two judgements are the attestations below.

An agent must never fill them in. A record asserting a review nobody performed
is worse than an absent gate, because it reads as assurance. See
[ADR 0002](../../docs/adr/0002-stable-release-acceptance.md), which retired the
previous ELv2/trademark/CLA legal review and the three design-partner case
studies for exactly that reason — their subjects no longer exist, so approving
them would have meant nothing.

## What the record must contain

**`releaseOwner`** — the named person accountable for publishing this version.
There is nothing to verify; it is a signature.

- `status`: `"approved"`
- `name`: a real name, at least 2 characters. `tbd`, `todo`, `unknown`,
  `anonymous`, `n/a` and `none` are rejected.
- `approvedAt`: an ISO-8601 timestamp no more than five minutes in the future.

**`licenceCompliance`** — the named person confirming the licensing story is
accurate. The reviewable work is reading [`NOTICE`](../../NOTICE) and deciding
it is true.

- `status`: `"approved"`
- `spdxIdentifier`: `"Apache-2.0"`
- `noticeReviewed`: `true` — set this only after actually reading NOTICE
- `dependencyPolicy`: `"passing"` — from `pnpm validate:licenses`
- `reviewer`: a real name, same rules as above
- `reviewedAt`: an ISO-8601 timestamp, same rules as above

**`evidence`** — each gate below recorded as `"passed"`, naming the exact
command that produced it and when it was observed:

| Key                      | Command                   |
| ------------------------ | ------------------------- |
| `workspaceGate`          | `pnpm check`              |
| `correctnessCorpus`      | `pnpm benchmark`          |
| `dependencyAdvisories`   | `pnpm audit:dependencies` |
| `licencePolicy`          | `pnpm validate:licenses`  |
| `agentSurfaces`          | `pnpm validate:plugins`   |
| `instructionGuardrails`  | `pnpm validate:skills`    |
| `packagedBrowserJourney` | `pnpm test:e2e`           |

Re-observe these against the tree being tagged. Carrying a timestamp forward
from an older tree records a gate that never ran on the released code.

**`deferredChannels`** — an array naming every distribution channel that did
_not_ ship, each with a reason. Silence is not allowed; use an explicit empty
array when everything shipped. A record that says nothing about signed
installers reads as though they exist.

## Shape

```json
{
  "schemaVersion": 2,
  "version": "1.1.0",
  "releaseOwner": {
    "status": "approved",
    "name": "Full name",
    "approvedAt": "2026-01-01T00:00:00.000Z"
  },
  "licenceCompliance": {
    "status": "approved",
    "spdxIdentifier": "Apache-2.0",
    "noticeReviewed": true,
    "dependencyPolicy": "passing",
    "reviewer": "Full name",
    "reviewedAt": "2026-01-01T00:00:00.000Z"
  },
  "evidence": {
    "workspaceGate": {
      "command": "pnpm check",
      "result": "passed",
      "observedAt": "2026-01-01T00:00:00.000Z",
      "environment": "macOS arm64, Node 24.18.1, pnpm 10.34.5"
    }
  },
  "deferredChannels": [
    { "channel": "signed-desktop-installers", "reason": "No signing identity." }
  ]
}
```

The committed record is not a replacement for protected-environment approval.
The `public-release` GitHub environment must also require a human reviewer.

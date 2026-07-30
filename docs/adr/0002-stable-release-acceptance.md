# ADR 0002 — Stable release acceptance for an unaffiliated project

Status: accepted, 2026-07-30
Supersedes the acceptance shape assumed by `docs/release-status.md` before 1.0.0.

## Context

The stable-release acceptance policy in `scripts/public-release-policy.mjs` was
written when this was a commercial product: a Community edition alongside a paid
hosted tier, governed by the Elastic License, protected by a trademark policy,
and contributed to under a CLA. Its 1.0 gate required, in addition to the
technical gates:

1. a qualified legal review approving the Elastic License 2.0, the trademarks
   and the CLA; and
2. three unique design partners who each completed a real weekly workflow, showed
   a verified improvement, and permitted an attributable case study.

Since then the project relicensed to Apache-2.0 ([ADR 0001](0001-apache-2-0-relicense.md))
and removed its corporate affiliation entirely. `COMMERCIAL.md`, `docs/editions.md`,
`TRADEMARKS.md`, `CLA.md` and `GOVERNANCE.md` were deleted. There is one edition,
no paid tier, no trademark regime and no contributor agreement.

The policy had already drifted into incoherence as a result: it required
`legalReview.elasticLicense2 === "approved"` under an error message that read
"requires legal approval of Apache-2.0, trademarks and CLA", because the
relicense rewrote the message string and not the field name.

## Decision

Retire the two requirements whose subjects no longer exist, and replace them with
requirements that are checkable against this project as it actually is.

**Retired — legal review of ELv2, trademarks and CLA.** None of the three is part
of the project. A record asserting that counsel approved them would be
meaningless, and worse than an absent gate because it reads as assurance.

**Retired — three attributable design-partner case studies.** This is enterprise
marketing evidence for a product being sold. It says nothing about whether the
software is correct, and it cannot gate a tag on an unaffiliated open-source
project maintained by one person. Wanting reference customers is legitimate;
making them a precondition for publishing source is not.

**Added — a named licence-compliance attestation.** Apache-2.0 declared
consistently, `NOTICE` reviewed, and the automated dependency licence policy
passing. Each maps to something a reader can rerun.

**Added — recorded quality evidence.** The record must name every required gate
together with the exact command that produced it and when it was observed. A
stable tag now enumerates what it ran instead of asserting a posture.

**Added — declared deferred channels.** A release must state, explicitly, which
distribution channels it did not ship. Silence is rejected; shipping everything
must be expressed as an empty array.

**Unchanged — release-owner approval.** A human still decides to publish.

**Unchanged — every technical gate.** Tests, corpus recall and false-positive
thresholds, security corpora, benchmark regression, SBOM, dependency advisories,
and the native installer lifecycle are untouched. In particular a stable _native_
release still requires a verified upgrade from an older signed installer; that
requirement gained its first test coverage in this change, having previously been
exercised only through prerelease fixtures.

## Consequence

1.0.0 covers the source, CLI, MCP plugin and npm-packable surfaces. It does not
claim any signed native artifact, and the acceptance record says so under
`deferredChannels` rather than leaving it to be inferred.

This is deliberately an asymmetric change: it removes two people-shaped gates and
adds three evidence-shaped ones. The intent is that a stable tag becomes harder
to assert casually and easier to audit, not easier to reach.

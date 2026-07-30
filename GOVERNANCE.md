# Governance

AGENTseo uses a product-owner model while the maintainer group is small.
GolemWorkers is the steward of product direction, releases, trademarks, and the
Community/Full boundary. Technical decisions remain visible and challengeable
through Issues, Discussions, and RFCs.

## Contribution ladder

```text
User → Contributor → Trusted contributor → Reviewer → Maintainer
```

Progression is based on sustained quality, respectful collaboration, knowledge
of an area, participation in review or triage, and security awareness. It is
not based on employer or volume alone.

## Decision process

- Focused fixes and documentation: pull request.
- New rule, module, or connector: proposal template and maintainer owner.
- Storage schema, public contract, security model, or breaking API: RFC.
- Breaking changes require a deprecation and migration plan.
- Credentials, egress, authorization, releases, and supply chain require two
  approving maintainers.

The product owner may make a final decision after summarizing material
trade-offs and objections. Security incidents can be handled privately until a
coordinated disclosure is safe.

## Releases

The project follows SemVer. Security releases are made as needed; stable minor
releases target a monthly cadence. Supported versions and response targets are
defined in [SECURITY.md](SECURITY.md) and [SUPPORT.md](SUPPORT.md).

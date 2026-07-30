# Contributing to AGENTseo

Thank you for helping build a trustworthy SEO operations system. Contributions
must be in English. Contributions are accepted under the Apache License 2.0;
there is no separate contributor agreement.

## Start here

1. Search Issues and Discussions before opening a duplicate.
2. Use an issue form for a bug, connector, SEO rule, or RFC.
3. Keep changes focused and include fixtures or regression tests.
4. Run `corepack enable`, `pnpm install`, and `pnpm check`.
5. Add `I have read and agree to CLA.md` to the pull request.

No test may call a live third-party provider. Use recorded, synthetic fixtures
with secrets removed. Never commit customer URLs, search queries, analytics
data, credentials, tokens, cookies, local databases, or reports.

## Design rules

- Contracts are versioned and validated at runtime.
- Workflows orchestrate leaf modules; workflows cannot enter the leaf registry.
- Missing configuration is `skipped`, not `failed`.
- A zero value, missing data, stale data, and provider failure are distinct.
- Every network hop follows the egress policy, including redirects and browser
  subrequests.
- Secrets are write-only and represented outside the vault only by a
  `secretRef`.
- Do not introduce a container-based install, build, test, or deployment path.
- Do not add proprietary Full Edition implementations to this repository.

Schema/API changes and new modules or connectors require an RFC. Security and
credential changes require maintainer review.

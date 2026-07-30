---
title: Contributing
description: Contribute focused, tested changes to AGENTseo Community Edition and its documentation.
---

# Contributing

Contributions are welcome when they strengthen a trustworthy SEO operations system and respect the open-source product boundary.

All contributions and repository communication must be in English. Contributors must agree to the lightweight CLA.

## Start with the canonical process

1. Search Issues and Discussions before creating a duplicate.
2. Use the appropriate issue form for a bug, connector, SEO rule, or RFC.
3. Keep the change focused.
4. Add synthetic or recorded fixtures and regression tests.
5. Run the full repository check.
6. Add `I have read and agree to CLA.md` to the pull request.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

## Design rules

- Contracts are versioned and validated at runtime.
- Workflows orchestrate leaf modules; workflows cannot enter the leaf registry.
- Missing configuration is `skipped`, not `failed`.
- Zero, missing, stale, unavailable, and provider failure are distinct.
- Every network hop follows the egress policy.
- Secrets are write-only and represented outside the credential store only by a `secretRef`.
- Proprietary GolemWorkers implementations do not belong in this repository.
- Schema, API, workflow, module, and connector changes require the review level defined by governance.

Security and credential changes require two maintainer reviews.

## Fixture and data safety

No test may call a live third-party provider. Use recorded or synthetic fixtures with secrets removed.

Never commit:

- customer URLs, search queries, or analytics data;
- provider keys, OAuth values, cookies, or service tokens;
- local databases, vaults, reports, exports, or backups;
- sensitive crash output or request logs.

## Work on this documentation site

The docs workspace is `apps/docs` and uses VitePress.

```bash
pnpm --filter @agentseoapp/docs dev
pnpm --filter @agentseoapp/docs test
pnpm --filter @agentseoapp/docs typecheck
pnpm --filter @agentseoapp/docs build
```

Documentation changes should:

- link to the canonical repository policy or implementation;
- distinguish current alpha behavior from roadmap intent;
- preserve the Community and GolemWorkers boundary;
- avoid unsupported replacement, performance, or revenue claims;
- explain unavailable data rather than implying a zero;
- update navigation when adding a new guide.

## Governance and conduct

Maintainers decide release readiness, security response, contract acceptance, and product-boundary questions according to the governance policy. All participation is covered by the Code of Conduct.

<p class="source-note">
  Normative sources: <a href="https://github.com/GolemWorkers/agentseo/blob/main/CONTRIBUTING.md">contribution guide</a>,
  <a href="https://github.com/GolemWorkers/agentseo/blob/main/CLA.md">CLA</a>,
  <a href="https://github.com/GolemWorkers/agentseo/blob/main/GOVERNANCE.md">governance</a>, and
  <a href="https://github.com/GolemWorkers/agentseo/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a>.
</p>

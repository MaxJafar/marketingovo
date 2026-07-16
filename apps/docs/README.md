# Golem SEO documentation site

This VitePress workspace publishes the English product documentation for
Community Edition, marketer workflows, product surfaces, trust boundaries, and
the GolemWorkers edition boundary.

```bash
pnpm --filter @golem-seo/docs dev
pnpm --filter @golem-seo/docs test
pnpm --filter @golem-seo/docs typecheck
pnpm --filter @golem-seo/docs build
pnpm --filter @golem-seo/docs preview
```

The production output is `apps/docs/dist`, matching the monorepo build cache.
Narrative pages explain the product but do not replace normative repository
policies. Link policy, security, privacy, release, architecture, and license
claims back to their canonical root documents.

Canonical documentation index:
[repository README](https://github.com/GolemWorkers/golem-seo/blob/main/README.md).

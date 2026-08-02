# Marketingovo documentation site

This VitePress workspace publishes the English product documentation for
Marketingovo: marketer workflows, product surfaces, and trust boundaries.

```bash
pnpm --filter @marketingovo/docs dev
pnpm --filter @marketingovo/docs test
pnpm --filter @marketingovo/docs typecheck
pnpm --filter @marketingovo/docs build
pnpm --filter @marketingovo/docs preview
```

The production output is `apps/docs/dist`, matching the monorepo build cache.
Narrative pages explain the product but do not replace normative repository
policies. Link policy, security, privacy, release, architecture, and license
claims back to their canonical root documents.

Canonical documentation index:
[repository README](https://github.com/MaxJafar/marketingovo/blob/main/README.md).

# Browser quality gate

This suite exercises the packaged product experience instead of mocking API
responses. It starts the built CLI with an isolated temporary data directory,
parses the exact one-time dashboard URL printed by the CLI, and serves the
synthetic SEO corpus on a random loopback port.

The browser verifies the HttpOnly bootstrap session, adds the fixture as a real
site, explicitly approves that exact loopback hostname, starts a production
audit, observes its persisted history, and opens the resulting action queue.
Secrets and bootstrap tokens are held in memory and redacted from startup
errors. Temporary database and vault files are removed during teardown.

Run it after building the workspace:

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

Failure traces, screenshots and video are written only below
`output/playwright/`.

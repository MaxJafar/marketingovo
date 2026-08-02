# X launch thread

Eight-post launch thread. Publish the GitHub link in post 8 so the opening posts remain focused on the problem and product proof.

## 1/8

An SEO audit can find 1,000 issues and still fail to answer one question: what should we fix first?

Today I am open-sourcing Marketingovo `1.1.0` — a local-first SEO operations system built around actions, evidence, priority, and verification. 🧵

## 2/8

The goal is not another flat issue dump.

Each action can carry impact, effort, confidence, affected URLs, evidence, an owner, and a verification state — the context a marketer needs to make a weekly decision.

## 3/8

Priority is inspectable.

`priority-v1` combines severity, organic exposure, conversion exposure, URL reach, confidence, and effort. It is a documented ranking heuristic, not a promised traffic forecast.

## 4/8

Missing data stays missing.

Unavailable, stale, or failed sources are shown explicitly. Marketingovo does not silently turn missing Search Console or analytics exposure into zero and pretend the score is complete.

## 5/8

Marketingovo runs locally, needs no product account, and has telemetry off by default. Credentials are write-only and excluded from project exports.

Apache-2.0. One edition — no paid tier, no hosted service, nothing held back.

## 6/8

Humans and agents use the same contracts: dashboard, CLI, REST, MCP, Codex, and OpenClaw sit on the same runtime boundary.

That makes a run inspectable whether it started from a button, a script, or an agent tool.

## 7/8

Honest status: the REST API, SDK, agent contract registry, CLI and bundle format are stable, and every release gate is recorded with the command that produced it.

No signed installers and no npm package yet — building from source is the only install route today.

## 8/8

Try the local workflow:

```bash
git clone https://github.com/MaxJafar/marketingovo
cd marketingovo
corepack enable && pnpm install && pnpm build
pnpm marketingovo serve
```

Then add one site, run one audit, inspect the Top 5 Actions, fix one item, and re-run to verify it.

Source + docs: https://github.com/MaxJafar/marketingovo

What would make this useful in your weekly SEO workflow?

## Suggested media and alt text

Attach the short demo to post 1 or a four-frame crop of carousel slides 1, 3, 5, and 8.

Alt text: “Marketingovo demo showing a local site audit, explicit data-source states, a transparent priority score, and a Top 5 Actions queue.”

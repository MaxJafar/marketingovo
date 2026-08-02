---
title: Quickstart and onboarding
description: Install Marketingovo, open the local dashboard, and reach the first prioritized action.
---

# Quickstart and onboarding

This path uses Marketingovo. It requires Node.js 24 LTS and Corepack. No account is required.

<div class="status-banner">
  <strong>Before you start</strong>
  <p>Use a non-critical project first, keep backups, and review the current release gates before relying on it for production operations.</p>
</div>

## Install from source

```bash
git clone https://github.com/MaxJafar/marketingovo.git
cd marketingovo
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm marketingovo serve
```

The published-package route described by the project is:

```bash
npx @marketingovo/cli serve
```

The daemon binds to `127.0.0.1:3210`. Keep it on loopback. The daemon prints a one-time dashboard URL; open that exact URL so the fragment token can be exchanged for the HttpOnly local session and removed from the address bar.

One daemon owns each data directory. A second CLI reuses the authenticated
owner instead of starting duplicate workers or schedules, including when it
requested a different port. A crashed owner's transactional lease is recovered
on the next start.

## Decide whether credentials must survive a restart

The credential vault stays locked unless the daemon receives either:

- `--master-password-file /absolute/path/to/password-file`, or
- `MARKETINGOVO_MASTER_PASSWORD` in the daemon environment.

The password must contain at least 12 characters. Protect a password file with owner-only permissions. Without a master password, connections are memory-only for that process and must be entered again after restart.

Do not pass provider secrets on a command line. Add and rotate credentials in the local dashboard, where the API treats them as write-only.

## Complete the guided flow

### 1. Add the site

Use the canonical public URL and a name your team will recognize. A private target requires explicit host or IP allowlisting; local and metadata destinations remain blocked by default.

### 2. Establish Project Context

Open **Project context** and create the first business/SEO profile. Record the
audiences, markets, languages, conversion goals, priority topics, competitors,
and constraints that should change how a marketer interprets evidence. Every
save creates an immutable revision with a change summary.

Use the append-only journal later for observations, decisions, constraints, and
experiments. A human note is context, not proof; link it to an audit when useful
and continue to verify it against source coverage and freshness.

### 3. Connect evidence

Begin with the sources you already trust:

- Google Search Console for queries, clicks, impressions, and landing pages;
- Google Analytics 4 for organic sessions, engagement, and key events;
- PageSpeed Insights or local browser runs for performance context;
- Google Trends, SerpAPI, or DataForSEO for demand and market research.

Provider readiness varies. The Integrations screen is the authority for connection status. A source that is missing or stale remains visibly unavailable.

### 4. Choose the question

Use a focused goal such as technical health, organic quick wins, competitor comparison, keyword research, or content planning. A clear question makes the resulting evidence easier to judge.

### 5. Start and watch the run

Long work returns a run ID. The UI can follow progress; the CLI can inspect the same state:

```bash
pnpm marketingovo run list --project PROJECT_ID
pnpm marketingovo run watch RUN_ID
pnpm marketingovo run replay RUN_ID
```

Wait for `succeeded`, `partial`, `failed`, or `cancelled`. A partial run may still be useful, but its unavailable sources must remain part of the conclusion.

### 6. Review Top 5 Actions

For each action, inspect:

- why it matters now;
- severity, impact, effort, confidence, and priority score;
- affected URL reach;
- supporting evidence and source freshness;
- owner, state, and verification status.

Do not approve work based on rank alone. Expand the score explanation and check whether a missing provider reduced confidence.

Open **Issue Review** when a finding may be intentional or incorrect. Read its
captured evidence first. Ignoring or marking a false positive requires a reason
and explicit confirmation; the decision persists on future audits but can be
reopened without deleting history. For multi-URL Actions, one decision removes
only that URL and recalculates reach; the Action remains until every active
instance is reviewed.

### 7. Verify the change

Resolve or acknowledge the action, make the change in the system that owns the site, then run a follow-up audit. Verification should answer whether the issue fingerprint disappeared, stayed open, or regressed.

### Audit an exact URL cohort

Open **Audits → Expert audit scope** to paste one absolute URL per line. The
dashboard removes fragments and duplicates. The runtime validates the project
origin again and crawls only those URLs as independent seeds.

The Keywords workspace also reports provider usage for the latest research. A
paid request whose per-call cost is unavailable stays explicitly unknown; it is
never displayed as `$0`.

### Capture project-specific page fields

Open **Settings → Custom extraction rules** to capture fields such as price,
author, SKU, publication date, or CMS markers. Choose text, inner HTML, or an
attribute, then preview the draft against one URL on the project's exact
origin. Static preview is fastest; JavaScript preview uses the sandboxed browser
path. Localhost and private sites require the visible exact-host opt-in, while
cloud metadata remains blocked.

For a faster start, review a built-in social, editorial, commerce, or migration
template. The review shows every selector, capture mode, recommended page, and
assumption. **Add fields to draft** creates fresh local rule IDs but does not
save, crawl, or overwrite a conflicting field. Duplicate labels and the
50-rule boundary must be resolved before import.

Preview does not save anything. Add a revision summary and choose **Save
revision** when the draft is correct. Every new audit records the current rule
revision, so a later replay uses the same extraction configuration even after
the project rules change.

Trusted local clients can inspect the same versioned catalog:

```bash
marketingovo extraction templates
```

## Check local health

```bash
pnpm marketingovo doctor
```

Doctor reports the resolved data directory, dashboard assets, local API health, database state, and service-token location. The service-token file is for trusted non-browser clients; never paste it into the dashboard or an agent prompt.

## Back up and restore local history

Stop the local daemon before either operation. Backup creates a consistent
SQLite snapshot, refuses to overwrite an existing file, and prints its SHA-256:

```bash
marketingovo backup /safe/location/marketingovo-backup.db
```

Restore validates integrity, schema compatibility, and the optional expected
checksum before replacing the database. It keeps the previous database as a
dated rollback file and requires explicit confirmation:

```bash
marketingovo restore /safe/location/marketingovo-backup.db \
  --expected-sha256 PRINTED_SHA256 \
  --confirm
```

Backups exclude native-vault secrets but can contain sensitive site and
analytics evidence. Protect them accordingly.

## Export or delete a local project

Use **Settings → Project portability** before cleanup if the evidence may be
needed again. **Settings → Delete local project** requires the exact current
project name, stops active work, and removes runs, evidence, actions, Project
Context, schedules, settings, and report artifacts.

For CLI deletion, create a private text file containing only the exact project
name, then run:

```bash
marketingovo project delete PROJECT_ID --confirm-name-file ./project-name.txt
```

The receipt reports deleted record counts and file cleanup state. Global BYOK
credentials stay available to other projects and must be removed separately
from the local vault in Integrations. Revoke the underlying key or grant at its
provider when required. Agents cannot delete projects.

## Next steps

- [Pick the right marketer workflow](/workflows/marketer-workflows)
- [Understand the dashboard](/product/dashboard-actions)
- [Create durable Project Context](/product/project-context)
- [Set up BYOK integrations](/integrations/byok)

<p class="source-note">
  Canonical operational source: <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/quickstart.md">ten-minute quickstart</a>.
  Confirm current limitations in <a href="https://github.com/MaxJafar/marketingovo/blob/main/docs/release-status.md">release status</a>.
</p>

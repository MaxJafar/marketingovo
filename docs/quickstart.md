# Ten-minute quickstart

This guide uses the Community Edition local service. It requires Node.js 24 LTS
and Corepack; no account is required.

## Install from source

```bash
git clone https://github.com/GolemWorkers/agentseo.git
cd agentseo
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm agentseo serve
```

For a release whose attached npm publication record is verified:

```bash
npx @agentseoapp/cli serve
```

Prerelease source code does not imply that the same version already exists on
npm. Check the GitHub release evidence and npm provenance before using this
route.

The service binds to `127.0.0.1:3210`. Do not expose it through a public proxy.
One daemon owns each data directory. Starting another CLI against the same
directory reuses the authenticated owner, even when a different port was
requested; a crashed owner's transactional lease is recovered on the next
start. This prevents duplicate schedulers and workers from using one database.
Use the exact `Dashboard:` URL printed by the command: its short-lived fragment
token is exchanged once for an HttpOnly local session. A bare localhost URL is
not a valid first-session entry point.

## First workflow

1. Open the printed `Dashboard:` URL.
2. Add the canonical site URL and choose whether private-site access is needed.
3. Open **Project context** and create the first reusable business brief. Add
   audiences, markets, languages, conversion goals, priority topics,
   competitors, and any constraint that should change how evidence is judged.
4. Optionally connect GSC, GA4, PSI, SerpAPI, or DataForSEO. Missing sources are
   shown as unavailable and reduce confidence; they do not create fake zeroes.
5. Choose a goal such as Technical health, Organic quick wins, or Content plan.
6. Start the audit and follow live progress. A long job returns a run ID and can
   be cancelled without losing its event history.
7. Review Top Actions. Expand the priority formula, evidence, affected URLs,
   effort, confidence, and suggested owner.
8. Use Issue Review for intentional behavior or a verified false positive;
   record a reason instead of deleting the finding. Multi-URL Actions narrow
   and re-score per reviewed URL rather than disappearing prematurely.
9. Append a Project Context observation, decision, constraint, or experiment
   when the evidence changes the strategy. Link it to the relevant audit when
   useful; the entry remains human context, not proof of an outcome.
10. Resolve an action and run verification, or create a local schedule that runs
    while the background service is active.

The CLI can inspect the same review queue with `agentseo issue list
PROJECT_ID`. A non-open decision requires `--reason-file`; review text is never
accepted as an inline shell argument.

Project Context also has a file-based CLI boundary:

```bash
agentseo context show PROJECT_ID
agentseo context update PROJECT_ID \
  --profile-file ./project-context.json \
  --change-summary-file ./context-change.txt
agentseo context append PROJECT_ID decision \
  --title-file ./decision-title.txt \
  --detail-file ./decision-detail.txt \
  --source-run RUN_ID
```

Profile and journal text use files so they do not become shell-history values.
The runtime applies the same schema, project-scoping, secret, and local-path
checks as the dashboard.

## Audit an exact URL cohort

Open **Audits → Expert audit scope** to paste one absolute URL per line. This
mode is useful for migration QA, template samples, and verification cohorts.
The dashboard removes fragments and duplicates; the runtime validates the same
project origin again and crawls only those URLs as independent seeds.

Keyword research shows provider usage for the latest result. A DataForSEO task
cost is shown only when the provider reported it. An unreported paid cost stays
unavailable and is never converted to `$0`.

## Connect an agent

The Codex and OpenClaw bundles connect to the same local API. They expose six
workflow-level tools and read-only project/run/report resources. Agents read
the versioned Project Context before interpreting issues, but cannot rewrite it
through a default workflow tool. Authentication, credential deletion, and
commercial billing remain deliberate UI/CLI actions.

## Local data

The app data directory is user-only. SQLite and vault material use restrictive
file permissions. `.agentseo` exports include context revisions and journal
history but never include secrets. Use `agentseo doctor` to see the resolved
data directory, database state, browser isolation, and integration health.

Create a consistent local database snapshot only after stopping the daemon:

```bash
agentseo backup /safe/location/agentseo-backup.db
```

The command refuses to overwrite an existing backup and prints its SHA-256.
Restore is also offline, requires explicit confirmation, verifies the optional
expected checksum, and preserves the previous database as a rollback file:

```bash
agentseo restore /safe/location/agentseo-backup.db \
  --expected-sha256 PRINTED_SHA256 \
  --confirm
```

Database backups contain site and analytics evidence. They do not contain
native-vault secrets, but they are still confidential data.

## Export or delete a local project

Use **Settings → Project portability** before destructive cleanup when you may
need the evidence again. **Settings → Delete local project** requires the exact
current project name and states which data and credentials are affected.

The CLI keeps the confirmation out of a shell-history argument:

```bash
# Create ./project-name.txt in your editor with only the exact project name.
agentseo project delete PROJECT_ID --confirm-name-file ./project-name.txt
```

Deletion stops active work, removes runs, raw evidence, actions, Project
Context, schedules, settings, and report artifacts, and returns record counts.
Global provider credentials are retained because another project may use them;
remove those separately from the local vault in Integrations, and revoke the
underlying key or grant at its provider when required. The local deletion
endpoint is not exposed as an agent tool.

# Project Context

Project Context is the reusable business and SEO memory attached to one local
project. It prevents every marketer, audit, and agent session from rebuilding
the brief from scattered prompts while keeping human intent separate from
measured crawl and provider evidence.

## Versioned profile

The current profile records:

- a concise business and search summary;
- priority audiences and markets;
- languages and locales;
- conversion goals;
- priority topics;
- known competitors; and
- constraints and guardrails.

Saving never edits a prior row. It creates the next project-scoped revision
with a bounded change summary, local actor, and timestamp. The UI shows the
current revision and immutable history. Duplicate list values are removed
case-insensitively after whitespace normalization.

## Append-only marketer journal

Journal entries are ordered by a stable sequence and have one of four kinds:

| Kind          | Meaning                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `observation` | A human interpretation that should be challenged against current evidence |
| `decision`    | A chosen strategy or operating rule                                       |
| `constraint`  | A legal, brand, platform, or resourcing boundary                          |
| `experiment`  | A hypothesis with an intended measurement or failure condition            |

An entry can cite a run from the same project. Cross-project run references are
rejected. Entries are not edited in place; when evidence changes, append a new
decision or observation that makes the change explicit.

The journal is not an analytics source. A recorded observation or decision does
not prove an outcome. Marketers and agents must still read run coverage,
freshness, issue evidence, and provider state, and should name contradictions
between the journal and current measurements.

## Product surfaces

- Dashboard: open **Project context** for the profile, journal, and revision
  history.
- REST: `GET` and `PUT /api/v1/projects/:id/context`, then
  `POST /api/v1/projects/:id/context/journal`.
- SDK: `client.context.get`, `client.context.update`, and
  `client.context.append`.
- CLI: `agentseo context show|update|append`; mutation text is read from
  bounded local files instead of command-line arguments.
- MCP: `agentseo://projects/{id}/context` is read-only. It does not add a
  seventh public agent tool.

The Codex marketer workflow reads Project Context before overview and issue
resources. Writes remain deliberate dashboard or local API operations.

## Security and portability

Profile, change-summary, title, and detail fields are bounded and validated at
runtime. Secret-like values and local filesystem paths are rejected before a
write. Audit events record revision, sequence, kind, and presence metadata, not
the profile or journal text.

All revisions and entries are included in a `.agentseo` transfer bundle.
Project identifiers, entry identifiers, and linked run identifiers are remapped
on import. Secrets are never included, imported schedules remain disabled, and
integrations must be reconnected.

SQLite preserves the complete local history. The interactive workspace returns
a bounded newest-first view so one request cannot grow without limit; the
portable bundle retains every stored revision and entry up to the documented
bundle limits.

See [Architecture](architecture.md), [Quickstart](quickstart.md), and the
[reference-tool reverse-engineering record](reference-tool-reverse-engineering.md).

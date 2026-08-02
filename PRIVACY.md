# Privacy

Marketingovo is local-first. Product telemetry is disabled by
default and requires explicit opt-in. Ordinary provider calls made to perform a
requested audit are product functionality, not telemetry.

The first signed desktop process makes one HTTPS release check before starting
the local service, whether it was opened by the user or by login startup. The
request uses the fixed `latest.json` asset on the canonical Marketingovo GitHub
release. It does not put a project URL, account, credential, usage event, or
Marketingovo device identifier in the URL. As with any HTTPS request, GitHub can
receive ordinary transport metadata such as the source IP address and request
headers. Marketingovo does not attach a product telemetry identifier. When a newer
release is available, the desktop launcher downloads it and installs it only
after the embedded updater key verifies its detached signature. Secondary
desktop activations reuse the existing launcher and npm CLI services never make
this check. A desktop user can disable it with `--no-update` or
`MARKETINGOVO_AUTO_UPDATE=off`.

Projects may contain confidential marketing data: search queries, landing-page
metrics, conversion metrics, crawl snapshots, competitor inputs, and custom
rules. Versioned Project Context can also contain audiences, markets,
conversion goals, constraints, and a human decision journal. The local daemon
owns that data and binds to loopback only.

The agent terminal on the dashboard is a pipe, not a model. Marketingovo runs no
inference and holds no model credential for it: what you type is delivered to an
agent harness you started and authorized yourself, and that harness — not
Marketingovo — decides whether anything reaches a model provider and which one.
Read its privacy terms for that leg. On the Marketingovo side a transcript lives
only in the daemon's memory for the life of the process. It is bounded, never
written to SQLite, and never appears in project exports, backups, reports, or
crash output. Closing the daemon discards it.

Secrets are never included in API responses after write, reports, logs, exports,
backups by default, crash output, or telemetry. Project exports contain data,
context, and history but no credentials. Project Context writes reject
secret-like text and local filesystem paths. Before an outbound integration is
enabled, the UI must identify the provider, scopes, and categories of data sent.

The user controls project deletion, artifact retention, provider connections,
and optional anonymous telemetry. Deleting a local project requires its exact
name, stops active work, removes the complete project graph from SQLite, and
cleans its deterministic artifact and custom-rule directories. A structural
deletion event retains only the opaque project identifier and record counts,
not the project name, URL, evidence, or context. Global BYOK credentials are
not project data and are retained because another local project may use them;
they can be removed from the local vault through Integrations or the CLI. Revoke
the underlying key or grant separately at the provider when required. If the operating
system temporarily prevents final file removal, the isolated deletion staging
directory is retried at the next service start. If the process stopped before
the database commit, the manifest causes those files to be restored because
the project still exists. Unrecognized or conflicting staging is preserved and
system health is degraded instead of deleting unknown data. Marketingovo on Golem
Workers has a separate privacy policy appropriate to its hosted service.

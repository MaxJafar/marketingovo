# Legacy v0 migration

The pre-monorepo crawler is preserved as the implementation base of
`@agentseoapp/core`; its old internal sprint notes and private operating logs are
not part of AGENTseo documentation.

The 0.11 migration path is non-destructive. The importer detects legacy
`audits.json`, `crawls.db`, `schedule.json`, custom rule files, supported
environment configuration, and Google token files. It copies normalized data
into the local application directory and writes an import receipt. Original
files are never changed or removed.

The supported public history starts at `legacy-v0.10`. Release maintainers
create that tag before publishing the reorganized Community repository.

`plugin.json` is a synthetic, secret-free Apache-2.0 fixture that preserves only the
shape needed to prove legacy manifests remain quarantined. The original private
manifest, internal paths, provider configuration, and marketing copy are not
part of the public repository. The fixture is not exported,
packaged, or supported as an agent surface. Community exposes exactly six
workflows through MCP, Codex, and OpenClaw.

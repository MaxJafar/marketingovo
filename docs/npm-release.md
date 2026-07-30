# npm release and provenance

The npm route is a verified release surface, not a best-effort workspace
publish. The canonical tag workflow publishes 13 Community packages because
the CLI depends on the same public contracts, engine, runtime, storage,
integrations, server, SDK, MCP, and adapter packages used by the other product
surfaces.

## Release invariants

Before publication, the release tooling:

- requires the git tag to equal `v` plus the version shared by the root,
  publishable packages, private apps, Tauri configuration, desktop crate, and
  native credential-broker crate;
- validates ELv2, canonical repository metadata, public access, notices, and
  provenance configuration for every publishable package;
- orders packages topologically so dependencies are published first;
- creates tarballs with `pnpm pack`, rejects remaining `workspace:` protocols,
  and requires local dependencies to resolve to the exact release version;
- hashes every tarball with SHA-256 and npm-compatible SHA-512 integrity;
- installs all tarballs into a clean temporary consumer in CI and executes the
  installed CLI;
- waits for the complete signed native matrix before making an npm write.

Stable versions use the `latest` distribution tag. Prereleases use `next`, so a
release candidate cannot replace the default stable install.

## Trusted publication

The `npm-production` GitHub environment must be protected. Each public package
must configure npm trusted publishing for:

```text
Repository: GolemWorkers/agentseo
Workflow: release.yml
Environment: npm-production
Allowed action: npm publish
```

The workflow uses a GitHub-hosted Linux runner with `id-token: write` and npm
11.18.0. The publisher refuses to run outside the canonical tag workflow or
without GitHub's OIDC request context. After every publish, it reads the
registry integrity and provenance attestation back from npm. Missing
attestation, different bytes, or a partially published version fails the
release and leaves the GitHub release as a draft.

For the first publication, npm requires the scope and packages to exist before
trusted publishers can be attached. Bootstrap them once with a short-lived,
least-privilege `NPM_TOKEN` stored only in the protected `npm-production`
environment. Then configure trusted publishing for all packages, remove the
automation token, and set package publishing access to require 2FA while
disallowing traditional tokens. Later releases use OIDC only.

## Public-release approval

The `public-release` GitHub environment must require a human reviewer. A stable
tag also fails unless `release/acceptance/VERSION.json` records release-owner
approval, completed legal review, and at least three unique design partners
that produced a weekly verified improvement and approved an attributable case
study. Prereleases do not claim those stable-release approvals.

After native and npm verification succeeds, the draft GitHub release contains:

- platform installers and updater payloads;
- native signature and installer-lifecycle records;
- npm tarballs, their preparation manifest, and registry publication record;
- checksums, SBOM, license notices, and GitHub provenance attestations.

Only then does the workflow publish the draft. Until an attached publication
record exists, documentation must not imply that a source version is available
from npm.

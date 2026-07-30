# Desktop runtime and release configuration

AGENTseo native installers are assembled on the same operating system and
architecture they target. Each installer contains four versioned runtime
parts:

- the Tauri desktop launcher;
- the official Node 24 sidecar and production Community runtime;
- the native operating-system credential broker;
- the Chromium build matched to the lockfile's Playwright version.

JavaScript crawling and Lighthouse receive the same packaged Chromium
executable. The launcher also sets Playwright's browser directory explicitly,
so neither workflow depends on a system Chrome installation or a per-user
browser cache. The browser smoke test launches that exact executable with the
Chromium sandbox enabled before an installer is built.

Every native bundle also carries the Apache License 2.0 plus the project
NOTICE, privacy policy, and trademark policy under its packaged legal
resources. Platform signing and notarization attest the executable; they do not
replace these license notices.

## Public Google OAuth configuration

Google Desktop OAuth client IDs are public identifiers. They are safe to embed
in a native application and are used with PKCE, `state`, a one-time loopback
callback, and an absolute token expiry. A native application must never embed a
Google OAuth client secret.

Configure the public client ID at build time:

```bash
export AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID=YOUR_PUBLIC_ID.apps.googleusercontent.com
node scripts/prepare-desktop-runtime.mjs \
  --target TARGET_TRIPLE \
  --require-google-client-id
```

The signed release workflow reads `AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID` from a
GitHub Actions repository variable. Runtime assembly rejects malformed IDs,
fails when the required value is absent, and rejects client-secret environment
variables. Only the validated public ID is written to
`runtime/config/public-runtime.json`.

The release job fails before dependency installation when any required signing
input is absent. macOS requires the Developer ID certificate and identity plus
Apple notarization credentials. Windows requires `WINDOWS_CERTIFICATE` (a
base64-encoded PFX) and `WINDOWS_CERTIFICATE_PASSWORD`. The workflow imports the
Windows certificate into the ephemeral runner store, derives its thumbprint
without printing private material, and configures SHA-256 Authenticode signing
with a trusted timestamp.

## Credential broker

Build and copy the native broker after runtime preparation:

```bash
cargo build --locked --release \
  --manifest-path packages/credential-broker-native/Cargo.toml
node scripts/copy-native-broker.mjs
```

The installed desktop launcher passes the broker path automatically. The Node
client preserves only the small operating-system session environment required
to reach Keychain, Credential Manager, or Secret Service. The launcher fails
closed if the broker is missing. Headless npm installations can use the
Argon2id and AES-256-GCM vault with a user-provided master password instead.

## Release gate

After assembling Node, Chromium, and the broker, verify all native inputs:

```bash
node scripts/verify-desktop-runtime.mjs \
  --target TARGET_TRIPLE \
  --require-broker \
  --require-google-client-id \
  --launch-browser
```

The check proves target and Node-version consistency, validates the public
configuration, finds the deployed Playwright package, launches packaged
Chromium, and exercises a smoke page without disabling the sandbox.
The Node sidecar is installed as `agentseo-node`, never the generic `node`
name, so a Linux package cannot collide with or replace the operating system's
Node executable.

Release bundles enable Tauri v2 updater artifacts. The release signing key
therefore produces a detached `.sig` beside the supported updater payloads;
the desktop updater reads metadata only over HTTPS and validates the selected
payload with the embedded public key. The installed application reads a static
`https://github.com/GolemWorkers/agentseo/releases/latest/download/latest.json`
channel. GitHub's `latest` release resolves only the stable channel: alpha and
release-candidate builds remain manual design-partner upgrades until a stable
release exists, while an installed prerelease can move to that verified stable
release when it is published. Registering the updater plugin is not treated as a working update
experience: the first release process invokes the Rust updater API before
starting the daemon, uses a bounded eight-second check, verifies the selected
payload, installs it, and restarts. Failure falls back to the already installed
version. Login startup follows the same pre-daemon path, while Tauri's
[single-instance boundary](https://v2.tauri.app/plugin/single-instance/) turns later desktop launches into dashboard
activations instead of concurrent update/runtime owners. Debug builds do not
make update requests; `--no-update` and `AGENTSEO_AUTO_UPDATE=off` provide an
explicit opt-out. Before any bundle is uploaded, the release gate follows the
[Tauri updater lifecycle](https://v2.tauri.app/plugin/updater/) and:

- cryptographically verifies every updater signature against that public key;
- verifies macOS code signatures, the expected Developer ID team, Gatekeeper
  acceptance, notarization tickets, and stapling on both the application and
  DMG;
- verifies Windows MSI Authenticode, the exact imported certificate
  thumbprint, and a trusted timestamp;
- records Linux distribution-native package signing as not applicable instead
  of claiming repository-level apt signing; the workflow separately creates
  and verifies a release-key detached signature for the `.deb`, while the
  AppImage carries the Tauri updater signature;
- installs the DMG, MSI, or deb on its matching ephemeral runner, starts the
  packaged background service, creates a real project canary, stops it, and
  proves that package and service cleanup are complete;
- launches the packaged AppImage under an isolated home directory, requires a
  healthy daemon at the exact release version, and proves shutdown;
- hashes the verified artifacts into a target-specific evidence record.

`create-release-manifest.mjs` accepts only artifacts whose bytes still match
that evidence record and gives every uploaded native artifact a deterministic
target prefix, so two architectures cannot overwrite the same Tauri filename.
Each native runner also retains only its verified updater payload, signature,
and verification record for the final channel job. That job rejects missing
targets, mixed versions, mixed public keys, changed bytes, malformed signatures,
the wrong repository, or a tag mismatch before it creates `latest.json`.
The metadata is attached while the GitHub release is still a draft and the
release is published only after this job and npm publication succeed. The draft
release also receives the copied verified payload, evidence, checksums, SBOM,
notices, and provenance.

## Background service installation

The CLI installs a launchd agent on macOS, a systemd user unit on Linux, or a
least-privilege per-user Task Scheduler login task on Windows:

```bash
agentseo service install \
  --credential-broker /absolute/path/to/agentseo-credential-broker
```

The broker must resolve to an executable regular file. Its validated canonical
path is stored as a distinct service argument; paths are XML-escaped for
launchd, argv-quoted for systemd, and encoded into a Task Scheduler Exec action
without a command interpreter on Windows. Master passwords and
master-password-file configuration are never written to a service definition.

The signed Windows MSI uses a WiX fragment to create an HKCU login-start value
for the installed desktop executable. The only persisted argument is
`--background`. The launcher then resolves Node, Chromium, OAuth public
configuration, and the native broker from its signed installation resources at
runtime. WiX owns the registry component and removes it on uninstall. The
background process suppresses its webview while retaining ownership of the
daemon; a normal launch reuses the daemon and opens the authenticated dashboard.

The release workflow performs destructive lifecycle checks only on matching
ephemeral runners. Windows validates MSI and executable Authenticode, the exact
quoted login command, and launcher-owned processes. macOS mounts the DMG,
verifies the installed app's team, notarization ticket and Gatekeeper result,
then exercises the packaged launchd definition. Linux installs the deb,
exercises the systemd user unit, purges the package, and separately runs the
AppImage. Every platform creates a real local project before an upgrade and
requires the same project ID afterward. User data must survive uninstall while
the service definition, package, executable and owned processes must not.

Set the repository variable `AGENTSEO_UPGRADE_BASELINE_TAG` to an older,
published AGENTseo tag such as `v1.0.0-rc.1`. The workflow downloads that
release's target verification record and target-prefixed installer, checks its
recorded hash, and cryptographically verifies the detached release-key signature
on Windows and Linux. macOS validates the older installed app against the same
Developer ID team. Prereleases may explicitly record that no baseline was configured;
stable versions fail closed without a verified older installer, preserved
project data, and healthy post-upgrade version evidence.

The npm CLI remains a separate explicit service-management route. Its Windows
definition uses an `InteractiveToken` principal, `LeastPrivilege`,
single-instance execution, restart-on-failure, and an Exec action without a
command interpreter. It follows Microsoft's documented
[Task Scheduler XML logon-trigger model](https://learn.microsoft.com/en-us/windows/win32/taskschd/logon-trigger-example--xml-).

Use `agentseo service status` to inspect the CLI-managed platform service and
`agentseo service uninstall` to stop and remove it. Signed lifecycle evidence
from every canonical target remains mandatory for 1.0 even though its
fail-closed source policy and local contract tests pass.

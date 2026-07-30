# AGENTseo desktop shell

This Tauri 2 shell starts the bundled Node 24 runtime sidecar, waits for the
authenticated localhost dashboard URL, and opens it in a native webview. It
does not contain a second application runtime: desktop, CLI, MCP and the browser
dashboard all use the same local daemon and SQLite database.

Before the first signed desktop process starts the daemon, the Rust launcher
checks the configured HTTPS release endpoint with an eight-second timeout. This
also applies to the login-start process, so an update never races a daemon
already owned by the same launcher. A
newer payload is downloaded, verified by the embedded Tauri updater public key,
installed, and followed by a restart. A failed or unavailable check never
blocks the installed version. An official single-instance boundary routes later
user launches to that process instead of creating another updater/runtime
owner. Debug builds skip the network check; users can also pass `--no-update`
or set `AGENTSEO_AUTO_UPDATE=off`. The request contains only target,
architecture, and current version—never project or credential data. The npm CLI
does not self-update.

Release jobs must place an official target-specific Node 24 executable at
`src-tauri/binaries/agentseo-node-<target-triple>` and the bundled runtime tree under
`src-tauri/runtime/` before running `pnpm native:build`. Signing identities and
the updater public key are injected only by the release environment.

`scripts/prepare-desktop-runtime.mjs` performs the complete target-native
assembly. It deploys the production CLI graph, downloads the Chromium revision
matched to the lockfile's Playwright version, records the exact executable in a
public runtime manifest, and copies the current official Node 24 executable as
the product-scoped `agentseo-node` Tauri sidecar. The unique name prevents a
Linux installer from colliding with a system Node executable. The matching
Chromium build is used for both JavaScript
crawling and Lighthouse; the application does not depend on a browser already
installed on the machine. Chromium's sandbox remains enabled.

The native credential broker must be built and copied after runtime assembly.
The desktop launcher refuses to start when the broker or browser is absent, so
a release cannot silently fall back to a plaintext or locked credential path.
macOS Keychain, Windows Credential Manager, and Linux Secret Service are used
automatically by the installed application.

Google's Desktop OAuth client ID is public configuration, not a client secret.
Set `AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID` while assembling the runtime and use
`--require-google-client-id` for release builds. The release workflow reads it
from the repository variable with the same name. Never configure or package a
Google OAuth client secret: native authorization uses PKCE and a loopback
callback.

```bash
AGENTSEO_GOOGLE_DESKTOP_CLIENT_ID=YOUR_PUBLIC_ID.apps.googleusercontent.com \
  node scripts/prepare-desktop-runtime.mjs \
  --target aarch64-apple-darwin \
  --require-google-client-id
cargo build --locked --release \
  --manifest-path packages/credential-broker-native/Cargo.toml
node scripts/copy-native-broker.mjs
node scripts/verify-desktop-runtime.mjs \
  --target aarch64-apple-darwin \
  --require-broker \
  --require-google-client-id \
  --launch-browser
```

Supported release targets are macOS 13+ arm64/x64, Windows 10/11 x64, and
Ubuntu 22.04/24.04 x64. The normal workspace build validates this source even
when the Rust toolchain and release sidecars are not installed.

The Windows MSI installs an HKCU login-start registry component that invokes
the signed desktop executable with `--background`. In background mode the
launcher owns the daemon without opening a webview; a normal application launch
opens the authenticated dashboard and reuses that daemon. WiX removes the
startup component during uninstall. The registry contains no packaged runtime
paths, account password, credential reference, or master-password
configuration.

Every release runner must install its real package, start the packaged
background service, create a project canary, stop it, and prove clean package
and service removal. When `AGENTSEO_UPGRADE_BASELINE_TAG` points to an older
published release, the runner installs that cryptographically verified
baseline first and requires the canary to survive the upgrade. Stable releases
fail closed without this baseline. Linux also executes the AppImage in an
isolated home; Windows additionally verifies MSI and executable Authenticode
plus the login command; macOS verifies the installed app's Developer ID,
stapling, and Gatekeeper acceptance. Source contracts alone do not close the
1.0 operating-system gate—the canonical runners must produce the evidence.

The separate npm CLI can install a launchd agent, systemd user unit, or a
least-privilege Windows per-user Task Scheduler login task with
`agentseo service install --credential-broker /absolute/path/to/broker`. The
validated broker path is persisted as an argv element, while master passwords
are never serialized into service definitions. Use `agentseo service status`
or `agentseo service uninstall` for lifecycle control.

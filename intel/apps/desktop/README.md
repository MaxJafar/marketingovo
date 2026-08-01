# AGENTintel desktop boundary

This directory is the deliberately narrow Tauri 2 boundary around the local
AGENTintel runtime. It is a launcher, verifier, updater and native credential
boundary—not a second application runtime.

The launcher performs the following sequence:

1. Tauri checks the HTTPS release channel and accepts updater payloads only
   when the configured release signature verifies.
2. Rust reads `runtime/sidecars.manifest.json`, verifies its detached Minisign
   signature with the public key compiled into the launcher, checks the exact
   target triple, and validates the path, type, size, SHA-256 and Unix mode of
   every declared file.
3. Every regular file below the pinned Python environment, worker, generated
   contracts and dashboard roots must be in that signed manifest. The exact
   interpreter must be an executable inside that environment; `pyvenv.cfg`,
   `pyproject.toml`, `uv.lock`, worker source and generated bindings are required.
   Symlinks, special files, unlisted code, group/world-writable files and set-id
   executables are rejected.
4. Rust copies only those verified bytes into a fresh private runtime snapshot,
   re-hashes every destination, removes write permissions, and revalidates the
   sealed files immediately before launch. The packaged resource tree is never
   executed directly, closing the verification-to-execution mutation window.
5. Rust launches the sealed Go daemon in its own process group and passes the
   sealed interpreter through `--python-command`. Go executes that absolute
   interpreter directly; no `uv`, PATH lookup, system Python or user cache is in
   the packaged runtime path.
6. The one-time ticket never appears in argv or the environment. Rust writes
   exactly 43 base64url bytes plus LF to the daemon's bounded stdin pipe,
   zeroizes its write buffer and closes the pipe. The daemon emits one exact
   `Dashboard: http://127.0.0.1:<port>/#token=<43-char-base64url>` line. Rust
   accepts only the generated token on exact IPv4 loopback and navigates the
   existing webview once. The fragment is never sent in HTTP, logged by Rust or
   persisted in web storage. The dashboard consumes and removes it
   synchronously, exchanges it once, and thereafter uses its HttpOnly session
   cookie and in-memory CSRF token.
7. Closing the application terminates the owned Go process group, including
   the Python worker supervised by Go.

There is no `invoke_handler`, shell plugin or filesystem plugin. The single
capability contains zero permissions, remote-domain IPC is disabled, and the
webview has no command path to shell, filesystem, credentials or updater APIs.
The updater plugin is linked for Rust-only use; its invoke commands are denied
by the empty capability.

## Credential storage

`src/credentials.rs` prefers macOS Keychain, Windows Credential Manager or the
Linux Secret Service through `keyring`. If a real write/read/delete probe shows
that native storage is unavailable, a trusted native flow may supply a master
password and select the fallback. The fallback uses Argon2id
(64 MiB, 3 passes, one lane) and XChaCha20-Poly1305 with a fresh salt and nonce
for every atomic 0600 write. Master passwords are caller-supplied
`Zeroizing<String>` values; they must never arrive through an environment
variable, argv, webview message or project file. No credential operation is
currently exposed to JavaScript.

On Windows, the fallback stays below the current user's LocalAppData directory,
inherits that per-user ACL, remains encrypted at rest, and uses
`MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` for replacement. Unix paths are
additionally rejected when their permissions are broader than 0600/0700.

## Release assembly

Release automation must stage the target-specific Go daemon, a complete
relocatable Python environment, worker project, generated contracts, dashboard
assets and fixture under
`src-tauri/runtime/`, generate the manifest from those exact bytes, and sign it
with a Minisign key held outside the repository. Set both public keys when
building:

```bash
AGENTINTEL_SIDECAR_PUBLIC_KEY="$(cat release/sidecars.pub)" \
AGENTINTEL_UPDATER_PUBLIC_KEY="$(cat release/updater.pub)" \
  cargo build --locked --release --manifest-path apps/desktop/src-tauri/Cargo.toml
```

`build.rs` fails a release build when either public key is absent. The updater
builder overrides the checked-in sentinel with the compiled release key. Tauri
then verifies every downloaded updater artifact signature before installation.
Never commit private signing material or use the example manifest in a release.

## Toolchain status

The source-only workspace validation is `pnpm --filter @agentintel/desktop
build`. Native verification requires stable Rust 1.85 or newer plus the Tauri 2
system prerequisites for the target operating system:

```bash
rustup run stable cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
rustup run stable cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
rustup run stable cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

The Rust/Tauri toolchain is an explicit prerequisite and may not be installed
on a source-only contributor machine. Until those three commands run on every
release target, the native boundary is **unverified for release** even when the
JavaScript source validator passes.

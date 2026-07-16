import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const [
  capabilitiesSource,
  cargoSource,
  librarySource,
  manifestSource,
  supervisorSource,
  configSource,
] =
  await Promise.all([
    read("src-tauri/capabilities/default.json"),
    read("src-tauri/Cargo.toml"),
    read("src-tauri/src/lib.rs"),
    read("src-tauri/src/manifest.rs"),
    read("src-tauri/src/supervisor.rs"),
    read("src-tauri/tauri.conf.json"),
  ]);

const capabilities = JSON.parse(capabilitiesSource);
const config = JSON.parse(configSource);

if (!Array.isArray(capabilities.permissions) || capabilities.permissions.length !== 0) {
  throw new Error("the desktop webview capability must contain zero permissions");
}
if (cargoSource.includes("tauri-plugin-shell") || cargoSource.includes("tauri-plugin-fs")) {
  throw new Error("shell and filesystem plugins must not be linked into the desktop shell");
}
if (librarySource.includes("invoke_handler") || librarySource.includes("#[tauri::command]")) {
  throw new Error("the desktop shell must not register webview invoke commands");
}
if (config.app?.security?.dangerousRemoteDomainIpcAccess?.length) {
  throw new Error("remote-domain Tauri IPC must remain disabled");
}
if (!config.plugins?.updater?.pubkey || !config.bundle?.createUpdaterArtifacts) {
  throw new Error("signed updater configuration is required");
}
if (
  !librarySource.includes('"--dashboard-bootstrap-token-stdin".into()') ||
  librarySource.includes(".arg(token.expose())") ||
  librarySource.includes('"--uv-command".into()')
) {
  throw new Error("desktop tickets must use stdin and packaged Python must bypass uv");
}
if (
  !supervisorSource.includes(".stdin(Stdio::piped())") ||
  !supervisorSource.includes("Zeroizing::new")
) {
  throw new Error("the bootstrap ticket must use a zeroized bounded stdin pipe");
}
if (
  !manifestSource.includes("python_environment_root") ||
  !manifestSource.includes("python_command") ||
  !manifestSource.includes("seal_into") ||
  !manifestSource.includes("schema_version != 2")
) {
  throw new Error("the signed bundle must pin and seal a complete Python runtime");
}

console.log("desktop security boundary: valid");

import { chmod, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extension = process.platform === "win32" ? ".exe" : "";
const source = resolve(
  root,
  "packages/credential-broker-native/target/release",
  `golem-seo-credential-broker${extension}`,
);
const destinationDirectory = resolve(
  root,
  "apps/desktop/src-tauri/runtime/broker",
);
const destination = resolve(
  destinationDirectory,
  `golem-seo-credential-broker${extension}`,
);
await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
await copyFile(source, destination);
if (process.platform !== "win32") await chmod(destination, 0o755);
process.stdout.write(`Copied native credential broker to ${destination}.\n`);

import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  "artifacts",
  // The intelligence worker's uv-managed environment and tool caches. Third-party
  // wheels and licence texts are not this project's deployment stance.
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  ".hypothesis",
]);
const ignoredPaths = new Set([
  // Archived prior-session working notes. They describe the deployment stance in
  // prose (including the word this gate forbids) and are not product docs.
  ".archive",
  "apps/desktop/src-tauri/binaries",
  "apps/desktop/src-tauri/runtime",
]);
const ignoredFiles = new Set([
  "pnpm-lock.yaml",
  "validate-no-containers.mjs",
]);
const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".rs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const excludedName = ["dock", "er"].join("");
const forbiddenText = [new RegExp(excludedName, "i"), /compose\.(?:ya?ml)/i];
const forbiddenNames = [
  new RegExp(`^${excludedName}file(?:\\..+)?$`, "i"),
  /^compose\.ya?ml$/i,
];
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    const display = relative(root, path);
    if (entry.isDirectory() && ignoredPaths.has(display)) continue;
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
    if (forbiddenNames.some((pattern) => pattern.test(entry.name))) {
      failures.push(`${display}: excluded deployment file`);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const source = await readFile(path, "utf8");
    const lines = source.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      if (forbiddenText.some((pattern) => pattern.test(lines[index]))) {
        failures.push(`${display}:${index + 1}: excluded deployment reference`);
      }
    }
  }
}

await walk(root);
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Excluded deployment stack check passed.\n");
}

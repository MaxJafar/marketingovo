import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const lockfile = await readFile(resolve(root, "pnpm-lock.yaml"), "utf8");
const packagesStart = lockfile.indexOf("\npackages:\n");
const snapshotsStart = lockfile.indexOf("\nsnapshots:\n");
if (packagesStart < 0 || snapshotsStart <= packagesStart) {
  throw new Error(
    "pnpm-lock.yaml does not contain the expected packages and snapshots sections",
  );
}

function unquoteYamlKey(raw) {
  const value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'"))
    return value.slice(1, -1).replaceAll("''", "'");
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

function packageCoordinate(key) {
  const withoutPeers = key.split("(", 1)[0];
  const separator = withoutPeers.lastIndexOf("@");
  if (separator <= 0 || separator === withoutPeers.length - 1) return null;
  const name = withoutPeers.slice(0, separator);
  const version = withoutPeers.slice(separator + 1);
  if (!name || !/^v?\d/u.test(version)) return null;
  return { name, version };
}

const payload = {};
const packageSection = lockfile.slice(
  packagesStart + "\npackages:\n".length,
  snapshotsStart,
);
for (const line of packageSection.split(/\r?\n/u)) {
  const match = line.match(/^  (.+):$/u);
  if (!match) continue;
  const coordinate = packageCoordinate(unquoteYamlKey(match[1]));
  if (!coordinate) continue;
  (payload[coordinate.name] ??= []).push(coordinate.version);
}
for (const [name, versions] of Object.entries(payload)) {
  payload[name] = [...new Set(versions)].sort();
}
if (Object.keys(payload).length === 0)
  throw new Error("No registry packages were parsed from pnpm-lock.yaml");

const endpoint =
  process.env.NPM_BULK_ADVISORY_URL?.trim() ||
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "Marketingovo-dependency-audit/0.11",
  },
  body: JSON.stringify(payload),
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) {
  throw new Error(
    `npm bulk advisory request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
  );
}
const advisories = await response.json();
if (
  !advisories ||
  typeof advisories !== "object" ||
  Array.isArray(advisories)
) {
  throw new Error("npm bulk advisory response was not an object");
}

const blocking = [];
let total = 0;
for (const [name, entries] of Object.entries(advisories)) {
  if (!Array.isArray(entries))
    throw new Error(`npm advisory response for ${name} was not an array`);
  for (const advisory of entries) {
    if (!advisory || typeof advisory !== "object")
      throw new Error(`npm advisory response for ${name} was malformed`);
    total += 1;
    const severity = String(advisory.severity ?? "unknown").toLowerCase();
    if (severity === "high" || severity === "critical") {
      blocking.push({
        name,
        versions: payload[name] ?? [],
        severity,
        title: String(advisory.title ?? "Untitled advisory"),
        url: String(advisory.url ?? ""),
        vulnerableVersions: String(advisory.vulnerable_versions ?? "unknown"),
      });
    }
  }
}

if (blocking.length > 0) {
  for (const advisory of blocking) {
    process.stderr.write(
      `${advisory.severity.toUpperCase()} ${advisory.name}@${advisory.versions.join(",")} — ${advisory.title}\n` +
        `  vulnerable: ${advisory.vulnerableVersions}\n` +
        `  ${advisory.url}\n`,
    );
  }
  process.stderr.write(
    `Dependency audit blocked by ${blocking.length} high/critical advisory record(s).\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Dependency audit checked ${Object.keys(payload).length} package names; ` +
      `${total} non-blocking advisory record(s), no high or critical findings.\n`,
  );
}

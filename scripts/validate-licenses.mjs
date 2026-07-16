import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const store = join(process.cwd(), "node_modules", ".pnpm");
if (!existsSync(store))
  throw new Error(
    "node_modules is missing; run pnpm install before the license gate",
  );

const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "Python-2.0",
  "Unlicense",
  "Zlib",
]);
const packages = [];

function inspectPackage(path) {
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const expression =
    typeof manifest.license === "string" ? manifest.license.trim() : "";
  const identifiers = expression
    .replace(/[()]/gu, " ")
    .split(/\s+(?:AND|OR|WITH)\s+|\s+/gu)
    .filter(Boolean);
  const unsupported =
    !expression || identifiers.some((identifier) => !allowed.has(identifier));
  packages.push({
    name: manifest.name ?? path,
    version: manifest.version ?? "unknown",
    expression: expression || "UNKNOWN",
    unsupported,
  });
}

for (const entry of readdirSync(store)) {
  const dependencyRoot = join(store, entry, "node_modules");
  if (!existsSync(dependencyRoot)) continue;
  for (const name of readdirSync(dependencyRoot)) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      const scopeRoot = join(dependencyRoot, name);
      for (const scopedName of readdirSync(scopeRoot))
        inspectPackage(join(scopeRoot, scopedName, "package.json"));
    } else {
      inspectPackage(join(dependencyRoot, name, "package.json"));
    }
  }
}

const unique = [
  ...new Map(
    packages.map((item) => [`${item.name}@${item.version}`, item]),
  ).values(),
];
const unsupported = unique.filter((item) => item.unsupported);
if (unsupported.length > 0) {
  console.error("Dependency license gate failed:");
  for (const item of unsupported)
    console.error(`- ${item.name}@${item.version}: ${item.expression}`);
  process.exit(1);
}

console.log(
  `Validated ${unique.length} installed dependency licenses against the Community allowlist.`,
);

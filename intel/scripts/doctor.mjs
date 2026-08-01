#!/usr/bin/env node
// Reports which required development tools are missing, and how to get them.
// Never fails on a missing tool: the point is a readable report, not a gate.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (relative) =>
  JSON.parse(readFileSync(join(repoRoot, relative), "utf8"));

const readText = (relative) =>
  readFileSync(join(repoRoot, relative), "utf8").trim();

const probe = (command, args) => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const firstVersion = (value) => value?.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;

const compareVersions = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

const rootManifest = readJson("package.json");
const expectedGo = readText("go.mod").match(/^go\s+(\S+)/m)[1];
const nodeRange = rootManifest.engines.node;
const expectedNodeMajor = Number(readText(".node-version"));
const expectedPnpm = rootManifest.packageManager.replace("pnpm@", "");
// No rust-toolchain.toml here; the desktop crate pins a minimum instead.
const expectedRust = readText("apps/desktop/src-tauri/Cargo.toml").match(
  /rust-version\s*=\s*"([^"]+)"/,
)[1];

const checks = [
  {
    name: "go",
    expected: `>= ${expectedGo}`,
    found: firstVersion(probe("go", ["version"])),
    satisfied: (found) =>
      Boolean(found) && compareVersions(found, expectedGo) >= 0,
    remedy: [
      "brew install go",
      "",
      "The daemon, CLI, connectors and artifact governance are Go.",
    ],
  },
  {
    name: "uv",
    expected: "any recent release",
    found: firstVersion(probe("uv", ["--version"])),
    satisfied: (found) => Boolean(found),
    remedy: [
      "brew install uv",
      'export PATH="$HOME/.local/bin:$PATH"',
      "",
      "uv owns the pinned Python 3.12/3.13 worker environment.",
      "If the venv was created at a different absolute path, recreate it:",
      "  rm -rf workers/intelligence/.venv",
      "  uv sync --project workers/intelligence --dev",
    ],
  },
  {
    name: "buf",
    expected: "any recent release",
    found: firstVersion(probe("buf", ["--version"])),
    satisfied: (found) => Boolean(found),
    remedy: [
      "brew install buf",
      "go install google.golang.org/protobuf/cmd/protoc-gen-go@latest",
      "",
      "buf regenerates the Protobuf contracts across Go, Python and TypeScript.",
    ],
  },
  {
    name: "node",
    expected: `${nodeRange} (pinned to ${expectedNodeMajor}.x)`,
    found: firstVersion(probe("node", ["--version"])),
    satisfied: (found) => found?.split(".")[0] === String(expectedNodeMajor),
    remedy: [
      "brew install node@24",
      'export PATH="/opt/homebrew/opt/node@24/bin:$PATH"',
      "",
      "node@24 is keg-only, so it does not shadow a newer default node.",
      "engine-strict=true in .npmrc means pnpm refuses to install on the wrong major.",
    ],
  },
  {
    name: "pnpm",
    expected: expectedPnpm,
    found: firstVersion(probe("pnpm", ["--version"])),
    satisfied: (found) => found === expectedPnpm,
    remedy: [
      "corepack enable",
      `corepack prepare pnpm@${expectedPnpm} --activate`,
      "",
      "Run these with node@24 already on PATH so the shim lands in the right prefix.",
    ],
  },
  {
    name: "cargo",
    expected: `>= ${expectedRust}`,
    found: firstVersion(probe("cargo", ["--version"])),
    satisfied: (found) =>
      Boolean(found) && compareVersions(found, expectedRust) >= 0,
    remedy: [
      "brew install rustup",
      "rustup default stable",
      "rustup component add clippy rustfmt",
      'export PATH="/opt/homebrew/opt/rustup/bin:$PATH"',
      "",
      "Homebrew rustup puts its shims in /opt/homebrew/opt/rustup/bin,",
      "which is not added to PATH automatically.",
    ],
  },
  {
    name: "cargo-clippy",
    expected: "installed for the pinned toolchain",
    found: firstVersion(probe("cargo", ["clippy", "--version"])),
    satisfied: (found) => Boolean(found),
    remedy: ["rustup component add clippy"],
  },
];

let missing = 0;
const lines = ["", "AGENTintel toolchain report", ""];

for (const check of checks) {
  const ok = check.satisfied(check.found);
  if (!ok) missing += 1;
  const status = ok ? "ok     " : "MISSING";
  const found = check.found ?? "not found";
  lines.push(`  ${status}  ${check.name.padEnd(14)} want ${check.expected}`);
  lines.push(`${" ".repeat(25)}have ${found}`);
}

lines.push("");

if (missing === 0) {
  lines.push("Every required tool is present. `pnpm check` should run.");
  lines.push("");
  console.log(lines.join("\n"));
  process.exit(0);
}

lines.push(`${missing} tool(s) need attention:`);
lines.push("");

for (const check of checks) {
  if (check.satisfied(check.found)) continue;
  lines.push(`  ${check.name}`);
  for (const step of check.remedy) {
    lines.push(step ? `    ${step}` : "");
  }
  lines.push("");
}

lines.push(
  "Add the PATH exports to your shell profile to make them permanent.",
);
lines.push("");
console.log(lines.join("\n"));
process.exit(0);

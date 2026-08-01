// Fails if the retired product identity reappears anywhere in the tree.
//
// The rebrand from Golem Intel to AGENTintel was total: nothing had ever been
// published, so no wire identifier, environment variable, or file name needed a
// compatibility alias. That makes this gate strict by default — every allowance
// below is an explicit, reasoned exception, and there are only three kinds.
//
// GolemWorkers stays: it is the copyright holder, the trademark owner, and the
// name of the separate hosted commercial service.

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const RULES = Object.freeze([
  {
    id: "retired-product-identity",
    // Any spelling of the old product name, but not the company name.
    pattern:
      /Golem[ _-]?Intel|GOLEM[ _-]?INTEL|golem[ _-]?intel|golem\.intel|golem-inteld/giu,
  },
  {
    id: "retired-wire-identity",
    // Headers, cookies, npm scope, and the schema / parser namespaces recorded
    // in evidence manifests. The namespace forms are easy to miss because they
    // do not contain the product name.
    pattern:
      /X-Golem-|x-golem-|golem_session|@golem-intel\/|golem\.[a-z]|golem:\/\/|golem-(?:go|python)-/giu,
  },
  {
    id: "retired-sibling-identity",
    // The sibling product is AGENTseo now.
    pattern: /Golem[ _-]?SEO|golem-seo|GOLEMSEO_/giu,
  },
]);

// path prefix -> reason. A prefix ending in "/" covers a directory.
const ALLOWED = Object.freeze({
  "scripts/validate-identity.mjs":
    "This gate must name the retired patterns it detects.",
  "docs/adr/":
    "Architecture decision records state what was true when each decision was accepted; rewriting them would falsify the record.",
  "docs/reverse-engineering/":
    "The reference-corpus provenance record names third-party projects and the licence context in which they were reviewed.",
  ".archive/":
    "Archived prior-session working notes, retained for provenance and excluded from the published docs.",
  ".gitignore":
    "Local data written under the previous product name stays ignored so an existing checkout does not suddenly start tracking it.",
});

const SCANNED_EXTENSIONS = new Set([
  "",
  ".cjs",
  ".go",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".proto",
  ".py",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

// Deterministic build outputs and lockfiles are regenerated, not hand-edited;
// their own gates assert their exact bytes.
const SKIPPED = [
  "gen/",
  "packages/sdk/src/generated/",
  "pnpm-lock.yaml",
  "go.sum",
  "uv.lock",
  "Cargo.lock",
  "LICENSE",
  "PLAN.md",
];

const tracked = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\n")
  .filter(Boolean);

const allowedFor = (path) =>
  Object.entries(ALLOWED).find(([prefix]) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );

const violations = [];
let scanned = 0;
let exempt = 0;

for (const path of tracked) {
  if (SKIPPED.some((prefix) => path.startsWith(prefix))) continue;
  if (!SCANNED_EXTENSIONS.has(extname(path))) continue;

  let source;
  try {
    source = await readFile(resolve(root, path), "utf8");
  } catch {
    continue;
  }
  scanned += 1;

  const allowance = allowedFor(path);
  const lines = source.split("\n");

  for (const rule of RULES) {
    for (const [index, line] of lines.entries()) {
      const matches = [...line.matchAll(rule.pattern)];
      if (matches.length === 0) continue;
      if (allowance) {
        exempt += matches.length;
        continue;
      }
      for (const match of matches) {
        violations.push(
          `${path}:${index + 1} [${rule.id}] ${JSON.stringify(match[0])}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `The retired product identity reappeared in ${violations.length} place(s):\n` +
      `${violations.map((line) => `  ${line}`).join("\n")}\n\n` +
      "Nothing was ever published under the old name, so there is no " +
      "compatibility reason to keep it. Rename it, or add a reasoned exception " +
      "to ALLOWED in scripts/validate-identity.mjs.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Identity is canonical across ${scanned} scanned files ` +
    `(${exempt} occurrence(s) inside ${Object.keys(ALLOWED).length} reasoned exceptions).\n`,
);

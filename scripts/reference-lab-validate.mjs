#!/usr/bin/env node

import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const referenceRootName = "TO REVERSE ENGINEEER";
const referenceRoot = path.join(repoRoot, referenceRootName);
const ledgerPath = path.join(
  repoRoot,
  "docs/reverse-engineering/provenance-ledger.json",
);
const cardsPath = path.join(
  repoRoot,
  "docs/reverse-engineering/behavioral-cards.md",
);
const quarantinePath = path.join(
  repoRoot,
  "docs/reverse-engineering/quarantine-manifest.json",
);

const errors = [];
const allowedDecisions = new Set([
  "clean-room-rebuild",
  "evaluate-external-dependency",
  "separate-service-review",
  "licensed-data-review",
  "reference-only",
  "blocked",
  "quarantine",
]);
const buildManifestNames = new Set([
  "Cargo.toml",
  "Dockerfile",
  "Makefile",
  "buf.gen.yaml",
  "buf.yaml",
  "deno.json",
  "deno.jsonc",
  "go.mod",
  "go.work",
  "package.json",
  "pnpm-workspace.yaml",
  "pyproject.toml",
  "turbo.json",
]);
const skippedDirectories = new Set([
  ".git",
  "node_modules",
  ".pnpm-store",
  ".turbo",
  ".venv",
  "coverage",
  "dist",
  "gen",
  "target",
  referenceRootName,
]);
const sourceExtensions = new Set([
  ".cjs",
  ".go",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".py",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
]);
const sourceScanAllowlist = new Set([
  "scripts/reference-lab-validate.mjs",
  "scripts/scan-reference-secrets.mjs",
]);

function slash(value) {
  return value.split(path.sep).join("/");
}

function repoRelative(absolutePath) {
  return slash(path.relative(repoRoot, absolutePath));
}

function fail(ruleId, relativePath) {
  errors.push({ ruleId, path: slash(relativePath) });
}

async function readJson(absolutePath, ruleId) {
  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch {
    fail(ruleId, repoRelative(absolutePath));
    return null;
  }
}

async function exists(absolutePath) {
  try {
    await lstat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function validateLedger() {
  const ledger = await readJson(ledgerPath, "LEDGER_PARSE");
  if (!ledger) return { ledger: null, archives: [] };

  const diskEntries = await readdir(referenceRoot, { withFileTypes: true });
  const diskArchives = diskEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const records = Array.isArray(ledger.archives) ? ledger.archives : [];
  const ledgerArchives = records.map((record) => record.archive).sort();

  if (ledger.schema_version !== 1)
    fail("LEDGER_SCHEMA_VERSION", repoRelative(ledgerPath));
  if (ledger.reference_root !== referenceRootName)
    fail("LEDGER_REFERENCE_ROOT", repoRelative(ledgerPath));
  if (ledger.archive_count !== 50 || records.length !== 50) {
    fail("LEDGER_ARCHIVE_COUNT", repoRelative(ledgerPath));
  }
  if (new Set(ledgerArchives).size !== ledgerArchives.length) {
    fail("LEDGER_DUPLICATE_ARCHIVE", repoRelative(ledgerPath));
  }

  for (const archive of diskArchives) {
    if (!ledgerArchives.includes(archive))
      fail("LEDGER_MISSING_ARCHIVE", `${referenceRootName}/${archive}`);
  }
  for (const archive of ledgerArchives) {
    if (!diskArchives.includes(archive))
      fail("LEDGER_UNKNOWN_ARCHIVE", `${referenceRootName}/${archive}`);
  }

  for (const record of records) {
    const recordPath = `${referenceRootName}/${record.archive ?? "UNKNOWN"}`;
    if (record.local_path !== recordPath) fail("LEDGER_LOCAL_PATH", recordPath);
    if (record.build_input !== false)
      fail("REFERENCE_BUILD_INPUT_ENABLED", recordPath);
    if (record.code_copy_allowed !== false)
      fail("REFERENCE_CODE_COPY_ENABLED", recordPath);
    if (!allowedDecisions.has(record.decision))
      fail("LEDGER_DECISION", recordPath);
    if (!record.license || typeof record.license.status !== "string") {
      fail("LEDGER_LICENSE", recordPath);
    }
    if (!Array.isArray(record.risk_ids) || record.risk_ids.length === 0) {
      fail("LEDGER_RISK_IDS", recordPath);
    } else {
      for (const riskId of record.risk_ids) {
        if (!ledger.risk_definitions?.[riskId])
          fail("LEDGER_UNKNOWN_RISK", recordPath);
      }
    }
    for (const evidencePath of record.license?.evidence ?? []) {
      if (!(await exists(path.join(repoRoot, recordPath, evidencePath)))) {
        fail(
          "LEDGER_LICENSE_EVIDENCE_MISSING",
          `${recordPath}/${evidencePath}`,
        );
      }
    }
  }

  return { ledger, archives: ledgerArchives };
}

async function validateBehavioralCards(archives) {
  let cards;
  try {
    cards = await readFile(cardsPath, "utf8");
  } catch {
    fail("BEHAVIORAL_CARDS_READ", repoRelative(cardsPath));
    return;
  }

  const lines = cards.split(/\r?\n/);
  const cardArchives = lines
    .map((line) => line.match(/^\|\s*`([^`]+)`\s*\|/)?.[1])
    .filter(Boolean);
  for (const archive of archives) {
    const count = cardArchives.filter(
      (candidate) => candidate === archive,
    ).length;
    if (count !== 1)
      fail("BEHAVIORAL_CARD_COUNT", `${repoRelative(cardsPath)}#${archive}`);
  }
  for (const archive of cardArchives) {
    if (!archives.includes(archive)) {
      fail(
        "BEHAVIORAL_CARD_UNKNOWN_ARCHIVE",
        `${repoRelative(cardsPath)}#${archive}`,
      );
    }
  }
}

async function validateQuarantine(ledger) {
  const quarantine = await readJson(quarantinePath, "QUARANTINE_PARSE");
  if (!quarantine) return;
  const entries = Array.isArray(quarantine.entries) ? quarantine.entries : [];
  const seen = new Set();
  const allowedEntryKeys = new Set([
    "path",
    "archive",
    "reason_ids",
    "status",
    "build_input",
  ]);

  if (entries.length === 0)
    fail("QUARANTINE_EMPTY", repoRelative(quarantinePath));
  if (
    quarantine.handling?.display_values_allowed !== false ||
    quarantine.handling?.log_values_allowed !== false
  ) {
    fail("QUARANTINE_VALUE_DISCLOSURE", repoRelative(quarantinePath));
  }

  for (const entry of entries) {
    const entryPath = typeof entry.path === "string" ? entry.path : "UNKNOWN";
    if (seen.has(entryPath)) fail("QUARANTINE_DUPLICATE_PATH", entryPath);
    seen.add(entryPath);
    if (!entryPath.startsWith(`${referenceRootName}/`))
      fail("QUARANTINE_OUTSIDE_LAB", entryPath);
    if (entry.status !== "quarantined" || entry.build_input !== false) {
      fail("QUARANTINE_POLICY", entryPath);
    }
    if (!Array.isArray(entry.reason_ids) || entry.reason_ids.length === 0) {
      fail("QUARANTINE_REASON", entryPath);
    }
    for (const key of Object.keys(entry)) {
      if (!allowedEntryKeys.has(key))
        fail("QUARANTINE_UNSAFE_FIELD", entryPath);
    }
    if (!(await exists(path.join(repoRoot, entryPath))))
      fail("QUARANTINE_PATH_MISSING", entryPath);
    const ledgerRecord = ledger?.archives?.find(
      (record) => record.archive === entry.archive,
    );
    if (!ledgerRecord || ledgerRecord.build_input !== false) {
      fail("QUARANTINE_LEDGER_MISMATCH", entryPath);
    }
  }
}

function isBuildManifest(name) {
  return (
    buildManifestNames.has(name) ||
    /^docker-compose.*\.ya?ml$/i.test(name) ||
    /^requirements.*\.txt$/i.test(name) ||
    /^tsconfig(?:\..+)?\.json$/i.test(name)
  );
}

async function inspectProductTree(directory, archiveNames) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      try {
        const target = await realpath(absolutePath);
        if (
          target === referenceRoot ||
          target.startsWith(`${referenceRoot}${path.sep}`)
        ) {
          fail("REFERENCE_SYMLINK", repoRelative(absolutePath));
        }
      } catch {
        fail("BROKEN_SYMLINK", repoRelative(absolutePath));
      }
      continue;
    }
    if (entry.isDirectory()) {
      await inspectProductTree(absolutePath, archiveNames);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = repoRelative(absolutePath);
    const buildManifest = isBuildManifest(entry.name);
    const productSource =
      sourceExtensions.has(path.extname(entry.name).toLowerCase()) &&
      !sourceScanAllowlist.has(relativePath);
    if (!buildManifest && !productSource) continue;

    let content;
    try {
      content = await readFile(absolutePath, "utf8");
    } catch {
      fail(
        buildManifest ? "BUILD_MANIFEST_READ" : "PRODUCT_SOURCE_READ",
        relativePath,
      );
      continue;
    }
    if (content.includes(referenceRootName)) {
      fail(
        buildManifest
          ? "REFERENCE_ROOT_IN_BUILD_MANIFEST"
          : "REFERENCE_ROOT_IN_PRODUCT_SOURCE",
        relativePath,
      );
    }
    for (const archive of archiveNames) {
      if (content.includes(archive)) {
        fail(
          buildManifest
            ? "REFERENCE_ARCHIVE_IN_BUILD_MANIFEST"
            : "REFERENCE_ARCHIVE_IN_PRODUCT_SOURCE",
          relativePath,
        );
        break;
      }
    }
  }
}

async function main() {
  const { ledger, archives } = await validateLedger();
  await validateBehavioralCards(archives);
  await validateQuarantine(ledger);
  await inspectProductTree(repoRoot, archives);

  if (errors.length > 0) {
    errors
      .sort((left, right) =>
        `${left.ruleId}:${left.path}`.localeCompare(
          `${right.ruleId}:${right.path}`,
        ),
      )
      .forEach((error) =>
        process.stderr.write(`FAIL\t${error.ruleId}\t${error.path}\n`),
      );
    process.stderr.write(`SUMMARY\tfailures=${errors.length}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `PASS\treference_archives=${archives.length},build_inputs=0\n`,
  );
}

main().catch(() => {
  process.stderr.write(
    "FAIL\tVALIDATOR_FATAL\tscripts/reference-lab-validate.mjs\n",
  );
  process.exitCode = 1;
});

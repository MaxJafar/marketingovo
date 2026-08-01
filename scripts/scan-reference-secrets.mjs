#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const referenceRoot = path.join(repoRoot, "TO REVERSE ENGINEEER");
const quarantinePath = path.join(
  repoRoot,
  "docs/intel/reverse-engineering/quarantine-manifest.json",
);

const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");
const failOnFindings = args.has("--fail-on-findings");
const failOnUnquarantined = args.has("--fail-on-unquarantined");
const allowedArgs = new Set([
  "--json",
  "--fail-on-findings",
  "--fail-on-unquarantined",
]);

if ([...args].some((arg) => !allowedArgs.has(arg))) {
  process.stderr.write("SCAN_CONFIGURATION_ERROR\n");
  process.exit(64);
}

const maxTextBytes = 2 * 1024 * 1024;
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  ".pnpm-store",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  "dist",
  "build",
  "target",
]);
const ignoredNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "uv.lock",
]);
const textExtensions = new Set([
  "",
  ".cfg",
  ".conf",
  ".css",
  ".csv",
  ".env",
  ".go",
  ".graphql",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".rst",
  ".sh",
  ".sql",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);
const extensionlessTextNames = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  "Gemfile",
  "Rakefile",
]);

function slash(value) {
  return value.split(path.sep).join("/");
}

function relativeToRepo(absolutePath) {
  return slash(path.relative(repoRoot, absolutePath));
}

function isTextCandidate(absolutePath, size) {
  const base = path.basename(absolutePath);
  if (ignoredNames.has(base) || size > maxTextBytes) return false;
  return (
    extensionlessTextNames.has(base) ||
    textExtensions.has(path.extname(base).toLowerCase())
  );
}

function isPlaceholder(value) {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  if (!normalized) return true;
  if (
    /(?:example|sample|dummy|fake|placeholder|changeme|change-me|replace-me|replace_this|your[_ -]|todo|xxx|redacted)/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    normalized.includes("${") ||
    normalized.includes("{{") ||
    normalized.includes("process.env") ||
    normalized.includes("os.getenv") ||
    normalized.includes("getenv(") ||
    normalized.includes("settings.") ||
    normalized.includes("request.")
  ) {
    return true;
  }
  return /^<[^>]+>$/.test(normalized) || /^(.)\1{7,}$/.test(normalized);
}

function isConfigurationLike(absolutePath) {
  const base = path.basename(absolutePath).toLowerCase();
  const extension = path.extname(base);
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    /(?:config|setting|credential|secret|docker-compose)/.test(base) ||
    new Set([
      ".cfg",
      ".conf",
      ".ini",
      ".json",
      ".properties",
      ".toml",
      ".yaml",
      ".yml",
    ]).has(extension)
  );
}

function detectRules(content, absolutePath) {
  const rules = new Set();

  if (
    /(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(
      content,
    )
  ) {
    rules.add("PRIVATE_KEY_MATERIAL");
  }
  if (
    /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|sk-[A-Za-z0-9_-]{20,})\b/.test(
      content,
    )
  ) {
    rules.add("KNOWN_TOKEN_FORMAT");
  }
  if (
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(
      content,
    )
  ) {
    rules.add("JWT_LITERAL");
  }
  if (isConfigurationLike(absolutePath)) {
    if (/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i.test(content)) {
      rules.add("CREDENTIAL_IN_URL");
    }

    const assignment =
      /(?:^|\n)\s*(?:export\s+)?["']?(api[_-]?(?:key|hash)|client[_-]?(?:id|secret)|access[_-]?token|refresh[_-]?token|auth[_-]?token|bot[_-]?token|password|passwd|sessionid|session[_-]?key|private[_-]?key|secret)["']?\s*[:=]\s*["']?([^\s"'#,;]{8,})/gim;
    for (const match of content.matchAll(assignment)) {
      if (!isPlaceholder(match[2])) {
        rules.add("CREDENTIAL_ASSIGNMENT_LITERAL");
        break;
      }
    }
  }

  return rules;
}

async function loadQuarantine() {
  try {
    const parsed = JSON.parse(await readFile(quarantinePath, "utf8"));
    return new Set(parsed.entries.map((entry) => entry.path));
  } catch {
    process.stderr.write("QUARANTINE_MANIFEST_ERROR\n");
    process.exit(65);
  }
}

async function collectFiles(directory, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    output.push({ absolutePath: directory, scanError: true });
    return output;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, output);
    } else if (entry.isFile()) {
      output.push({ absolutePath, scanError: false });
    }
  }
  return output;
}

async function main() {
  const quarantine = await loadQuarantine();
  const files = await collectFiles(referenceRoot);
  const findings = [];
  let scanned = 0;
  let skipped = 0;

  for (const file of files) {
    const relativePath = relativeToRepo(file.absolutePath);
    const rules = new Set();

    if (file.scanError) {
      findings.push({ path: relativePath, rule_ids: ["SCAN_ERROR"] });
      continue;
    }

    if (quarantine.has(relativePath)) rules.add("KNOWN_QUARANTINE_PATH");

    const base = path.basename(file.absolutePath).toLowerCase();
    const relativeLower = relativePath.toLowerCase();
    if (
      base === ".env" ||
      (base.startsWith(".env.") &&
        !/(?:example|sample|template)$/.test(base)) ||
      relativeLower.includes("/secrets/")
    ) {
      rules.add("SECRET_BEARING_PATH");
    }
    if (
      base.endsWith(".session") ||
      /^(?:cookies?|session)(?:\.(?:json|sqlite|db))?$/.test(base)
    ) {
      rules.add("SESSION_ARTIFACT_PATH");
    }

    let metadata;
    try {
      metadata = await stat(file.absolutePath);
    } catch {
      rules.add("SCAN_ERROR");
    }

    if (metadata && isTextCandidate(file.absolutePath, metadata.size)) {
      try {
        const content = await readFile(file.absolutePath, "utf8");
        scanned += 1;
        for (const rule of detectRules(content, file.absolutePath))
          rules.add(rule);
      } catch {
        rules.add("SCAN_ERROR");
      }
    } else {
      skipped += 1;
    }

    if (rules.size > 0) {
      findings.push({ path: relativePath, rule_ids: [...rules].sort() });
    }
  }

  findings.sort((left, right) => left.path.localeCompare(right.path));
  const unquarantined = findings.filter(
    (finding) => !finding.rule_ids.includes("KNOWN_QUARANTINE_PATH"),
  ).length;

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify({ findings, summary: { files_scanned: scanned, files_skipped: skipped, finding_paths: findings.length, unquarantined_paths: unquarantined } }, null, 2)}\n`,
    );
  } else {
    for (const finding of findings) {
      process.stdout.write(`${finding.path}\t${finding.rule_ids.join(",")}\n`);
    }
    process.stdout.write(
      `SUMMARY\tfiles_scanned=${scanned},files_skipped=${skipped},finding_paths=${findings.length},unquarantined_paths=${unquarantined}\n`,
    );
  }

  if (failOnFindings && findings.length > 0) process.exitCode = 2;
  if (failOnUnquarantined && unquarantined > 0) process.exitCode = 2;
}

main().catch(() => {
  process.stderr.write("SCAN_FATAL_ERROR\n");
  process.exitCode = 70;
});

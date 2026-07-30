import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_WORKSPACE_IDENTITIES } from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const IDENTITY_BASELINE_PATH = "scripts/identity-migration-baseline.json";
const BASELINE_SCHEMA_VERSION = 2;
const BASELINE_FINGERPRINT_ALGORITHM =
  "sha256(rule,path,line,column,previous-line,matched-line,next-line)-multiset-v2";

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".mjs",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const IDENTITY_TEXT_ROOTS = Object.freeze([
  ".github/",
  "adapters/",
  "apps/",
  "benchmarks/",
  // Documentation was previously outside the sentinel, which let old-brand
  // prose survive a rebrand unnoticed. Published docs are product surface.
  "docs/",
  "e2e/",
  "launch/",
  "migrations/",
  "packages/",
  "plugins/",
  "release/",
  "scripts/",
]);
const IDENTITY_ROOT_TEXT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "tsconfig.json",
  "turbo.json",
]);

// Authorized legacy-identity exceptions after the completed Marketingovo rebrand.
//
// The rebrand removed every cosmetic occurrence of the old product name. What
// remains falls into three groups, and nothing else may be added without a
// stated reason:
//
//   1. compatibility surfaces that must keep reading or accepting a value an
//      earlier install wrote (env vars, store filenames, bundle extension and
//      media type, localStorage keys);
//   2. tests that prove those surfaces work, or prove a retired name is now
//      rejected;
//   3. the sentinel itself, which has to name the patterns it detects.
//
// The project has no corporate affiliation and no paid tier. The former
// company name, its domain, and the hosted-edition vocabulary are therefore
// violations everywhere except in this gate, which has to name them.
export const IDENTITY_ALLOWLIST = Object.freeze([
  {
    rule: "legacy-product-identity",
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must name the old-brand patterns and every reasoned exception in order to prevent unreviewed additions.",
  },
  ...[
    "legacy-agent-contract",
    "legacy-cli-alias",
    "former-affiliation",
    "retired-agentseo-identity",
  ].map((rule) => ({
    rule,
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must name the old-brand patterns it detects for every rule.",
  })),

  {
    rule: "retired-agentseo-identity",
    path: "scripts/npm-release-policy.mjs",
    reason:
      "The npm release policy must name the retired package scope in order to forbid it.",
  },

  // 1. Compatibility surfaces.
  {
    rule: "legacy-product-identity",
    path: "packages/core/src/env.ts",
    reason:
      "The shared environment reader derives the GOLEMSEO_*/GOLEM_SEO_* alias chain so configuration written before the rename still resolves.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/core/src/core/store.ts",
    reason:
      "The store keeps golem-seo.db and screaming-claw.db in its fallback chain so no generation of local SQLite data is stranded.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/cli/src/cli.ts",
    reason:
      "Credential-broker and master-password environment aliases stay readable with a one-time deprecation warning.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/cli/src/compatibility.ts",
    reason:
      "CLI data-directory, service-token and API-URL environment aliases stay readable with a one-time deprecation warning.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/mcp/src/compatibility.ts",
    reason:
      "MCP keeps the retired environment aliases so existing agent host configuration keeps working.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/runtime/src/google-oauth-env.ts",
    reason:
      "The Google desktop client ID accepts its two retired environment names, canonical value first.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/server/src/google-oauth.ts",
    reason:
      "The not-configured problem detail names the retired environment aliases so operators can find their existing value.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/server/src/index.ts",
    reason:
      "Project import still accepts the application/vnd.golemseo.project+json media type; exports always emit the canonical type.",
  },
  ...[].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Project import accepts the .golemseo bundle extension alongside .marketingovo; export only writes .marketingovo.",
  })),
  ...[].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "One-time localStorage migration reads the golem-seo:* key, rewrites it under the canonical key, and deletes the original.",
  })),
  {
    rule: "legacy-product-identity",
    path: "scripts/desktop-runtime-config.mjs",
    reason:
      "The PKCE guard rejects a packaged Google client secret under the canonical name and both retired names.",
  },
  ...[
    "packages/legacy-import/src/index.ts",
    "packages/legacy-import/src/index.test.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "The pre-0.11 importer discovers file names and environment variables a previous install wrote; these are historical facts, not current identity.",
  })),

  // 2. Tests covering those surfaces, including retired-name rejection.
  ...[
    "packages/core/tests/env.test.ts",
    "packages/core/tests/limits.test.ts",
    "packages/core/tests/audit-full-cli.test.ts",
    "packages/core/tests/watch.test.ts",
    "packages/cli/src/compatibility.test.ts",
    "packages/mcp/src/compatibility.test.ts",
    "packages/runtime/src/google-oauth-env.test.ts",
    "apps/desktop/scripts/validate.mjs",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Coverage proves each retired name still resolves, warns once, and never leaks its value.",
  })),
  {
    rule: "legacy-product-identity",
    path: "packages/server/src/index.test.ts",
    reason:
      "Coverage proves the retired session cookie, CSRF header and client header are now rejected rather than accepted.",
  },

  // 3. GolemWorkers is the company and the separate commercial service.
  ...["legacy-package-scope", "legacy-product-identity"].map((rule) => ({
    rule,
    path: "scripts/npm-release-policy.mjs",
    reason:
      "The publication policy must name the forbidden legacy and squatting scopes it rejects.",
  })),
]);

const TEXT_RULES = Object.freeze([
  {
    id: "legacy-product-identity",
    pattern:
      /Golem SEO|GolemSEO|GolemSeo|golemSeo|golem-seo|golemseo|GOLEMSEO|GOLEM_SEO|golem_session|x-golem-(?:client|csrf)/gu,
    sourceOnly: true,
  },
  {
    id: "legacy-package-scope",
    pattern: /@(?:golem-seo|agent-seo|agentseoapp)\//giu,
    sourceOnly: true,
  },
  {
    id: "former-affiliation",
    pattern: /\bGolemWorkers\b|golemworkers(?:[./_-]|[A-Z])/giu,
    sourceOnly: true,
  },
  {
    // The product has now been renamed twice. Nothing shipped under either prior
    // name, so unlike a normal rename there is no compatibility surface to keep:
    // any occurrence is a leftover, not an alias.
    id: "retired-agentseo-identity",
    pattern:
      /AGENTseo|AGENTSEO|agentseoapp|agentseo_[a-z_]+|agentseo:\/\/|\.agentseo\b/gu,
    sourceOnly: true,
  },
  {
    id: "invented-marketingovo-domain",
    // The product is now named marketingovo, so this rule must distinguish a
    // hostname from an ordinary dotted identifier. `marketingovo.db`,
    // `marketingovo.service`, `marketingovo.cdx.json`, and `vnd.marketingovo.project+json`
    // are file names and media types, not domains. Only flag a match that is
    // either in an explicit URL/email context or ends in a real TLD.
    pattern:
      /(?:(?:https?:\/\/|mailto:|\/\/)(?:[A-Za-z0-9-]+\.)*agent-?seo(?:app)?\.[A-Za-z]{2,63}\b)|(?:\b(?:[A-Za-z0-9-]+\.)*agent-?seo(?:app)?\.(?:com|net|org|io|ai|dev|co|sh|xyz|cloud|tools|so|me|info|biz|tech|site|online|store|page|link|email)\b)/giu,
    sourceOnly: false,
  },
  {
    id: "legacy-agent-contract",
    pattern:
      /golem_seo_(?:audit_start|run_get|compare_start|keyword_research_start|content_plan_start|monitoring_status)|golem-seo:\/\/|golem-seo-mcp|name:\s*["']golem-seo["']/gu,
    sourceOnly: true,
  },
  {
    id: "legacy-cli-alias",
    pattern:
      /golem-seo is deprecated|["']golem-seo["']\s*:\s*["']\.\/dist\/golem-seo\.js["']/giu,
    sourceOnly: true,
  },
]);

const BASELINE_RULE_LABELS = Object.freeze({
  "legacy-product-identity": "legacy-product",
  "legacy-package-scope": "reserved-package-scope",
  "former-affiliation": "former-affiliation",
  "invented-marketingovo-domain": "unapproved-domain",
  "legacy-agent-contract": "legacy-agent-contract",
  "legacy-cli-alias": "legacy-cli-alias",
  "retired-agentseo-identity": "retired-agentseo",
});

function sha256(...parts) {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function allowlistEntry(rule, path, entries = IDENTITY_ALLOWLIST) {
  return entries.find(
    (entry) =>
      entry.rule === rule &&
      (entry.path === path ||
        (entry.path.endsWith("/") && path.startsWith(entry.path))),
  );
}

function authorizationId(entry) {
  return sha256(entry.rule, entry.path, entry.reason);
}

function baselineExceptionId(rule, path) {
  return sha256(rule, path);
}

function redactBaselineHint(value) {
  return value
    .replace(
      /Golem SEO|GolemSEO|GolemSeo|golemSeo|golem-seo|golemseo|GOLEMSEO|GOLEM_SEO/gu,
      "[legacy-product]",
    )
    .replace(/GolemWorkers|golemworkers/giu, "[hosted-service]");
}

export function validateAllowlist(entries = IDENTITY_ALLOWLIST) {
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.rule || !entry.path || entry.reason.trim().length < 40) {
      throw new Error(
        `Identity allowlist entries require a rule, path, and specific reason: ${JSON.stringify(entry)}`,
      );
    }
    const key = `${entry.rule}:${entry.path}`;
    if (seen.has(key))
      throw new Error(`Duplicate identity allowlist entry ${key}`);
    if (!TEXT_RULES.some((rule) => rule.id === entry.rule)) {
      throw new Error(`Unknown identity allowlist rule ${entry.rule}`);
    }
    seen.add(key);
  }
}

function trackedFiles(repositoryRoot) {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  )
    .split("\0")
    .filter(Boolean);
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineContext(source, index) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const nextLine = source.indexOf("\n", index);
  const lineEnd = nextLine === -1 ? source.length : nextLine;
  const previousLineEnd = Math.max(0, lineStart - 1);
  const previousLineStart =
    source.lastIndexOf("\n", Math.max(0, previousLineEnd - 1)) + 1;
  const followingLineStart = nextLine === -1 ? source.length : nextLine + 1;
  const followingLineEnd = source.indexOf("\n", followingLineStart);
  return {
    line: lineNumber(source, index),
    column: index - lineStart + 1,
    previous: source
      .slice(previousLineStart, previousLineEnd)
      .replace(/\r$/u, ""),
    matched: source.slice(lineStart, lineEnd).replace(/\r$/u, ""),
    next: source
      .slice(
        followingLineStart,
        followingLineEnd === -1 ? source.length : followingLineEnd,
      )
      .replace(/\r$/u, ""),
  };
}

function isIdentityTextSurface(path) {
  const filename = path.slice(path.lastIndexOf("/") + 1);
  if (filename === "LICENSE" || filename === "NOTICE") return false;
  return (
    SOURCE_EXTENSIONS.has(extname(path)) ||
    IDENTITY_ROOT_TEXT_FILES.has(path) ||
    IDENTITY_TEXT_ROOTS.some((prefix) => path.startsWith(prefix))
  );
}

function scanTextSource(path, source, allowlist = IDENTITY_ALLOWLIST) {
  const unauthorized = [];
  const groups = new Map();
  for (const rule of TEXT_RULES) {
    if (rule.sourceOnly && !isIdentityTextSurface(path)) continue;
    for (const match of source.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const authorization = allowlistEntry(rule.id, path, allowlist);
      if (!authorization) {
        unauthorized.push({
          rule: rule.id,
          path,
          line: lineNumber(source, index),
          match: match[0],
        });
        continue;
      }

      const id = baselineExceptionId(rule.id, path);
      const group = groups.get(id) ?? {
        id,
        rule: rule.id,
        path,
        authorization,
        occurrenceHashes: [],
      };
      const context = lineContext(source, index);
      group.occurrenceHashes.push(
        sha256(
          rule.id,
          path,
          context.line,
          context.column,
          context.previous,
          context.matched,
          context.next,
        ),
      );
      groups.set(id, group);
    }
  }
  return { groups, unauthorized };
}

function baselineEntry(group) {
  const occurrenceHashes = [...group.occurrenceHashes].sort();
  return {
    id: group.id,
    rule: BASELINE_RULE_LABELS[group.rule],
    file: redactBaselineHint(group.path),
    authorizedBy: redactBaselineHint(group.authorization.path),
    authorizationHash: authorizationId(group.authorization),
    count: occurrenceHashes.length,
    contentHash: sha256(...occurrenceHashes),
    occurrenceHashes,
  };
}

function compareBaselineEntries(actualGroups, expectedEntries) {
  const violations = [];
  const actual = new Map(
    [...actualGroups.values()].map((group) => [group.id, baselineEntry(group)]),
  );
  const expected = new Map(expectedEntries.map((entry) => [entry.id, entry]));

  for (const [id, entry] of actual) {
    const pinned = expected.get(id);
    if (!pinned) {
      violations.push({
        rule: "identity-baseline-missing",
        path: entry.file,
        line: 1,
        match: `${entry.rule}: ${entry.count} unpinned occurrence(s)`,
      });
      continue;
    }
    if (JSON.stringify(entry) !== JSON.stringify(pinned)) {
      violations.push({
        rule: "identity-baseline-mismatch",
        path: entry.file,
        line: 1,
        match: `${entry.rule}: expected ${pinned.count}, found ${entry.count}; occurrence content changed`,
      });
    }
  }

  for (const [id, entry] of expected) {
    if (actual.has(id)) continue;
    violations.push({
      rule: "identity-baseline-stale",
      path: entry.file,
      line: 1,
      match: `${entry.rule}: all ${entry.count} pinned occurrence(s) disappeared`,
    });
  }
  return violations;
}

function canonicalBaseline(baseline) {
  return {
    schemaVersion: baseline.schemaVersion,
    fingerprintAlgorithm: baseline.fingerprintAlgorithm,
    exceptions: [...baseline.exceptions].sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.rule.localeCompare(b.rule) ||
        a.id.localeCompare(b.id),
    ),
  };
}

export function serializeIdentityBaseline(baseline) {
  return `${JSON.stringify(canonicalBaseline(baseline), null, 2)}\n`;
}

function validateBaselineShape(baseline) {
  if (
    baseline?.schemaVersion !== BASELINE_SCHEMA_VERSION ||
    baseline?.fingerprintAlgorithm !== BASELINE_FINGERPRINT_ALGORITHM ||
    !Array.isArray(baseline?.exceptions)
  ) {
    throw new Error(
      `Identity baseline must use schema ${BASELINE_SCHEMA_VERSION} and ${BASELINE_FINGERPRINT_ALGORITHM}`,
    );
  }
  const ids = new Set();
  for (const entry of baseline.exceptions) {
    if (
      typeof entry?.id !== "string" ||
      typeof entry?.rule !== "string" ||
      typeof entry?.file !== "string" ||
      typeof entry?.authorizedBy !== "string" ||
      typeof entry?.authorizationHash !== "string" ||
      !Number.isSafeInteger(entry?.count) ||
      entry.count < 1 ||
      typeof entry?.contentHash !== "string" ||
      !Array.isArray(entry?.occurrenceHashes) ||
      entry.occurrenceHashes.length !== entry.count
    ) {
      throw new Error(
        `Malformed identity baseline entry ${JSON.stringify(entry)}`,
      );
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate identity baseline entry ${entry.id}`);
    }
    ids.add(entry.id);
    for (const value of [
      entry.id,
      entry.authorizationHash,
      entry.contentHash,
      ...entry.occurrenceHashes,
    ]) {
      if (!/^sha256:[a-f0-9]{64}$/u.test(value)) {
        throw new Error(
          `Invalid identity baseline hash ${JSON.stringify(value)}`,
        );
      }
    }
    if (
      entry.contentHash !== sha256(...entry.occurrenceHashes) ||
      JSON.stringify(entry.occurrenceHashes) !==
        JSON.stringify([...entry.occurrenceHashes].sort())
    ) {
      throw new Error(`Non-canonical occurrence multiset for ${entry.id}`);
    }
  }
}

export async function readIdentityBaseline(repositoryRoot = root) {
  const source = await readFile(
    resolve(repositoryRoot, IDENTITY_BASELINE_PATH),
    "utf8",
  );
  const baseline = JSON.parse(source);
  validateBaselineShape(baseline);
  if (serializeIdentityBaseline(baseline) !== source) {
    throw new Error(
      `Identity baseline is not canonical; regenerate it with --update-baseline`,
    );
  }
  return baseline;
}

export function validateTextSource(path, source, baseline = null) {
  const { groups, unauthorized } = scanTextSource(path, source);
  const expectedEntries = [];
  if (baseline) {
    validateBaselineShape(baseline);
    const ids = new Set(
      TEXT_RULES.map((rule) => baselineExceptionId(rule.id, path)),
    );
    expectedEntries.push(
      ...baseline.exceptions.filter((entry) => ids.has(entry.id)),
    );
  }
  return [...unauthorized, ...compareBaselineEntries(groups, expectedEntries)];
}

async function validatePackageManifests(repositoryRoot) {
  const violations = [];
  for (const [directory, expectedName] of Object.entries(
    PRIVATE_WORKSPACE_IDENTITIES,
  )) {
    const path = `${directory}/package.json`;
    const manifest = JSON.parse(
      await readFile(resolve(repositoryRoot, path), "utf8"),
    );
    if (manifest.name !== expectedName) {
      violations.push({
        rule: "private-package-identity",
        path,
        line: 1,
        match: `${String(manifest.name)} != ${expectedName}`,
      });
    }
    if (manifest.private !== true || Object.hasOwn(manifest, "publishConfig")) {
      violations.push({
        rule: "public-publish-metadata",
        path,
        line: 1,
        match: "manifest must be private and omit publishConfig",
      });
    }
    const publicationGuard = directory.startsWith("plugins/")
      ? "node ../../../scripts/npm-publication-disabled.mjs direct-package-publish"
      : "node ../../scripts/npm-publication-disabled.mjs direct-package-publish";
    if (manifest.scripts?.prepublishOnly !== publicationGuard) {
      violations.push({
        rule: "public-publish-metadata",
        path,
        line: 1,
        match: "manifest is missing the fail-closed direct publish guard",
      });
    }
  }
  return violations;
}

async function validateCanonicalIdentity(repositoryRoot) {
  const violations = [];
  const rootManifest = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  const expectedUserAgent = `Marketingovo/${rootManifest.version}`;
  if (
    rootManifest.private !== true ||
    rootManifest.scripts?.prepublishOnly !==
      "node scripts/npm-publication-disabled.mjs direct-package-publish"
  ) {
    violations.push({
      rule: "public-publish-metadata",
      path: "package.json",
      line: 1,
      match: "workspace root must be private and reject direct publication",
    });
  }
  const limitsPath = "packages/core/src/core/limits.ts";
  const limits = await readFile(resolve(repositoryRoot, limitsPath), "utf8");
  const userAgents = [
    ...limits.matchAll(
      /export const MARKETINGOVO_DEFAULT_USER_AGENT\s*=\s*["']([^"']+)["']/gu,
    ),
  ];
  if (
    userAgents.length !== 1 ||
    userAgents[0]?.[1] !== expectedUserAgent ||
    /https?:\/\//u.test(userAgents[0]?.[1] ?? "")
  ) {
    violations.push({
      rule: "canonical-user-agent",
      path: limitsPath,
      line: 1,
      match: `expected one URL-free literal ${expectedUserAgent}`,
    });
  }

  const cliManifestPath = "packages/cli/package.json";
  const cliManifest = JSON.parse(
    await readFile(resolve(repositoryRoot, cliManifestPath), "utf8"),
  );
  // Exactly one bin. The retired golem-seo entry was never published, so it is
  // removed rather than carried as a deprecated alias.
  if (
    cliManifest.name !== "marketingovo" ||
    cliManifest.private !== true ||
    cliManifest.bin?.marketingovo !== "./dist/cli.js" ||
    Object.keys(cliManifest.bin ?? {}).length !== 1
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: cliManifestPath,
      line: 1,
      match:
        "expected private marketingovo package with exactly one canonical bin",
    });
  }

  const desktopPreparePath = "scripts/prepare-desktop-runtime.mjs";
  const desktopPrepare = await readFile(
    resolve(repositoryRoot, desktopPreparePath),
    "utf8",
  );
  if (
    !/["']--filter["']\s*,\s*["']marketingovo["']\s*,\s*["']--fail-if-no-match["']/u.test(
      desktopPrepare,
    ) ||
    desktopPrepare.includes("@marketingovo/cli")
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: desktopPreparePath,
      line: 1,
      match:
        "desktop runtime deployment must fail closed while selecting the unscoped marketingovo CLI package",
    });
  }

  const cliPath = "packages/cli/src/cli.ts";
  const cli = await readFile(resolve(repositoryRoot, cliPath), "utf8");
  const cliVersion = cli.match(/const VERSION\s*=\s*["']([^"']+)["']/u)?.[1];
  if (
    cliVersion !== rootManifest.version ||
    !cli.includes("Marketingovo ${VERSION}") ||
    cli.includes("usage: golem-seo") ||
    /process\.env\.(?:GOLEMSEO|GOLEM_SEO|SCREAMINGCLAW)_[A-Z0-9_]+\s*=/u.test(
      cli,
    )
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: cliPath,
      line: 1,
      match:
        "CLI version/help/env writes must use canonical Marketingovo identity",
    });
  }
  return violations;
}

export async function validateIdentityMigration(repositoryRoot = root) {
  validateAllowlist();
  const baseline = await readIdentityBaseline(repositoryRoot);
  const scan = await scanRepositoryText(repositoryRoot);
  const violations = [
    ...scan.unauthorized,
    ...validateAllowlistCoverage(scan.usedAuthorizations),
    ...compareBaselineEntries(scan.groups, baseline.exceptions),
  ];
  violations.push(...(await validatePackageManifests(repositoryRoot)));
  violations.push(...(await validateCanonicalIdentity(repositoryRoot)));
  throwIdentityViolations(violations);
  return {
    scannedFiles: scan.scannedFiles,
    allowlistEntries: IDENTITY_ALLOWLIST.length,
    baselineEntries: baseline.exceptions.length,
    exceptionOccurrences: baseline.exceptions.reduce(
      (total, entry) => total + entry.count,
      0,
    ),
  };
}

async function scanRepositoryText(repositoryRoot) {
  const files = trackedFiles(repositoryRoot);
  const groups = new Map();
  const unauthorized = [];
  const usedAuthorizations = new Set();
  for (const path of files) {
    const absolute = resolve(repositoryRoot, path);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile() || info.size > 8 * 1024 * 1024) continue;
    const bytes = await readFile(absolute);
    if (bytes.includes(0)) continue;
    const result = scanTextSource(path, bytes.toString("utf8"));
    unauthorized.push(...result.unauthorized);
    for (const [id, group] of result.groups) {
      groups.set(id, group);
      usedAuthorizations.add(authorizationId(group.authorization));
    }
  }
  return {
    scannedFiles: files.length,
    groups,
    unauthorized,
    usedAuthorizations,
  };
}

function validateAllowlistCoverage(usedAuthorizations) {
  return IDENTITY_ALLOWLIST.flatMap((entry) =>
    usedAuthorizations.has(authorizationId(entry))
      ? []
      : [
          {
            rule: "identity-allowlist-unused",
            path: redactBaselineHint(entry.path),
            line: 1,
            match: `${BASELINE_RULE_LABELS[entry.rule]} authorization has no pinned occurrences`,
          },
        ],
  );
}

function throwIdentityViolations(violations) {
  if (violations.length > 0) {
    const report = violations
      .map(
        ({ rule, path, line, match }) =>
          `${path}:${line} [${rule}] ${JSON.stringify(match)}`,
      )
      .join("\n");
    throw new Error(`Identity migration policy failed:\n${report}`);
  }
}

export async function createIdentityBaseline(repositoryRoot = root) {
  validateAllowlist();
  const scan = await scanRepositoryText(repositoryRoot);
  const violations = [
    ...scan.unauthorized,
    ...validateAllowlistCoverage(scan.usedAuthorizations),
  ];
  violations.push(...(await validatePackageManifests(repositoryRoot)));
  violations.push(...(await validateCanonicalIdentity(repositoryRoot)));
  throwIdentityViolations(violations);

  const baseline = canonicalBaseline({
    schemaVersion: BASELINE_SCHEMA_VERSION,
    fingerprintAlgorithm: BASELINE_FINGERPRINT_ALGORITHM,
    exceptions: [...scan.groups.values()].map(baselineEntry),
  });
  validateBaselineShape(baseline);
  return {
    baseline,
    scannedFiles: scan.scannedFiles,
    allowlistEntries: IDENTITY_ALLOWLIST.length,
    baselineEntries: baseline.exceptions.length,
    exceptionOccurrences: baseline.exceptions.reduce(
      (total, entry) => total + entry.count,
      0,
    ),
  };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--update-baseline") {
    const result = await createIdentityBaseline(root);
    await writeFile(
      resolve(root, IDENTITY_BASELINE_PATH),
      serializeIdentityBaseline(result.baseline),
      "utf8",
    );
    await validateIdentityMigration(root);
    process.stdout.write(
      `Updated identity baseline with ${result.baselineEntries} rule/file exceptions and ${result.exceptionOccurrences} pinned occurrences across ${result.scannedFiles} files.\n`,
    );
  } else if (args.length === 0) {
    const result = await validateIdentityMigration(root);
    process.stdout.write(
      `Identity migration policy passed for ${result.scannedFiles} files with ${result.allowlistEntries} reasoned owners, ${result.baselineEntries} exact rule/file exceptions, and ${result.exceptionOccurrences} pinned occurrences.\n`,
    );
  } else {
    throw new Error(
      "Usage: node scripts/identity-migration-policy.mjs [--update-baseline]",
    );
  }
}

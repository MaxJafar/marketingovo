import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_WORKSPACE_IDENTITIES } from "./npm-release-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const IDENTITY_BASELINE_PATH = "scripts/identity-migration-baseline.json";
const BASELINE_SCHEMA_VERSION = 1;
const BASELINE_FINGERPRINT_ALGORITHM =
  "sha256(rule,path,matched-line-content)-multiset-v1";

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

export const IDENTITY_ALLOWLIST = Object.freeze([
  {
    rule: "legacy-product-identity",
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must name the old-brand patterns and every reasoned exception in order to prevent unreviewed additions.",
  },
  {
    rule: "legacy-product-identity",
    path: "apps/dashboard/",
    reason:
      "Dashboard identity and hosted-upsell removal belong to the Stage 3 UI slice; generated and source assets migrate together.",
  },
  {
    rule: "legacy-product-identity",
    path: "apps/docs/",
    reason:
      "Documentation identity is owned by the staged documentation migration and must not be partially rewritten in foundation code.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/cli/dashboard/",
    reason:
      "Bundled dashboard files are generated Stage 3 UI output and must be regenerated instead of hand-edited in this slice.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/sdk/src/generated/openapi.ts",
    reason:
      "This deterministic OpenAPI projection may retain compatibility names and is never hand-edited; final reconciliation belongs to integration.",
  },
  ...[
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/release.yml",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Repository administration and release artifact names remain frozen behind the explicit human repository/public-release gate.",
  })),
  {
    rule: "legacy-product-identity",
    path: "benchmarks/run.mjs",
    reason:
      "The benchmark retains a legacy environment fixture to measure compatibility behavior, not active product identity.",
  },
  {
    rule: "legacy-product-identity",
    path: "e2e/community.spec.ts",
    reason:
      "End-to-end assertions cover persisted compatibility paths plus Stage 3 UI copy that must migrate atomically.",
  },
  {
    rule: "legacy-product-identity",
    path: "migrations/legacy-v0/plugin.json",
    reason:
      "This immutable fixture represents a legacy plugin accepted only as a tested migration input.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/core/tests/fetcher.test.ts",
    reason:
      "The test-only user-agent fixture verifies arbitrary caller input and is not AGENTseo's canonical default user agent.",
  },
  ...[
    "packages/legacy-import/src/index.test.ts",
    "packages/legacy-import/src/index.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Legacy names, paths, and environment variables are intentionally accepted here only as tested migration inputs.",
  })),
  ...[
    "packages/storage-sqlite/src/backup.test.ts",
    "packages/storage-sqlite/src/database.test.ts",
    "packages/storage-sqlite/src/issue-adjudication.test.ts",
    "packages/storage-sqlite/src/project-context.test.ts",
    "packages/storage-sqlite/src/project-deletion.test.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Data-layer tests pin the existing golem-seo.db filename so the independence migration never strands persisted SQLite state.",
  })),
  {
    rule: "legacy-product-identity",
    path: "packages/storage-sqlite/src/database.ts",
    reason:
      "The persisted .golemseo project-bundle media type remains an accepted 1.x wire value so existing exports stay importable.",
  },
  {
    rule: "legacy-product-identity",
    path: "plugins/codex/golem-seo/.codex-plugin/plugin.json",
    reason:
      "Legacy plugin display/publisher metadata remains with the Stage 3 atomic agent-surface and human release-identity gates.",
  },
  {
    rule: "legacy-product-identity",
    path: "pnpm-lock.yaml",
    reason:
      "The deterministic lockfile retains only the legacy plugin workspace directory path, while all package coordinates use frozen private identities.",
  },
  ...[
    "adapters/openclaw/openclaw.plugin.json",
    "adapters/openclaw/scripts/validate.mjs",
    "adapters/openclaw/src/index.ts",
    "packages/mcp/package.json",
    "packages/mcp/src/compatibility.test.ts",
    "packages/mcp/src/compatibility.ts",
    "packages/mcp/src/index.test.ts",
    "packages/mcp/src/index.ts",
    "packages/mcp/src/stdio.ts",
    "packages/sdk/src/generated-client.ts",
    "packages/sdk/src/index.test.ts",
    "packages/sdk/src/index.ts",
    "packages/sdk/src/local-api.ts",
    "plugins/codex/golem-seo/.mcp.json",
    "plugins/codex/golem-seo/package.json",
    "plugins/codex/golem-seo/scripts/build.mjs",
    "plugins/codex/golem-seo/scripts/validate.mjs",
    "scripts/validate-plugins.mjs",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "The public agent/SDK identifier remains a tested 1.x compatibility surface until Stage 3 migrates every consumer atomically.",
  })),
  ...[
    "packages/cli/package.json",
    "packages/cli/src/cli.ts",
    "packages/cli/src/compatibility.test.ts",
    "packages/cli/src/compatibility.ts",
    "packages/cli/src/index.ts",
    "packages/cli/src/local-service.ts",
    "packages/cli/src/service-definition.test.ts",
    "packages/cli/src/service-definition.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "CLI legacy executable, environment, database, SDK symbol, and OS-service identifiers are warned migration aliases through 1.x.",
  })),
  {
    rule: "legacy-product-identity",
    path: "packages/contracts/src/index.ts",
    reason:
      "GolemSeoRuntime is an exact deprecated type alias for AgentSeoRuntime through 1.x so downstream TypeScript consumers keep compiling.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/runtime/src/index.ts",
    reason:
      "GolemLocalRuntime is an exact deprecated AgentSeoLocalRuntime alias through 1.x; frozen data roots, DB names, and .golemseo bundles also remain readable.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/runtime/src/runtime-identity.test.ts",
    reason:
      "This regression test proves canonical and deprecated runtime constructor/type aliases are exactly identical through 1.x.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/server/src/index.ts",
    reason:
      "Canonical session/client/CSRF identity takes precedence while golem_session, x-golem-client, and x-golem-csrf remain exact 1.x aliases; .golemseo wire identity stays frozen.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/server/src/index.test.ts",
    reason:
      "Tests prove canonical-first session/client/CSRF behavior and exact legacy aliases while preserving DB and dashboard fixture compatibility.",
  },
  ...[
    "packages/server/src/action-workbench-api.test.ts",
    "packages/server/src/dashboard-control.test.ts",
    "packages/server/src/extraction-rules-api.test.ts",
    "packages/server/src/issue-review-api.test.ts",
    "packages/server/src/link-explorer-api.test.ts",
    "packages/server/src/project-context-api.test.ts",
    "packages/server/src/project-deletion-api.test.ts",
    "packages/server/src/run-comparison-api.test.ts",
    "packages/server/src/run-evidence-api.test.ts",
    "packages/server/src/run-replay-api.test.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "API tests exercise the exact x-golem-client 1.x compatibility header while canonical x-agentseo-client remains primary.",
  })),
  {
    rule: "legacy-product-identity",
    path: "packages/core/src/integrations/notify.ts",
    reason:
      "Canonical AGENTseo webhook headers are primary while exact x-golemseo event, timestamp, and signature aliases remain through 1.x.",
  },
  {
    rule: "legacy-product-identity",
    path: "packages/core/tests/notify.test.ts",
    reason:
      "Tests prove canonical-first webhook/environment behavior and exact value parity for the deprecated x-golemseo header aliases.",
  },
  ...[
    "packages/contracts/src/project-bundle.ts",
    "packages/core/src/core/store.ts",
    "packages/credentials/src/index.ts",
    "packages/runtime/src/durable-work.test.ts",
    "packages/runtime/src/index.test.ts",
    "packages/runtime/src/project-bundle.test.ts",
    "packages/runtime/src/secret-boundary.test.ts",
    "packages/server/src/e2e.test.ts",
    "scripts/validate-contracts.mjs",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Persisted database names, .golemseo bundles, report filenames, exported symbols, and wire contracts stay readable through 1.x.",
  })),
  ...[
    "packages/core/src/env.ts",
    "packages/core/tests/audit-full-cli.test.ts",
    "packages/core/tests/audit-full-integration.test.ts",
    "packages/core/tests/audit-full.test.ts",
    "packages/core/tests/change-detection.test.ts",
    "packages/core/tests/env.test.ts",
    "packages/core/tests/html-csv.test.ts",
    "packages/core/tests/lighthouse.test.ts",
    "packages/core/tests/limits.test.ts",
    "packages/core/tests/orchestrator-credentials.test.ts",
    "packages/core/tests/plugin-tools.test.ts",
    "packages/core/tests/private-policy.test.ts",
    "packages/core/tests/psi.test.ts",
    "packages/core/tests/watch.test.ts",
    "packages/credentials/src/native-broker.test.ts",
    "packages/runtime/src/google-oauth-env.test.ts",
    "packages/runtime/src/google-oauth-env.ts",
    "packages/server/src/google-oauth.ts",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Canonical AGENTSEO variables take precedence while value-safe tests preserve GOLEMSEO, GOLEM_SEO, and applicable historical aliases.",
  })),
  ...[
    "apps/desktop/scripts/validate.mjs",
    "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/src/bin/verify-updater-signature.rs",
    "apps/desktop/src-tauri/src/lib.rs",
    "apps/desktop/src-tauri/tauri.conf.json",
    "packages/credential-broker-native/Cargo.toml",
    "packages/credential-broker-native/src/main.rs",
    "scripts/configure-desktop-release.mjs",
    "scripts/copy-native-broker.mjs",
    "scripts/create-release-manifest.mjs",
    "scripts/desktop-runtime-config.mjs",
    "scripts/generate-sbom.mjs",
    "scripts/prepare-desktop-runtime.mjs",
    "scripts/prepare-upgrade-baseline.mjs",
    "scripts/release-policy.mjs",
    "scripts/release-policy.test.mjs",
    "scripts/updater-metadata-policy.mjs",
    "scripts/updater-metadata-policy.test.mjs",
    "scripts/verify-desktop-runtime.mjs",
    "scripts/verify-release-artifacts.mjs",
    "scripts/verify-unix-installer-lifecycle.mjs",
  ].map((path) => ({
    rule: "legacy-product-identity",
    path,
    reason:
      "Legacy desktop artifact, updater, signing, service, and publisher identifiers remain frozen behind separate human release gates.",
  })),
  ...["scripts/npm-release-policy.mjs", "scripts/package-smoke.mjs"].map(
    (path) => ({
      rule: "legacy-product-identity",
      path,
      reason:
        "Historical artifact labels and compatibility env aliases remain inspectable while the explicit npm publication gate stays closed.",
    }),
  ),
  {
    rule: "golemworkers-coupling",
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must name the forbidden legacy coupling pattern and its reasoned exceptions in policy data.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/identity-migration-policy.test.mjs",
    reason:
      "The sentinel regression test asserts the named coupling rule after constructing a forbidden sample dynamically.",
  },
  {
    rule: "legacy-agent-contract",
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must name the frozen Stage 3 agent-contract pattern in order to detect new occurrences.",
  },
  {
    rule: "legacy-cli-alias",
    path: "scripts/identity-migration-policy.mjs",
    reason:
      "The sentinel must encode the exact warned legacy executable pattern that is permitted through 1.x.",
  },
  {
    rule: "golemworkers-coupling",
    path: ".github/ISSUE_TEMPLATE/config.yml",
    reason:
      "Existing repository support links remain frozen until a human approves replacement domains and repository ownership.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/components/edition-cards.tsx",
    reason:
      "Known UI upsell removal belongs to the Stage 3 interface slice; the foundation slice must not make partial UI edits.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/components/golemworkers-link-card.tsx",
    reason:
      "Known hosted-link UI removal belongs to the Stage 3 interface slice and is tracked as an explicit migration blocker.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/pages/integrations.tsx",
    reason:
      "Known hosted-link UI composition belongs to the Stage 3 interface slice and cannot be removed independently here.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/tests/api-client.test.ts",
    reason:
      "Existing hosted Problem Details fixture remains with its Stage 3 UI/API contract cleanup owner.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/tests/golemworkers-link-card.test.tsx",
    reason:
      "Tests document the hosted-link UI that Stage 3 removes atomically with its implementation.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/dashboard/src/tests/integrations-page.test.tsx",
    reason:
      "Tests document the hosted-link UI composition that Stage 3 removes atomically.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/cli/dashboard/",
    reason:
      "Generated dashboard assets mirror the Stage 3 UI and must be regenerated by that owner rather than hand-edited.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/desktop/scripts/validate.mjs",
    reason:
      "Legacy desktop publisher and reverse-domain checks remain frozen until the human-controlled release identity gate opens.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/desktop/src-tauri/Cargo.toml",
    reason:
      "Legacy author metadata remains frozen because legal and publisher identity are outside this migration slice.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/desktop/src-tauri/tauri.conf.json",
    reason:
      "Legacy desktop signing, updater, domain, and publisher identifiers require separate human release approval.",
  },
  {
    rule: "golemworkers-coupling",
    path: "apps/docs/scripts/validate.mjs",
    reason:
      "The existing repository link checker remains until repository ownership is explicitly approved and migrated.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/cli/src/cli.ts",
    reason:
      "Legacy launchd service identifiers are accepted migration aliases through 1.x and cannot be renamed without service migration.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/cli/src/service-definition.ts",
    reason:
      "Legacy OS service identifiers are compatibility inputs through 1.x and need a tested service migration before replacement.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/cli/src/service-definition.test.ts",
    reason:
      "Tests pin the legacy OS service compatibility identifiers that remain supported through 1.x.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/credential-broker-native/Cargo.toml",
    reason:
      "Legacy author metadata is a legal and publisher identity concern outside this foundation slice.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/credential-broker-native/src/main.rs",
    reason:
      "The native keychain service identifier is persisted compatibility state and needs a dedicated credential migration.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/core/tests/audit-full-integration.test.ts",
    reason:
      "Historical test commentary records the replaced reference fixture and has no runtime coupling.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/core/tests/paa.test.ts",
    reason:
      "Search-result fixture text intentionally exercises arbitrary third-party query terms and has no runtime coupling.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/sdk/src/index.ts",
    reason:
      "The hosted SDK surface is an explicit Stage 3 interface blocker and must migrate atomically with generated contracts.",
  },
  {
    rule: "golemworkers-coupling",
    path: "packages/server/src/index.test.ts",
    reason:
      "A negative regression assertion intentionally names the removed hosted route to prove it is absent.",
  },
  {
    rule: "golemworkers-coupling",
    path: "plugins/codex/golem-seo/.codex-plugin/plugin.json",
    reason:
      "Legacy plugin publisher metadata belongs to the Stage 3 agent-surface migration and human release identity gate.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/npm-release-policy.mjs",
    reason:
      "The old repository coordinate validates historical artifacts only; npm publication is unconditionally disabled.",
  },
  {
    rule: "legacy-package-scope",
    path: "scripts/npm-release-policy.mjs",
    reason:
      "The private-package policy must name all forbidden collision-prone legacy scopes so it can reject them.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/release-policy.mjs",
    reason:
      "Legacy release artifact verification remains frozen until repository ownership and public release are approved.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/updater-metadata-policy.test.mjs",
    reason:
      "Tests pin legacy updater artifacts while updater identity remains a separate human-controlled release gate.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/validate-contracts.mjs",
    reason:
      "A negative contract assertion intentionally names the legacy hosted route prefix to prove OpenAPI no longer exposes it.",
  },
  {
    rule: "golemworkers-coupling",
    path: "scripts/verify-unix-installer-lifecycle.mjs",
    reason:
      "Installer verification retains the legacy launchd identifier until a dedicated service migration is implemented.",
  },
  ...[
    "adapters/openclaw/openclaw.plugin.json",
    "packages/contracts/src/agent-tools.test.ts",
    "packages/contracts/src/agent-tools.ts",
    "packages/mcp/package.json",
    "packages/mcp/src/index.test.ts",
    "packages/mcp/src/index.ts",
    "packages/mcp/src/stdio.ts",
    "plugins/codex/golem-seo/.mcp.json",
    "plugins/codex/golem-seo/package.json",
    "plugins/codex/golem-seo/scripts/build.mjs",
    "plugins/codex/golem-seo/scripts/validate.mjs",
  ].map((path) => ({
    rule: "legacy-agent-contract",
    path,
    reason:
      "The exact-six MCP tool/resource contract remains unchanged until Stage 3 can migrate every agent surface atomically.",
  })),
  {
    rule: "legacy-cli-alias",
    path: "packages/cli/package.json",
    reason:
      "The warned golem-seo executable alias remains available through 1.x without publishing a legacy package.",
  },
  {
    rule: "legacy-cli-alias",
    path: "packages/cli/src/compatibility.test.ts",
    reason:
      "Tests prove the old executable alias warns and points users to the canonical agentseo command.",
  },
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
    pattern: /@(?:golem-seo|agent-seo|agentseo)\//giu,
    sourceOnly: true,
  },
  {
    id: "golemworkers-coupling",
    pattern: /\bGolemWorkers\b|golemworkers(?:[./_-]|[A-Z])/giu,
    sourceOnly: true,
  },
  {
    id: "invented-agentseo-domain",
    pattern:
      /\b(?:https?:\/\/|mailto:)?(?:[A-Za-z0-9-]+\.)*agent-?seo(?:app)?\.[A-Za-z]{2,63}\b/giu,
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
  "golemworkers-coupling": "hosted-coupling",
  "invented-agentseo-domain": "unapproved-domain",
  "legacy-agent-contract": "legacy-agent-contract",
  "legacy-cli-alias": "legacy-cli-alias",
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

function matchedLineContent(source, index) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const nextLine = source.indexOf("\n", index);
  const lineEnd = nextLine === -1 ? source.length : nextLine;
  return source.slice(lineStart, lineEnd).replace(/\r$/u, "");
}

function scanTextSource(path, source, allowlist = IDENTITY_ALLOWLIST) {
  const unauthorized = [];
  const groups = new Map();
  for (const rule of TEXT_RULES) {
    if (rule.sourceOnly && !SOURCE_EXTENSIONS.has(extname(path))) continue;
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
      group.occurrenceHashes.push(
        sha256(rule.id, path, match[0], matchedLineContent(source, index)),
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
  const expectedUserAgent = `AGENTseo/${rootManifest.version}`;
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
      /export const AGENTSEO_DEFAULT_USER_AGENT\s*=\s*["']([^"']+)["']/gu,
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
  if (
    cliManifest.name !== "agentseo" ||
    cliManifest.private !== true ||
    cliManifest.bin?.agentseo !== "./dist/cli.js" ||
    cliManifest.bin?.["golem-seo"] !== "./dist/golem-seo.js"
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: cliManifestPath,
      line: 1,
      match:
        "expected private agentseo package with canonical and warned legacy bins",
    });
  }

  const desktopPreparePath = "scripts/prepare-desktop-runtime.mjs";
  const desktopPrepare = await readFile(
    resolve(repositoryRoot, desktopPreparePath),
    "utf8",
  );
  if (
    !/["']--filter["']\s*,\s*["']agentseo["']\s*,\s*["']--fail-if-no-match["']/u.test(
      desktopPrepare,
    ) ||
    desktopPrepare.includes("@agentseoapp/cli")
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: desktopPreparePath,
      line: 1,
      match:
        "desktop runtime deployment must fail closed while selecting the unscoped agentseo CLI package",
    });
  }

  const cliPath = "packages/cli/src/cli.ts";
  const cli = await readFile(resolve(repositoryRoot, cliPath), "utf8");
  const cliVersion = cli.match(/const VERSION\s*=\s*["']([^"']+)["']/u)?.[1];
  if (
    cliVersion !== rootManifest.version ||
    !cli.includes("AGENTseo ${VERSION}") ||
    cli.includes("usage: golem-seo") ||
    /process\.env\.(?:GOLEMSEO|GOLEM_SEO|SCREAMINGCLAW)_[A-Z0-9_]+\s*=/u.test(
      cli,
    )
  ) {
    violations.push({
      rule: "canonical-cli-identity",
      path: cliPath,
      line: 1,
      match: "CLI version/help/env writes must use canonical AGENTseo identity",
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

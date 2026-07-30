import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  IDENTITY_ALLOWLIST,
  readIdentityBaseline,
  serializeIdentityBaseline,
  validateAllowlist,
  validateIdentityMigration,
  validateTextSource,
} from "./identity-migration-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const baseline = await readIdentityBaseline(root);

async function repositorySource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("every compatibility/deferred identity exception names a path and reason", () => {
  assert.doesNotThrow(() => validateAllowlist());
  assert.ok(IDENTITY_ALLOWLIST.length > 0);
  assert.throws(
    () =>
      validateAllowlist([
        { rule: "legacy", path: "src/file.ts", reason: "too vague" },
      ]),
    /specific reason/u,
  );
});

test("the sentinel rejects forbidden package scopes and invented domains", () => {
  assert.deepEqual(
    validateTextSource(
      "packages/example/src/index.ts",
      `import x from "@golem-${"seo"}/core";\nconst url = "https://agent${"seo"}.example";\n`,
    ).map(({ rule }) => rule),
    [
      "legacy-product-identity",
      "legacy-package-scope",
      // The fixture's hostname is itself a retired identity, so the widened
      // camelCase-aware rule fires on it too.
      "retired-agentseo-identity",
      "invented-marketingovo-domain",
    ],
  );
});

test("the sentinel rejects new legacy hosted coupling", () => {
  const violations = validateTextSource(
    "packages/example/src/index.ts",
    `fetch("/${"golem"}workers/device/start");\n`,
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "former-affiliation");
});

test("the sentinel rejects old product identity outside a reasoned path", () => {
  const oldDisplayName = `${"Golem"} SEO`;
  const violations = validateTextSource(
    "packages/example/src/display.ts",
    `export const displayName = ${JSON.stringify(oldDisplayName)};\n`,
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "legacy-product-identity");
});

test("a reasoned compatibility owner passes only with its pinned contents", async () => {
  const path = "packages/core/src/env.ts";
  const source = await repositorySource(path);
  assert.deepEqual(validateTextSource(path, source, baseline), []);

  const oldEnvironmentName = `${"GOLEM"}SEO_WEBHOOK_URL`;
  const changed = `${source}\nconst extraAlias = ${JSON.stringify(oldEnvironmentName)};\n`;
  assert.equal(
    validateTextSource(path, changed, baseline)[0]?.rule,
    "identity-baseline-mismatch",
  );
});

test("a pinned exception cannot move elsewhere in the same file", async () => {
  const path = "packages/core/src/env.ts";
  const lines = (await repositorySource(path)).split("\n");
  const oldEnvironmentName = `${"GOLEM"}SEO_`;
  const originalLine = lines.findIndex((line) =>
    line.includes(oldEnvironmentName),
  );
  const destinationLine = lines.findIndex(
    (line, index) => index > originalLine + 2 && line.trim() === "",
  );
  assert.notEqual(originalLine, -1);
  assert.notEqual(destinationLine, -1);
  [lines[originalLine], lines[destinationLine]] = [
    lines[destinationLine],
    lines[originalLine],
  ];

  assert.equal(
    validateTextSource(path, lines.join("\n"), baseline)[0]?.rule,
    "identity-baseline-mismatch",
  );
});

test("identity rules cover relevant implementation text surfaces", () => {
  const oldDisplayName = `${"Golem"} SEO`;
  for (const path of [
    "packages/example/README.md",
    "apps/example/index.html",
    "scripts/example.sh",
    "plugins/example/NOTICE.txt",
  ]) {
    assert.equal(
      validateTextSource(path, oldDisplayName)[0]?.rule,
      "legacy-product-identity",
      path,
    );
  }
});

test("identity rules preserve top-level source config coverage", () => {
  const oldDisplayName = `${"Golem"} SEO`;
  assert.equal(
    validateTextSource(
      "playwright.config.ts",
      `export const displayName = ${JSON.stringify(oldDisplayName)};\n`,
    )[0]?.rule,
    "legacy-product-identity",
  );
});

test("legacy protocol headers remain confined to their pinned compatibility owner", async () => {
  const oldHeader = `x-${"golem"}-client`;
  const source = `const legacyHeader = ${JSON.stringify(oldHeader)};\n`;
  assert.equal(
    validateTextSource("packages/example/src/server.ts", source)[0]?.rule,
    "legacy-product-identity",
  );
  assert.equal(
    validateTextSource("packages/server/src/index.ts", source, baseline)[0]
      ?.rule,
    "identity-baseline-mismatch",
  );

  const ownerPath = "packages/server/src/index.ts";
  assert.deepEqual(
    validateTextSource(ownerPath, await repositorySource(ownerPath), baseline),
    [],
  );
});

test("an extra old log prefix fails inside an already pinned store file", async () => {
  const path = "packages/core/src/core/store.ts";
  const source = await repositorySource(path);
  assert.deepEqual(validateTextSource(path, source, baseline), []);

  const oldLogPrefix = `[${"Golem"}SEO store]`;
  const changed = `${source}\nconsole.info(${JSON.stringify(oldLogPrefix)});\n`;
  const violations = validateTextSource(path, changed, baseline);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, "identity-baseline-mismatch");
});

test("a hosted reference now fails everywhere, including documentation", () => {
  // The project has no corporate affiliation and no paid tier, so the former
  // company name is a violation in every location rather than an authorized
  // coupling in some of them.
  const hostedPath = `/${"golem"}workers/upgrade`;
  for (const path of [
    "apps/docs/site/product/new-hosted-link.md",
    "packages/core/src/new-hosted-link.ts",
    "launch/new-hosted-post.md",
  ]) {
    const violations = validateTextSource(
      path,
      `export const upgradePath = ${JSON.stringify(hostedPath)};\n`,
      baseline,
    );
    assert.equal(violations.length, 1, path);
    assert.equal(violations[0]?.rule, "former-affiliation", path);
  }
});

test("the machine-readable baseline is canonical and contains no forbidden text", async () => {
  const path = "scripts/identity-migration-baseline.json";
  const source = await repositorySource(path);
  assert.equal(source, serializeIdentityBaseline(baseline));
  assert.deepEqual(validateTextSource(path, source, baseline), []);
});

test("the checked-in repository satisfies the identity migration sentinel", async () => {
  const result = await validateIdentityMigration(root);
  assert.ok(result.scannedFiles > 100);
});

// Data integrity verification (T-031).
//
// Sprint 2 refactors the internal architecture (modules, loader,
// plugin-tools regen, src/core/ move) but MUST NOT change the
// public data contracts that operator scripts, dashboards, and
// downstream agents depend on:
//   - All Issue IDs produced by the 17+ check categories.
//   - All category names.
//   - Leaf-module and workflow discovery remain disjoint.
//
// This test is the canonical "did the refactor leak any data-shape
// changes?" gate. If a check file accidentally renames an Issue ID
// or a category, this test fails with a list of the diff so the
// developer can decide whether the change is intentional (and add
// the new id to the pinned list) or a regression (and revert).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadModules } from "../src/modules/loader.js";

const REPO = resolve(import.meta.dirname, "..");
const CHECKS_DIR = join(REPO, "src/checks");

// The pinned contract. Update only with explicit intent — e.g. when
// retiring an issue or adding a new one. Keep sorted for diff
// stability.
const PINNED_ISSUE_IDS = [
  "canonical-broken",
  "canonical-missing",
  "check-failed",
  "content-duplicate-body",
  "content-near-duplicate-body",
  "content-no-images",
  "content-readability-hard",
  "content-thin",
  "content-very-thin",
  "duplicate-dom-id",
  "excessive-click-depth",
  "h1-missing",
  "h1-multiple",
  "heavy-nofollow-external",
  "hreflang-html-lang-mismatch",
  "hreflang-lang-mismatch",
  "hreflang-no-reciprocal",
  "hreflang-relative-url",
  "hreflang-self-reference-missing",
  "hreflang-target-missing",
  "hreflang-x-default-missing",
  "image-alt-missing",
  "image-dimensions-missing",
  "internal-4xx",
  "internal-5xx",
  "internal-link-to-broken",
  "internal-link-to-redirect",
  "internal-no-response",
  "internal-redirect-chain",
  "internal-redirect-loop",
  "jsonld-parse-error",
  "large-dom",
  "low-inlink-discoverability",
  "meta-description-duplicate",
  "meta-description-missing",
  "meta-description-over-155-chars",
  "mixed-content",
  "no-outbound-internal",
  "noimageindex",
  "noindex",
  "nosnippet",
  "orphan-page",
  "picture-img-fallback-missing",
  "sitemap-4xx",
  "sitemap-missing",
  "soft-404",
  "title-duplicate",
  "title-missing",
  "title-near-duplicate",
  "title-over-60-chars",
  "top-linked-to",
  "viewport-missing-or-empty",
  "vitals-cls-needs-improvement",
  "vitals-cls-poor",
  "vitals-fcp-slow",
  "vitals-lcp-needs-improvement",
  "vitals-lcp-poor",
  "vitals-ttfb-slow",
  // header-missing-* is dynamic (one id per missing header name);
  // the test below pins its prefix.
] as const;

const PINNED_CATEGORIES = [
  "Canonicals",
  "Content Quality",
  "Directives",
  "H1",
  "Hreflang",
  "Images",
  "Internal",
  "Link Analysis",
  "Links",
  "Markup",
  "Meta Description",
  "Mobile",
  "Page Titles",
  "Performance",
  "Response Codes",
  "Security",
  "Sitemaps",
  "Structured Data",
] as const;

function listCheckFiles(): string[] {
  return readdirSync(CHECKS_DIR)
    .filter(
      (f) =>
        f.endsWith(".ts") &&
        statSync(join(CHECKS_DIR, f)).isFile() &&
        f !== "custom-rules.ts",
    )
    .map((f) => join(CHECKS_DIR, f));
}

function extractIds(files: string[]): Set<string> {
  const out = new Set<string>();
  // Match `id: "..."` or `id: '...'` — double- or single-quoted
  // string literals only. Template literals (backticks) are
  // intentionally excluded: their contents are runtime-interpolated
  // (e.g. `id: \`custom-${rule.id}\``) and not part of the
  // pinned contract.
  const idRe = /id:\s*(?:"([^"]+)"|'([^']+)')/g;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(text)) !== null) {
      out.add(m[1] ?? m[2] ?? "");
    }
  }
  return out;
}

function extractCategories(files: string[]): Set<string> {
  const out = new Set<string>();
  const catRe = /category:\s*(?:"([^"]+)"|'([^']+)')/g;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    while ((m = catRe.exec(text)) !== null) {
      out.add(m[1] ?? m[2] ?? "");
    }
  }
  return out;
}

describe("data integrity (T-031)", () => {
  const files = listCheckFiles();
  const actualIds = extractIds(files);
  const actualCategories = extractCategories(files);

  it("extracts issue IDs from at least 16 check files", () => {
    expect(files.length).toBeGreaterThanOrEqual(16);
    expect(actualIds.size).toBeGreaterThan(0);
  });

  it("no issue id was accidentally removed (all pinned ids still present)", () => {
    for (const id of PINNED_ISSUE_IDS) {
      expect(actualIds.has(id), `issue id removed: ${id}`).toBe(true);
    }
  });

  it("no new issue id was introduced without being added to the pinned list", () => {
    const pinned = new Set(PINNED_ISSUE_IDS);
    const introduced: string[] = [];
    for (const id of actualIds) {
      // Accept header-missing-* (dynamic per missing header) and
      // check-failed (sentinel emitted by the orchestrator on
      // per-check exceptions).
      if (id.startsWith("header-missing-")) continue;
      if (!pinned.has(id)) introduced.push(id);
    }
    expect(
      introduced,
      `new issue ids detected: ${introduced.join(", ")}`,
    ).toEqual([]);
  });

  it("no category was removed", () => {
    for (const c of PINNED_CATEGORIES) {
      expect(actualCategories.has(c), `category removed: ${c}`).toBe(true);
    }
  });

  it("no new category was introduced without being added to the pinned list", () => {
    const pinned = new Set(PINNED_CATEGORIES);
    const introduced: string[] = [];
    for (const c of actualCategories) {
      if (!pinned.has(c)) introduced.push(c);
    }
    expect(
      introduced,
      `new categories detected: ${introduced.join(", ")}`,
    ).toEqual([]);
  });

  it("every check file that emits issues uses an id from the pinned set (header-missing-* is template-literal in security.ts and excluded from extraction)", () => {
    // The dynamic `header-missing-${header}` id is in security.ts
    // as a template literal. The extractor intentionally skips
    // template literals, so the extracted set should equal the
    // pinned set exactly.
    const nonDynamic = [...actualIds];
    expect(nonDynamic.sort()).toEqual([...PINNED_ISSUE_IDS].sort());
  });

  it("security.ts contains the dynamic header-missing-* template-literal id", () => {
    const text = readFileSync(join(CHECKS_DIR, "security.ts"), "utf8");
    expect(text).toMatch(/id:\s*`header-missing-\$\{header\}`/);
  });

  it("module discovery finds the expected leaves and keeps audit-full in the workflow registry", async () => {
    const result = await loadModules(resolve(REPO, "src/modules"));
    expect(
      result.errors,
      `loader errors: ${JSON.stringify(result.errors, null, 2)}`,
    ).toEqual([]);
    const ids = new Set(result.modules.map((m) => m.id));
    const expected = [
      "onpage",
      "technical",
      "content-quality",
      "link-analysis",
      "performance",
      "compare",
      "integrations:gsc",
      "integrations:ga4",
      "integrations:trends",
      "integrations:psi",
      "integrations:keyword-research",
      "integrations:change-detection",
      "integrations:topic-clusters",
    ];
    for (const id of expected) {
      expect(ids.has(id), `module missing: ${id}`).toBe(true);
    }
    expect(ids.has("audit-full")).toBe(false);
    expect(result.workflows.map((workflow) => workflow.id)).toContain(
      "audit-full",
    );
  });
});

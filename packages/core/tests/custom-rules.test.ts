import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadCustomRules,
  makeCustomRulesCheck,
  type CustomRule,
} from "../src/checks/custom-rules.js";
import {
  CUSTOM_RULE_REGEX_LIMITS,
  limitCustomRuleRegexInput,
  validateCustomRuleRegex,
} from "../src/custom-rule-regex.js";
import { runAllChecks } from "../src/checks/index-all.js";
import type { CrawledPage, CrawlIndex } from "../src/checks/index.js";
import { parsePage } from "../src/parser.js";

function makePage(
  url: string,
  status: number,
  html: string,
  rawHtml?: string,
): CrawledPage {
  return {
    url,
    finalUrl: url,
    status,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: [],
    headers: {},
    parsed: parsePage(html, url),
    rawHtml: rawHtml ?? html,
    error: null,
    fetchDurationMs: 1,
    extractions: [],
    vitals: null,
  };
}

function indexOf(pages: CrawledPage[]): CrawlIndex {
  const m = new Map<string, CrawledPage>();
  for (const p of pages) m.set(p.url, p);
  return {
    pages: m,
    startUrl: pages[0]?.url ?? "",
    robots: new Map(),
    finishedAt: new Date().toISOString(),
    durationMs: 1,
    config: {
      maxUrls: 100,
      maxRuntimeMs: 60_000,
      maxConcurrency: 4,
      requestsPerSecond: 5,
      requestTimeoutMs: 15_000,
      maxBodyBytes: 5_242_880,
      maxRedirects: 5,
      userAgent: "test",
      allowPrivate: false,
      ignoreRobots: false,
      customHeaders: {},
      renderMode: "static",
      keepRawHtml: true,
    },
  };
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "screaming-claw-rules-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("custom-rules: loader", () => {
  it("returns [] when custom-rules.json does not exist", () => {
    expect(loadCustomRules(tmpDir)).toEqual([]);
  });

  it("parses a valid rule file", () => {
    const rule: CustomRule = {
      id: "legal-mention",
      name: "Legal notice on every page",
      category: "Compliance",
      priority: "High",
      match: "contains",
      value: "Legal Notice",
    };
    writeFileSync(
      join(tmpDir, "custom-rules.json"),
      JSON.stringify({ rules: [rule] }),
    );
    const loaded = loadCustomRules(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("legal-mention");
  });

  it("rejects invalid rules silently", () => {
    const bad = {
      rules: [
        { id: "no-name", category: "x", priority: "High", match: "contains" },
        {
          id: "bad-priority",
          name: "x",
          category: "x",
          priority: "Wrong",
          match: "contains",
        },
        {
          id: "bad-match",
          name: "x",
          category: "x",
          priority: "High",
          match: "sql",
        },
        {
          id: "missing-value",
          name: "x",
          category: "x",
          priority: "High",
          match: "contains",
        },
      ],
    };
    writeFileSync(join(tmpDir, "custom-rules.json"), JSON.stringify(bad));
    expect(loadCustomRules(tmpDir)).toEqual([]);
  });

  it("dedupes by id, first wins", () => {
    const rule: CustomRule = {
      id: "dup",
      name: "First",
      category: "x",
      priority: "Low",
      match: "contains",
      value: "a",
    };
    const dup: CustomRule = { ...rule, name: "Second" };
    writeFileSync(
      join(tmpDir, "custom-rules.json"),
      JSON.stringify({ rules: [rule, dup] }),
    );
    const loaded = loadCustomRules(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe("First");
  });

  it("returns [] on malformed JSON", () => {
    writeFileSync(join(tmpDir, "custom-rules.json"), "{ not json");
    expect(loadCustomRules(tmpDir)).toEqual([]);
  });

  it("rejects a nested-quantifier regex before it reaches the crawl loop", () => {
    const unsafe: CustomRule = {
      id: "redos",
      name: "Unsafe expression",
      category: "Quality",
      priority: "High",
      match: "regex",
      pattern: "(a+)+$",
    };
    writeFileSync(
      join(tmpDir, "custom-rules.json"),
      JSON.stringify({ rules: [unsafe] }),
    );

    expect(loadCustomRules(tmpDir)).toEqual([]);
  });

  it("keeps a useful bounded regular expression", () => {
    const safe: CustomRule = {
      id: "analytics-id",
      name: "Analytics identifier",
      category: "Analytics",
      priority: "Medium",
      match: "regex",
      pattern: "G-[A-Z0-9]{10}",
    };
    writeFileSync(
      join(tmpDir, "custom-rules.json"),
      JSON.stringify({ rules: [safe] }),
    );

    expect(loadCustomRules(tmpDir)).toMatchObject([{ id: "analytics-id" }]);
  });
});

describe("custom-rules: contains", () => {
  it("flags pages missing the required text", () => {
    const rule: CustomRule = {
      id: "legal-mention",
      name: "Legal notice on every page",
      category: "Compliance",
      priority: "High",
      match: "contains",
      value: "Legal Notice",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title</title></head><body><h1>A</h1><p>Some text without the required phrase.</p></body></html>`,
      ),
      makePage(
        "https://example.com/b",
        200,
        `<html><head><title>Page B title</title></head><body><h1>B</h1><p>This page has the Legal Notice link in the footer.</p></body></html>`,
      ),
    ]);
    const issues = makeCustomRulesCheck([rule])(idx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.urls).toContain("https://example.com/a");
    expect(issues[0]?.urls).not.toContain("https://example.com/b");
  });

  it("is case-insensitive", () => {
    const rule: CustomRule = {
      id: "cookie-policy",
      name: "Cookie policy link",
      category: "Compliance",
      priority: "Medium",
      match: "contains",
      value: "Cookie Policy",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/x",
        200,
        `<html><head><title>X title</title></head><body><h1>X</h1><a href="/cookies">cookie POLICY</a></body></html>`,
      ),
    ]);
    expect(makeCustomRulesCheck([rule])(idx)).toEqual([]);
  });
});

describe("custom-rules: regex", () => {
  it("flags pages missing the GA4 tracking id", () => {
    const rule: CustomRule = {
      id: "ga4-installed",
      name: "GA4 must be installed",
      category: "Analytics",
      priority: "Medium",
      match: "regex",
      pattern: "G-[A-Z0-9]{10}",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/installed",
        200,
        `<html><head><title>Installed title</title><script async src="https://www.googletagmanager.com/gtag/js?id=G-ABCDE12345"></script></head><body><h1>A</h1></body></html>`,
      ),
      makePage(
        "https://example.com/missing",
        200,
        `<html><head><title>Missing title</title></head><body><h1>B</h1><script>var x=1;</script></body></html>`,
      ),
    ]);
    const issues = makeCustomRulesCheck([rule])(idx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.urls).toEqual(["https://example.com/missing"]);
  });

  it("rejects malformed regex silently (no false positives)", () => {
    const rule: CustomRule = {
      id: "bad",
      name: "Bad regex",
      category: "x",
      priority: "Low",
      match: "regex",
      pattern: "[unterminated",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/x",
        200,
        `<html><head><title>X title</title></head><body><h1>X</h1></body></html>`,
      ),
    ]);
    expect(makeCustomRulesCheck([rule])(idx)).toEqual([]);
  });

  it("rejects unsafe directly-constructed rules before checking pages", () => {
    const rule: CustomRule = {
      id: "redos",
      name: "Unsafe expression",
      category: "Quality",
      priority: "High",
      match: "regex",
      pattern: "(a+)+$",
    };
    const adversarial = `${"a".repeat(CUSTOM_RULE_REGEX_LIMITS.maxInputLength)}!`;
    const idx = indexOf([
      makePage(
        "https://example.com/x",
        200,
        `<html><head><title>X title</title></head><body>${adversarial}</body></html>`,
      ),
    ]);

    expect(makeCustomRulesCheck([rule])(idx)).toEqual([]);
  });
});

describe("custom-rules: shared regex safety policy", () => {
  it.each([
    ["(a+)+$", "nested_quantifier"],
    ["(foo|fo+)+$", "nested_quantifier"],
    ["(foo|bar)+$", "quantified_alternation"],
    ["(a|aa){2,}$", "quantified_alternation"],
    ["^(.*)-.*$", "ambiguous_repetition"],
    ["^a+a+$", "ambiguous_repetition"],
    ["^[a-z]+[a-z]+$", "ambiguous_repetition"],
    ["^(a+)\\1$", "backreference"],
    ["foo(?=bar)", "lookaround"],
    ["a{10001}", "excessive_quantifier"],
  ])("rejects %s as %s", (pattern, code) => {
    expect(validateCustomRuleRegex(pattern)).toMatchObject({
      safe: false,
      code,
    });
  });

  it.each(["G-[A-Z0-9]{10}", "^(?:https?://)?example\\.com/$", "(cat|dog)$"])(
    "accepts useful expression %s",
    (pattern) => {
      expect(validateCustomRuleRegex(pattern)).toEqual({ safe: true });
    },
  );

  it("caps every tested content string", () => {
    const oversized = "x".repeat(CUSTOM_RULE_REGEX_LIMITS.maxInputLength + 10);
    expect(limitCustomRuleRegexInput(oversized)).toHaveLength(
      CUSTOM_RULE_REGEX_LIMITS.maxInputLength,
    );
  });

  it("caps patterns before syntax compilation", () => {
    const oversized = "a".repeat(CUSTOM_RULE_REGEX_LIMITS.maxPatternLength + 1);
    expect(validateCustomRuleRegex(oversized)).toMatchObject({
      safe: false,
      code: "pattern_too_long",
    });
  });
});

describe("custom-rules: css-exists", () => {
  it("flags pages without a footer legal link", () => {
    const rule: CustomRule = {
      id: "footer-legal",
      name: "Footer legal link",
      category: "Compliance",
      priority: "Medium",
      match: "css-exists",
      selector: "footer a[href*='/legal']",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/ok",
        200,
        `<html><head><title>OK title</title></head><body><h1>OK</h1><footer><a href="/legal-notice">Legal</a></footer></body></html>`,
      ),
      makePage(
        "https://example.com/missing",
        200,
        `<html><head><title>Missing title</title></head><body><h1>M</h1><footer><a href="/contact">Contact</a></footer></body></html>`,
      ),
    ]);
    const issues = makeCustomRulesCheck([rule])(idx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.urls).toEqual(["https://example.com/missing"]);
  });
});

describe("custom-rules: expect absent", () => {
  it("flags pages where the selector is present (inverted)", () => {
    const rule: CustomRule = {
      id: "no-debug-banner",
      name: "No debug banner on production",
      category: "Quality",
      priority: "High",
      match: "css-exists",
      selector: ".debug-banner",
      expect: "absent",
    };
    const idx = indexOf([
      makePage(
        "https://example.com/clean",
        200,
        `<html><head><title>Clean title</title></head><body><h1>C</h1></body></html>`,
      ),
      makePage(
        "https://example.com/dirty",
        200,
        `<html><head><title>Dirty title</title></head><body><h1>D</h1><div class="debug-banner">DEBUG</div></body></html>`,
      ),
    ]);
    const issues = makeCustomRulesCheck([rule])(idx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.urls).toEqual(["https://example.com/dirty"]);
  });
});

describe("custom-rules: integration with runAllChecks", () => {
  it("loads and applies rules when projectRoot has custom-rules.json", async () => {
    const rule: CustomRule = {
      id: "contact-link",
      name: "Contact link on every page",
      category: "Conversion",
      priority: "High",
      match: "contains",
      value: "Contact us",
      fix: "Add a link to /contact/ in the page header or footer.",
    };
    writeFileSync(
      join(tmpDir, "custom-rules.json"),
      JSON.stringify({ rules: [rule] }),
    );
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title</title></head><body><h1>A</h1></body></html>`,
      ),
    ]);
    const issues = await runAllChecks(idx, { projectRoot: tmpDir });
    const customIssues = issues.filter((i) => i.id === "custom-contact-link");
    expect(customIssues).toHaveLength(1);
    expect(customIssues[0]?.fix).toBe(
      "Add a link to /contact/ in the page header or footer.",
    );
  });

  it("does not load rules when projectRoot is missing the file", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title</title></head><body><h1>A</h1></body></html>`,
      ),
    ]);
    const issues = await runAllChecks(idx, { projectRoot: tmpDir });
    expect(issues.find((i) => i.id.startsWith("custom-"))).toBeUndefined();
  });
});

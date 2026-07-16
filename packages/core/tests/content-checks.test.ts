import { describe, it, expect } from "vitest";
import { runAllChecks } from "../src/checks/index-all.js";
import { contentChecks } from "../src/checks/content.js";
import type { CrawledPage, CrawlIndex } from "../src/checks/index.js";
import { parsePage } from "../src/parser.js";

function makePage(url: string, status: number, html: string): CrawledPage {
  const parsed = parsePage(html, url);
  return {
    url,
    finalUrl: url,
    status,
    contentType: "text/html",
    responseTimeMs: 1,
    bodyBytes: html.length,
    redirectChain: [],
    headers: {},
    parsed,
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
    },
  };
}

const LONG_TEXT =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum "
    .repeat(5)
    .trim();
const MEDIUM_TEXT = "lorem ipsum dolor sit amet consectetur adipiscing elit "
  .repeat(30)
  .trim();
const SHORT_TEXT = "tiny body";

describe("content checks", () => {
  it("flags very-thin and thin content", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/long",
        200,
        `<html><head><title>Long page title</title></head><body><h1>L</h1><p>${LONG_TEXT}</p></body></html>`,
      ),
      makePage(
        "https://example.com/medium",
        200,
        `<html><head><title>Medium page title</title></head><body><h1>M</h1><p>${MEDIUM_TEXT}</p></body></html>`,
      ),
      makePage(
        "https://example.com/short",
        200,
        `<html><head><title>Short page title</title></head><body><h1>S</h1><p>${SHORT_TEXT}</p></body></html>`,
      ),
    ]);
    const wordCounts = Array.from(idx.pages.values()).map(
      (p) => p.parsed?.wordCount,
    );
    console.log("very-thin/thin wordCounts:", wordCounts);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("content-very-thin");
    expect(ids).toContain("content-thin");
  });

  it("flags duplicate body content", async () => {
    const dupBody = `<p>${LONG_TEXT}</p>`;
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Page A title here</title></head><body><h1>Same</h1> ${dupBody}</body></html>`,
      ),
      makePage(
        "https://example.com/b",
        200,
        `<html><head><title>Page B title here</title></head><body><h1>Same</h1> ${dupBody}</body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "content-duplicate-body",
    );
    expect(issues.length).toBe(1);
    expect(issues[0]?.urls.length).toBe(2);
  });

  it("does not flag unique long content as duplicate", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Unique A title</title></head><body><h1>A</h1><p>${LONG_TEXT} unique words only banana pineapple</p></body></html>`,
      ),
      makePage(
        "https://example.com/b",
        200,
        `<html><head><title>Unique B title</title></head><body><h1>B</h1><p>${LONG_TEXT} totally different apple orange</p></body></html>`,
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).not.toContain("content-duplicate-body");
  });

  it("flags near-duplicate body via MinHash (long unique text with small edit)", async () => {
    // Each sentence is unique. 30 sentences = 30 * (12 words - 5) = 210 unique 5-shingles.
    const base = Array.from(
      { length: 30 },
      (_, i) =>
        `unique sentence number ${i} with several words that do not repeat anywhere else in the corpus plus a few more tokens to make five shingle windows`,
    );
    const baseText = "Same " + base.join(" ");
    // Edit only a few sentences near the end (low impact on jaccard).
    const edited = base.slice();
    edited[0] =
      "totally different opening line with no overlap whatsoever at all here please";
    const similarText = "Same " + edited.join(" ");
    const idx = indexOf([
      makePage(
        "https://example.com/a",
        200,
        `<html><head><title>Near dup A title</title></head><body><h1>A</h1> <p>${baseText}</p></body></html>`,
      ),
      makePage(
        "https://example.com/b",
        200,
        `<html><head><title>Near dup B title</title></head><body><h1>B</h1> <p>${similarText}</p></body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "content-near-duplicate-body",
    );
    if (issues.length === 0) {
      const sizes = Array.from(idx.pages.values()).map(
        (p) => p.parsed?.text.length,
      );
      console.log("text sizes:", sizes);
    }
    expect(issues.length).toBeGreaterThan(0);
  });

  it("keeps the complete near-duplicate body cohort above 200 pages", async () => {
    const pages = Array.from({ length: 225 }, (_, index) =>
      makePage(
        `https://example.com/duplicate/${index}`,
        200,
        `<html><head><title>Distinct title ${index}</title></head><body><h1>Shared</h1><p>${LONG_TEXT}</p></body></html>`,
      ),
    );
    const check = contentChecks.find(
      (candidate) => candidate.name === "nearDuplicateBody",
    );
    expect(check).toBeDefined();

    const issues = await Promise.resolve(check!(indexOf(pages)));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe("content-near-duplicate-body");
    expect(issues[0]?.urls).toHaveLength(225);
    expect(issues[0]?.urls.at(-1)).toBe("https://example.com/duplicate/224");
  });

  it("flags readability-hard on dense academic-style text", async () => {
    const dense =
      "Notwithstanding the aforementioned considerations, the implementation "
        .repeat(40)
        .trim();
    const idx = indexOf([
      makePage(
        "https://example.com/dense",
        200,
        `<html><head><title>Dense text title</title></head><body><h1>D</h1><p>${dense}</p></body></html>`,
      ),
    ]);
    const issues = (await runAllChecks(idx)).filter(
      (i) => i.id === "content-readability-hard",
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags no-images on long text-only pages", async () => {
    const idx = indexOf([
      makePage(
        "https://example.com/plain",
        200,
        `<html><head><title>Plain long page title</title></head><body><h1>P</h1><p>${LONG_TEXT}</p></body></html>`,
      ),
    ]);
    const ids = (await runAllChecks(idx)).map((i) => i.id);
    expect(ids).toContain("content-no-images");
  });
});

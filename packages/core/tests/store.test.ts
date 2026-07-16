import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore, diffResultToMarkdown } from "../src/core/store.js";
import type { CrawledPage, Issue } from "../src/checks/index.js";
import { parsePage } from "../src/parser.js";

function page(url: string, status: number, html: string): CrawledPage {
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
  };
}

function issue(id: string, urls: string[]): Issue {
  return {
    id,
    category: "Test",
    priority: "Medium",
    message: id,
    urls,
  };
}

let dir: string;
let store: ProjectStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sc-store-"));
  store = new ProjectStore({ projectRoot: dir });
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("ProjectStore", () => {
  it("creates the database and persists crawls", async () => {
    const id1 = await store.beginCrawl(
      "2026-06-04T10:00:00Z",
      "https://example.com/",
    );
    await store.savePages(id1, [
      page(
        "https://example.com/",
        200,
        "<html><head><title>A</title></head><body><h1>A</h1></body></html>",
      ),
    ]);
    await store.saveIssues(id1, [
      issue("title-missing", ["https://example.com/"]),
    ]);
    await store.finishCrawl(id1, "2026-06-04T10:00:01Z", 1, 1000);
    expect(id1).toBeGreaterThan(0);
    const crawls = await store.listCrawls();
    expect(crawls).toHaveLength(1);
    expect(crawls[0]?.pagesCrawled).toBe(1);
  });

  it("computes a diff: added, removed, statusChanged, newIssues, fixedIssues", async () => {
    const id1 = await store.beginCrawl(
      "2026-06-04T10:00:00Z",
      "https://example.com/",
    );
    await store.savePages(id1, [
      page(
        "https://example.com/a",
        200,
        "<html><head><title>A</title></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/b",
        404,
        "<html><head><title>404</title></head><body><h1>404</h1></body></html>",
      ),
    ]);
    await store.saveIssues(id1, [
      issue("title-missing", ["https://example.com/b"]),
    ]);
    await store.finishCrawl(id1, "2026-06-04T10:00:01Z", 2, 1000);

    const id2 = await store.beginCrawl(
      "2026-06-04T11:00:00Z",
      "https://example.com/",
    );
    await store.savePages(id2, [
      page(
        "https://example.com/a",
        200,
        "<html><head><title>A</title></head><body><h1>A</h1></body></html>",
      ),
      page(
        "https://example.com/b",
        200,
        "<html><head><title>B</title></head><body><h1>B</h1></body></html>",
      ),
      page(
        "https://example.com/c",
        200,
        "<html><head><title>C</title></head><body><h1>C</h1></body></html>",
      ),
    ]);
    await store.saveIssues(id2, [
      issue("title-missing", ["https://example.com/c"]),
    ]);
    await store.finishCrawl(id2, "2026-06-04T11:00:01Z", 3, 1000);

    const diff = await store.diff(id2, id1);
    expect(diff.added).toEqual(["https://example.com/c"]);
    expect(diff.removed).toEqual([]);
    expect(diff.statusChanged).toEqual([
      { url: "https://example.com/b", from: 404, to: 200 },
    ]);
    expect(diff.newIssues).toEqual([
      { url: "https://example.com/c", issueId: "title-missing" },
    ]);
    expect(diff.fixedIssues).toEqual([
      { url: "https://example.com/b", issueId: "title-missing" },
    ]);
  });

  it("diffResultToMarkdown includes sections for non-empty fields", () => {
    const md = diffResultToMarkdown({
      added: ["https://example.com/new"],
      removed: [],
      statusChanged: [{ url: "https://example.com/x", from: 404, to: 200 }],
      newIssues: [{ url: "https://example.com/new", issueId: "title-missing" }],
      fixedIssues: [{ url: "https://example.com/x", issueId: "noindex" }],
    });
    expect(md).toContain("Diff vs previous crawl");
    expect(md).toContain("Status changes");
    expect(md).toContain("New issues");
    expect(md).toContain("Fixed issues");
    expect(md).toContain("New URLs");
  });
});

import { describe, it, expect } from "vitest";
import { Frontier, ScopeGuard } from "../src/frontier.js";
import { normalizeUrl } from "../src/core/safe-url.js";

describe("ScopeGuard", () => {
  it("includes everything on the host when start is /", () => {
    const start = normalizeUrl("https://example.com/");
    const g = new ScopeGuard(start);
    expect(g.inScope("https://example.com/a")).toBe(true);
    expect(g.inScope("https://example.com/a/b/c")).toBe(true);
    expect(g.inScope("https://other.com/a")).toBe(false);
    expect(g.inScope("http://example.com/a")).toBe(false);
  });

  it("narrows to path prefix when start path is not /", () => {
    const start = normalizeUrl("https://example.com/blog/");
    const g = new ScopeGuard(start);
    expect(g.inScope("https://example.com/blog/post-1")).toBe(true);
    expect(g.inScope("https://example.com/blog/")).toBe(true);
    expect(g.inScope("https://example.com/about")).toBe(false);
  });

  it("rejects non-http(s) and malformed URLs", () => {
    const start = normalizeUrl("https://example.com/");
    const g = new ScopeGuard(start);
    expect(g.inScope("javascript:alert(1)")).toBe(false);
    expect(g.inScope("file:///etc/passwd")).toBe(false);
    expect(g.inScope("not a url")).toBe(false);
  });

  it("honors include/exclude patterns", () => {
    const start = normalizeUrl("https://example.com/");
    const g = new ScopeGuard(
      start,
      /^https:\/\/example\.com\/blog\//,
      /\.pdf$/,
    );
    expect(g.inScope("https://example.com/blog/x")).toBe(true);
    expect(g.inScope("https://example.com/about")).toBe(false);
    expect(g.inScope("https://example.com/blog/file.pdf")).toBe(false);
  });

  it("limits targeted verification to the exact URL cohort", () => {
    const start = normalizeUrl("https://example.com/products/a");
    const g = new ScopeGuard(start, undefined, undefined, [
      "https://example.com/products/a#details",
      "https://example.com/products/b",
    ]);
    expect(g.inScope("https://example.com/products/a")).toBe(true);
    expect(g.inScope("https://example.com/products/b")).toBe(true);
    expect(g.inScope("https://example.com/products/c")).toBe(false);
  });
});

describe("Frontier", () => {
  it("starts with the start URL", () => {
    const f = new Frontier({ startUrl: "https://example.com/", maxUrls: 10 });
    expect(f.visitedCount()).toBe(1);
    expect(f.size()).toBe(1);
  });

  it("deduplicates", () => {
    const f = new Frontier({ startUrl: "https://example.com/", maxUrls: 10 });
    expect(f.push("https://example.com/a", 1, null)).toBe(true);
    expect(f.push("https://example.com/a", 1, null)).toBe(false);
    expect(f.visitedCount()).toBe(2);
  });

  it("enforces maxUrls", () => {
    const f = new Frontier({ startUrl: "https://example.com/", maxUrls: 3 });
    f.push("https://example.com/a", 1, null);
    f.push("https://example.com/b", 1, null);
    expect(f.push("https://example.com/c", 1, null)).toBe(false);
    expect(f.visitedCount()).toBe(3);
  });

  it("rejects out-of-scope URLs", () => {
    const f = new Frontier({ startUrl: "https://example.com/", maxUrls: 10 });
    expect(f.push("https://other.com/x", 1, null)).toBe(false);
    expect(f.push("javascript:alert(1)", 1, null)).toBe(false);
  });

  it("returns entries FIFO", () => {
    const f = new Frontier({ startUrl: "https://example.com/", maxUrls: 10 });
    f.push("https://example.com/a", 1, null);
    f.push("https://example.com/b", 1, null);
    expect(f.next()?.url).toBe("https://example.com/");
    expect(f.next()?.url).toBe("https://example.com/a");
    expect(f.next()?.url).toBe("https://example.com/b");
    expect(f.next()).toBeNull();
  });

  it("does not enqueue discovered URLs outside an exact cohort", () => {
    const f = new Frontier({
      startUrl: "https://example.com/a",
      maxUrls: 10,
      seedUrls: ["https://example.com/b"],
      exactUrls: ["https://example.com/a", "https://example.com/b"],
    });
    expect(f.push("https://example.com/c", 1, "https://example.com/a")).toBe(
      false,
    );
    expect(f.visitedCount()).toBe(2);
  });
});

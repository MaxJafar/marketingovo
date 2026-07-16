import { describe, expect, it } from "vitest";
import { parseSitemapDocument } from "../src/checks/sitemap.js";

describe("sitemap evidence parsing", () => {
  it("distinguishes URL sets from sitemap indexes", () => {
    expect(
      parseSitemapDocument(
        "<urlset><url><loc>https://example.com/a</loc></url></urlset>",
      ),
    ).toEqual({
      kind: "urlset",
      locations: ["https://example.com/a"],
    });
    expect(
      parseSitemapDocument(
        "<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>",
      ),
    ).toEqual({
      kind: "sitemapindex",
      locations: ["https://example.com/pages.xml"],
    });
  });

  it("decodes XML URL entities without accepting arbitrary markup", () => {
    expect(
      parseSitemapDocument(
        "<urlset><url><loc>https://example.com/search?a=1&amp;b=2</loc></url></urlset>",
      ).locations,
    ).toEqual(["https://example.com/search?a=1&b=2"]);
  });

  it("marks unrelated XML as unknown", () => {
    expect(
      parseSitemapDocument("<feed><loc>https://example.com/</loc></feed>"),
    ).toMatchObject({ kind: "unknown" });
  });
});

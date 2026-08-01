import { describe, expect, it } from "vitest";
import {
  buildTargetUrlIndex,
  keywordDashboardWorkspace,
} from "./research-dashboard.js";

// "Which of my pages should own this term" is answerable from the crawl alone,
// with no keyword provider. The discipline is the same as everywhere else: a
// confident wrong page is worse than an honest blank, so a keyword only gets a
// target when a page covers every content word in it.

const audit = {
  pages: [
    {
      url: "https://example.com/shoes",
      title: "Running shoes",
      error: null,
    },
    {
      url: "https://example.com/blog/marathon-training-plans",
      title: "Marathon training plans",
      error: null,
    },
    {
      url: "https://example.com/broken",
      title: "Nutrition",
      error: "ETIMEDOUT",
    },
  ],
};

describe("keyword target URL", () => {
  it("points a keyword at the page that covers every word", () => {
    const target = buildTargetUrlIndex(audit);
    expect(target("marathon training plans")).toBe(
      "https://example.com/blog/marathon-training-plans",
    );
    expect(target("running shoes")).toBe("https://example.com/shoes");
  });

  // A partial overlap is the dangerous case: "running" alone should not claim
  // the shoes page owns "running shoe nutrition".
  it("returns nothing rather than a partial match", () => {
    const target = buildTargetUrlIndex(audit);
    expect(target("running shoe nutrition")).toBeNull();
    expect(target("electrolyte balance")).toBeNull();
  });

  it("ignores pages the crawl could not reach", () => {
    // The only page mentioning "nutrition" errored, so it is not a candidate.
    expect(buildTargetUrlIndex(audit)("nutrition")).toBeNull();
  });

  it("matches on the URL path when the title does not say it", () => {
    const target = buildTargetUrlIndex({
      pages: [
        { url: "https://example.com/taper-weeks", title: "Guide", error: null },
      ],
    });
    expect(target("taper weeks")).toBe("https://example.com/taper-weeks");
  });

  it("prefers the more specific page when several match", () => {
    const target = buildTargetUrlIndex({
      pages: [
        {
          url: "https://example.com/a",
          title: "Shoes running gear reviews and more",
          error: null,
        },
        { url: "https://example.com/b", title: "Running shoes", error: null },
      ],
    });
    expect(target("running shoes")).toBe("https://example.com/b");
  });

  it("has no target at all when no audit has been run", () => {
    expect(buildTargetUrlIndex(undefined)("running shoes")).toBeNull();
    expect(buildTargetUrlIndex({ pages: [] })("running shoes")).toBeNull();
  });

  it("fills the target on the keyword workspace", () => {
    const workspace = keywordDashboardWorkspace(
      { seed: "running shoes", strength: 50, variants: [{ term: "nike air" }] },
      audit,
    );
    const seed = workspace.opportunities.find(
      (row) => row.keyword === "running shoes",
    )!;
    expect(seed.targetUrl).toBe("https://example.com/shoes");
    // No page covers the variant, so it stays unavailable.
    expect(
      workspace.opportunities.find((row) => row.keyword === "nike air")!
        .targetUrl,
    ).toBeNull();
  });
});

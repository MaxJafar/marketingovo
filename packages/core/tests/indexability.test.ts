import { describe, expect, it } from "vitest";
import {
  assessPageIndexability,
  dashboardIndexabilityStatus,
} from "../src/indexability.js";
import { buildReport } from "../src/core/report/index.js";
import { loadLimits } from "../src/core/limits.js";
import { parsePage } from "../src/parser.js";
import type { CrawlIndex, CrawledPage } from "../src/checks/index.js";

const baseline = {
  status: 200,
  finalUrl: "https://example.com/page",
  contentType: "text/html; charset=utf-8",
  canonical: null,
  robotsMeta: null,
  xRobotsTag: null,
  robotsAllowed: true,
  htmlParsed: true,
  error: null,
} as const;

describe("evidence-backed page indexability", () => {
  it("classifies a verified 2xx HTML response as indexable", () => {
    expect(assessPageIndexability(baseline)).toEqual({
      indexable: true,
      reason: "indexable",
    });
  });

  it.each([
    [{ robotsMeta: "index, noindex, follow" }, "meta_noindex", "noindex"],
    [{ robotsMeta: "none" }, "meta_noindex", "noindex"],
    [
      { xRobotsTag: "googlebot: noindex, nofollow" },
      "x_robots_noindex",
      "noindex",
    ],
    [{ xRobotsTag: "googlebot: none" }, "x_robots_noindex", "noindex"],
    [{ robotsAllowed: false }, "robots_blocked", "blocked"],
    [{ canonical: "/different" }, "canonicalized", "canonicalized"],
    [{ contentType: "application/pdf" }, "non_html", "blocked"],
    [{ status: 301 }, "redirect", "blocked"],
    [{ status: 404 }, "http_error", "blocked"],
  ] as const)("classifies %o as %s", (patch, reason, dashboardStatus) => {
    const result = assessPageIndexability({ ...baseline, ...patch });
    expect(result).toEqual({ indexable: false, reason });
    expect(dashboardIndexabilityStatus(result)).toBe(dashboardStatus);
  });

  it.each([
    [{ status: 0, error: "socket timeout" }, "fetch_error"],
    [{ contentType: "" }, "missing_content_type"],
    [{ robotsAllowed: null }, "robots_unknown"],
    [{ htmlParsed: false }, "parse_failed"],
  ] as const)("keeps insufficient %o evidence unknown", (patch, reason) => {
    const result = assessPageIndexability({ ...baseline, ...patch });
    expect(result).toEqual({ indexable: null, reason });
    expect(dashboardIndexabilityStatus(result)).toBe("unknown");
  });

  it.each([
    [{ robotsMeta: "noindex", robotsAllowed: null }, "meta_noindex"],
    [{ canonical: "/different", robotsAllowed: null }, "canonicalized"],
    [{ xRobotsTag: "noindex", robotsAllowed: null }, "x_robots_noindex"],
  ] as const)(
    "keeps definitive %s evidence when robots evidence is unknown",
    (patch, reason) => {
      expect(assessPageIndexability({ ...baseline, ...patch })).toEqual({
        indexable: false,
        reason,
      });
    },
  );

  it("does not apply another crawler's scoped X-Robots-Tag", () => {
    expect(
      assessPageIndexability({
        ...baseline,
        xRobotsTag: "bingbot: noindex, nofollow, googlebot: index, follow",
      }),
    ).toEqual({ indexable: true, reason: "indexable" });
  });

  it("does not mistake unavailable_after for a crawler qualifier", () => {
    expect(
      assessPageIndexability({
        ...baseline,
        xRobotsTag: "unavailable_after: 25 Jun 2030 15:00:00 PST, noindex",
      }),
    ).toEqual({ indexable: false, reason: "x_robots_noindex" });
  });

  it("resolves a relative self-canonical and ignores fragments", () => {
    expect(
      assessPageIndexability({ ...baseline, canonical: "/page#section" }),
    ).toEqual({ indexable: true, reason: "indexable" });
  });

  it("does not treat an invalid canonical as proof of non-indexability", () => {
    expect(
      assessPageIndexability({
        ...baseline,
        canonical: "https://[invalid-host",
      }),
    ).toEqual({ indexable: true, reason: "indexable" });
  });

  it("carries crawler evidence into the engine report", () => {
    const url = "https://example.com/private";
    const page: CrawledPage = {
      url,
      finalUrl: url,
      status: 200,
      contentType: "text/html; charset=utf-8",
      responseTimeMs: 12,
      bodyBytes: 120,
      redirectChain: [],
      headers: { "X-Robots-Tag": "googlebot: noindex" },
      robotsAllowed: false,
      parsed: parsePage(
        '<html><head><meta name="robots" content="nofollow"><link rel="canonical" href="/canonical"></head></html>',
        url,
      ),
      error: null,
      fetchDurationMs: 12,
      extractions: [],
      vitals: null,
    };
    const index: CrawlIndex = {
      pages: new Map([[url, page]]),
      startUrl: url,
      robots: new Map(),
      finishedAt: new Date().toISOString(),
      durationMs: 12,
      config: loadLimits(),
    };

    expect(buildReport(index, []).pages[0]).toMatchObject({
      finalUrl: url,
      contentType: "text/html; charset=utf-8",
      canonical: "/canonical",
      robotsMeta: "nofollow",
      xRobotsTag: "googlebot: noindex",
      robotsAllowed: false,
      htmlParsed: true,
      error: null,
      redirectChain: [],
    });
  });
});

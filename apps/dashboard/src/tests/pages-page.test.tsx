import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useCapabilities: () => ({
    data: {
      data: {
        projectId: "project-1",
        available: ["website", "search-console", "analytics", "serp"],
        states: [],
      },
    },
  }),
  usePages: () => ({
    data: {
      data: {
        items: [
          {
            id: "page-1",
            runId: "audit-1",
            url: "https://example.com/noindex",
            title: "Noindex landing page",
            statusCode: 200,
            indexability: "noindex",
            indexabilityReason: "meta_noindex",
            crawlDepth: 2,
            linkGraphState: "available",
            inlinkSources: 1,
            inlinkOccurrences: 2,
            outlinkTargets: 1,
            outlinkOccurrences: 1,
          },
          {
            id: "page-2",
            url: "https://example.com/unknown",
            title: "Unverified landing page",
            statusCode: 200,
            indexability: "unknown",
            indexabilityReason: "robots_unknown",
          },
        ],
        total: 2,
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useRunLinks: (
    _runId: string,
    _pageUrl: string,
    options: { direction: "inlinks" | "outlinks" },
  ) => ({
    data: {
      data: {
        version: "link-graph-v1",
        runId: "audit-1",
        generatedAt: "2026-07-16T12:00:00.000Z",
        state: "available",
        page: {
          url: "https://example.com/noindex",
          title: "Noindex landing page",
          statusCode: 200,
          indexable: false,
          crawlDepth: 2,
        },
        direction: options.direction,
        summary: {
          inlinkSources: 1,
          inlinkOccurrences: 2,
          outlinkTargets: 1,
          outlinkOccurrences: 1,
          followedInlinkOccurrences: 2,
          nofollowInlinkOccurrences: 0,
          followedOutlinkOccurrences: 1,
          nofollowOutlinkOccurrences: 0,
          brokenOutlinkTargets: 1,
          redirectedOutlinkTargets: 0,
          uncrawledOutlinkTargets: 0,
        },
        items:
          options.direction === "inlinks"
            ? [
                {
                  sourceUrl: "https://example.com/",
                  sourceTitle: "Home",
                  targetUrl: "https://example.com/noindex",
                  targetPageUrl: "https://example.com/noindex",
                  targetTitle: "Noindex landing page",
                  targetStatusCode: 200,
                  targetIndexable: false,
                  targetState: "direct",
                  occurrences: 2,
                  followOccurrences: 2,
                  nofollowOccurrences: 0,
                  anchorTexts: ["Campaign landing page"],
                  placements: ["main"],
                },
              ]
            : [
                {
                  sourceUrl: "https://example.com/noindex",
                  sourceTitle: "Noindex landing page",
                  targetUrl: "https://example.com/broken",
                  targetPageUrl: "https://example.com/broken",
                  targetTitle: "Broken destination",
                  targetStatusCode: 404,
                  targetIndexable: false,
                  targetState: "broken",
                  occurrences: 1,
                  followOccurrences: 1,
                  nofollowOccurrences: 0,
                  anchorTexts: ["Learn more"],
                  placements: ["main"],
                },
              ],
        pageInfo: {
          total: 1,
          offset: 0,
          limit: 25,
          nextOffset: null,
        },
        warnings: [],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

import { PagesPage } from "../pages/pages";

describe("PagesPage indexability evidence", () => {
  afterEach(cleanup);

  it("shows the classified state and the evidence reason together", () => {
    render(<PagesPage />);

    expect(screen.getByText("Meta robots noindex")).toBeInTheDocument();
    expect(screen.getByText("Robots evidence unavailable")).toBeInTheDocument();
    expect(screen.getByText("noindex")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("opens a page-level inlink and outlink evidence workspace", async () => {
    const user = userEvent.setup();
    render(<PagesPage />);

    await user.click(
      screen.getByRole("button", {
        name: "Explore internal links for Noindex landing page",
      }),
    );
    expect(
      screen.getByRole("region", {
        name: "Internal links for Noindex landing page",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "inlinks for Noindex landing page",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Campaign landing page")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Outlinks · 1 targets" }),
    );
    expect(
      screen.getByRole("table", {
        name: "outlinks for Noindex landing page",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Broken destination")).toBeInTheDocument();
    expect(screen.getByText("broken")).toBeInTheDocument();
  });
});

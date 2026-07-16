import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  replay: vi.fn(),
  resetReplay: vi.fn(),
  sitemap: {
    state: "available",
    sourceUrl: "https://example.com/sitemap.xml",
    fetchStatusCode: 200,
    files: [
      {
        url: "https://example.com/sitemap.xml",
        kind: "urlset",
        statusCode: 200,
        locCount: 3,
      },
    ],
    declaredUrls: 3,
    discoveredIndexableUrls: 3,
    matchedIndexableUrls: 2,
    coverage: 2 / 3,
    missingIndexable: {
      total: 1,
      urls: ["https://example.com/fr"],
      complete: true,
    },
    declaredNotCrawled: { total: 0, urls: [], complete: true },
    brokenDeclared: { total: 0, urls: [], complete: true },
    warnings: [],
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("../api/queries", () => ({
  useRun: () => ({
    data: {
      data: {
        id: "run-1",
        status: "completed",
        startedAt: "2026-07-15T12:00:00.000Z",
        completedAt: "2026-07-15T12:01:00.000Z",
        issuesFound: 1,
        issueBreakdown: [{ severity: "medium", count: 1 }],
        log: [
          {
            at: "2026-07-15T12:01:00.000Z",
            message: "run.completed",
            level: "info",
          },
        ],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useReplayRun: () => ({
    mutate: mocks.replay,
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: mocks.resetReplay,
  }),
  useRunEvidence: (
    _runId: string,
    options: { section: "crawl" | "redirects" | "hreflang" | "extractions" },
  ) => ({
    data: {
      data: {
        runId: "run-1",
        generatedAt: "2026-07-15T12:01:00.000Z",
        state: "available",
        section: options.section,
        items:
          options.section === "hreflang"
            ? [
                {
                  kind: "hreflang",
                  sourceUrl: "https://example.com/",
                  finalUrl: "https://example.com/",
                  htmlLang: "en",
                  selfLanguage: "en",
                  hasXDefault: false,
                  alternates: [
                    {
                      lang: "fr",
                      declaredUrl: "https://example.com/fr",
                      resolvedUrl: "https://example.com/fr",
                      selfReference: false,
                      targetState: "crawled",
                      targetStatusCode: 200,
                      reciprocal: "matched",
                      expectedReturnLanguage: "en",
                      observedReturnLanguages: ["en"],
                    },
                  ],
                },
              ]
            : options.section === "crawl"
              ? [
                  {
                    kind: "crawl",
                    sourceUrl: "https://example.com/",
                    finalUrl: "https://example.com/",
                    title: "Home",
                    statusCode: 200,
                    indexable: true,
                    crawlDepth: 0,
                    discoveredFrom: null,
                  },
                ]
              : [],
        pageInfo: {
          total: 1,
          offset: 0,
          limit: 50,
          nextOffset: null,
        },
        sitemap: mocks.sitemap,
        warnings: [],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
}));

import { AuditDetailPage } from "../pages/audit-detail";

describe("audit evidence workbench", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows measured sitemap coverage and switches to the reciprocal matrix", async () => {
    const user = userEvent.setup();
    render(<AuditDetailPage />);

    expect(
      screen.getByRole("heading", { name: "Sitemap coverage" }),
    ).toBeVisible();
    expect(screen.getByText("66.7%")).toBeVisible();
    expect(screen.getByText("Indexable but absent")).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Crawl path evidence" }),
    ).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Hreflang" }));

    expect(
      screen.getByRole("table", { name: "Hreflang evidence matrix" }),
    ).toBeVisible();
    expect(screen.getByText("matched")).toBeVisible();
    expect(screen.getByText("en / en")).toBeVisible();

    expect(screen.getByText("Replay boundary")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Replay configuration" }),
    );
    expect(mocks.replay).toHaveBeenCalledTimes(1);
  });
});

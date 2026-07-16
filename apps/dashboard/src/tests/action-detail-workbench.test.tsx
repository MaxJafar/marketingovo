import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckpoint: vi.fn(),
  verify: vi.fn(),
  updateAction: vi.fn(),
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  hasNextPage: false,
  checkpointError: null as Error | null,
  verifyError: null as Error | null,
  detail: {
    action: {
      id: "action-1",
      title: "Repair broken internal links",
      summary: "Restore crawl paths to high-intent product pages.",
      whyNow:
        "Twelve affected URLs include pages with observed organic demand.",
      moduleId: "links",
      ruleId: "internal-4xx",
      status: "in_progress",
      verification: "pending",
      priority: "high",
      priorityScore: 76.4,
      impact: "high",
      effort: "low",
      confidence: 0.81,
      scoreVersion: "priority-v1",
      scoreInputs: {
        severity: 0.8,
        organicExposure: 0.64,
        conversionExposure: null,
        urlReach: 0.3,
        confidence: 0.81,
        unavailable: ["conversion_exposure"],
      },
      affectedUrlList: ["https://example.com/product"],
      affectedUrls: 1,
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-15T10:00:00.000Z",
    },
    summary: {
      totalUrls: 1,
      issueOccurrences: 2,
      newOccurrences: 1,
      persistentOccurrences: 0,
      resolvedOccurrences: 0,
      reappearedOccurrences: 0,
      clicks: 42,
      impressions: 1_200,
      keyEvents: null,
    },
    urls: [
      {
        url: "https://example.com/product",
        title: "Product",
        statusCode: 200,
        indexable: true,
        lifecycle: "new",
        issue: {
          fingerprint: "fingerprint-123456",
          severity: "high",
          title: "Internal link points to a 404 response",
          description: "Replace or remove the broken destination.",
          firstSeenAt: "2026-07-15T09:00:00.000Z",
          lastSeenAt: "2026-07-15T09:00:00.000Z",
          evidence: [
            {
              kind: "crawl-observation",
              label: "Broken destination",
              value: "https://example.com/missing",
              source: "static-crawl",
              observedAt: "2026-07-15T09:00:00.000Z",
            },
          ],
        },
        gsc: {
          clicks: 42,
          impressions: 1_200,
          ctr: 0.035,
          position: 8.4,
          state: "fresh",
          periodStart: "2026-06-15",
          periodEnd: "2026-07-14",
        },
        ga4: null,
        cwv: {
          lcp: 2_100,
          cls: 0.08,
          ttfb: 420,
          state: "fresh",
        },
      },
    ],
    history: [
      {
        runId: "run-1",
        observedAt: "2026-07-15T09:00:00.000Z",
        status: "new",
        affectedCount: 1,
      },
    ],
    sources: [
      {
        id: "gsc",
        name: "Google Search Console",
        status: "degraded",
        availability: "stale",
        updatedAt: "2026-07-14T09:00:00.000Z",
        coverage: 76,
        message: "Latest complete property export",
      },
    ],
    verification: {
      state: "not_started",
      checkpointId: "checkpoint-1",
      runId: null,
      coverage: null,
      checkedAt: null,
      reason: null,
    },
    pageInfo: { nextCursor: null, total: 1 },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ actionId: "action-1" }),
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a
      className={className}
      href={to
        .replace("$actionId", params?.actionId ?? "")
        .replace("$runId", params?.runId ?? "")}
    >
      {children}
    </a>
  ),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useActionEvidence: () => ({
    data: {
      pages: [{ data: mocks.detail, meta: { state: "fresh" } }],
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
    hasNextPage: mocks.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: mocks.fetchNextPage,
  }),
  useCreateActionCheckpoint: () => ({
    mutate: mocks.createCheckpoint,
    data: undefined,
    isPending: false,
    isError: Boolean(mocks.checkpointError),
    error: mocks.checkpointError,
  }),
  useVerifyAction: () => ({
    mutate: mocks.verify,
    data: undefined,
    isPending: false,
    isSuccess: false,
    isError: Boolean(mocks.verifyError),
    error: mocks.verifyError,
  }),
  useUpdateAction: () => ({
    mutate: mocks.updateAction,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import { ActionDetailPage } from "../pages/action-detail";

describe("Action Evidence and Verification detail", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.hasNextPage = false;
    mocks.checkpointError = null;
    mocks.verifyError = null;
  });

  it("separates technical evidence from business context and exposes reproducible scoring", async () => {
    const user = userEvent.setup();
    render(<ActionDetailPage />);

    expect(
      screen.getByRole("heading", { name: "Repair broken internal links" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Technical evidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Business context").length).toBeGreaterThan(0);
    expect(screen.getByText(/priority = 100/u)).toBeInTheDocument();
    expect(screen.getByText("Conversion exposure")).toBeInTheDocument();
    expect(
      screen.getByText("Neutral 0.50 substitute; confidence is reduced."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Latest complete property export"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Internal link points to a 404 response"),
    ).toBeInTheDocument();
    expect(screen.getByText("Organic outcomes")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);

    await user.click(
      screen.getByText("Inspect raw evidence (1)", { selector: "summary" }),
    );
    expect(screen.getByText("Broken destination")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/missing")).toBeInTheDocument();
  });

  it("creates a before-state checkpoint and starts idempotent verification", async () => {
    const user = userEvent.setup();
    render(<ActionDetailPage />);

    await user.click(
      screen.getByRole("button", { name: "Replace checkpoint" }),
    );
    expect(mocks.createCheckpoint).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: "Verify current fix" }),
    );
    expect(mocks.verify).toHaveBeenCalledWith("checkpoint-1");
  });

  it("loads the next cursor page and renders mutation failures as alerts", async () => {
    mocks.hasNextPage = true;
    mocks.checkpointError = new Error("Checkpoint storage is unavailable");
    mocks.verifyError = new Error("Verification worker did not start");
    const user = userEvent.setup();
    render(<ActionDetailPage />);

    expect(
      screen.getByText("Checkpoint storage is unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verification worker did not start"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Load 100 more URLs" }),
    );
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

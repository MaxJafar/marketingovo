import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditRun } from "../api/contracts";

const mocks = vi.hoisted(() => ({
  useRunComparison: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
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
    <a className={className} href={to.replace("$runId", params?.runId ?? "")}>
      {children}
    </a>
  ),
}));

vi.mock("../api/queries", () => ({
  useRunComparison: (...args: unknown[]) => mocks.useRunComparison(...args),
}));

import { AuditComparisonCard } from "../components/audit-comparison-card";

const runs: AuditRun[] = [
  {
    id: "current-audit",
    workflowId: "audit",
    startedAt: "2026-07-16T10:00:00.000Z",
    completedAt: "2026-07-16T10:05:00.000Z",
    status: "completed",
  },
  {
    id: "baseline-audit",
    workflowId: "audit",
    startedAt: "2026-07-15T10:00:00.000Z",
    completedAt: "2026-07-15T10:05:00.000Z",
    status: "completed",
  },
  {
    id: "research-run",
    workflowId: "keyword-research",
    startedAt: "2026-07-17T10:00:00.000Z",
    completedAt: "2026-07-17T10:05:00.000Z",
    status: "completed",
  },
];

describe("audit comparison card", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows transparent regression and fix evidence for the latest valid pair", () => {
    mocks.useRunComparison.mockReturnValue({
      data: {
        data: {
          scoreVersion: "regression-v1",
          generatedAt: "2026-07-16T10:10:00.000Z",
          state: "available",
          projectId: "project-1",
          baselineRun: {
            id: "baseline-audit",
            requestedAt: "2026-07-15T10:00:00.000Z",
            status: "succeeded",
          },
          currentRun: {
            id: "current-audit",
            requestedAt: "2026-07-16T10:00:00.000Z",
            status: "succeeded",
          },
          configuration: {
            state: "matched",
            baselineHash: "a".repeat(64),
            currentHash: "a".repeat(64),
            differences: [],
          },
          summary: {
            baselinePages: 100,
            currentPages: 101,
            addedPages: 1,
            removedPages: 0,
            statusChanges: 1,
            indexabilityChanges: 1,
            baselineIssues: 8,
            currentIssues: 7,
            newIssues: 1,
            resolvedIssues: 2,
            persistentIssues: 5,
            severityIncreases: 0,
            severityDecreases: 0,
            reviewedExcludedBaseline: 1,
            reviewedExcludedCurrent: 1,
            baselineHealth: 72,
            currentHealth: 78,
            healthDelta: 6,
            regressionScore: -2,
          },
          issueRegressions: [
            {
              fingerprint: "a".repeat(64),
              ruleId: "server-error",
              moduleId: "technical",
              canonicalUrl: "https://example.com/pricing",
              title: "Pricing page returns a server error",
              change: "new",
              baselineSeverity: null,
              currentSeverity: "critical",
            },
          ],
          issueImprovements: [
            {
              fingerprint: "b".repeat(64),
              ruleId: "title-missing",
              moduleId: "content",
              canonicalUrl: "https://example.com/about",
              title: "Page title is missing",
              change: "resolved",
              baselineSeverity: "high",
              currentSeverity: null,
            },
          ],
          pageChanges: [
            {
              canonicalUrl: "https://example.com/pricing",
              kind: "status_changed",
              impact: "regression",
              before: { statusCode: 200, title: "Pricing", indexable: true },
              after: { statusCode: 500, title: "Pricing", indexable: false },
            },
          ],
          linkGraph: {
            version: "link-delta-v1",
            state: "available",
            baseline: { pageCount: 100, graphPageCount: 100, edgeCount: 820 },
            current: { pageCount: 101, graphPageCount: 101, edgeCount: 824 },
            summary: {
              addedEdges: 6,
              removedEdges: 2,
              changedEdges: 1,
              regressions: 1,
              improvements: 1,
            },
            changes: [
              {
                sourceUrl: "https://example.com/",
                targetUrl: "https://example.com/pricing",
                change: "changed",
                impact: "regression",
                reasons: ["target_resolution", "occurrences"],
                before: {
                  targetPageUrl: "https://example.com/pricing",
                  targetStatusCode: 200,
                  targetIndexable: true,
                  targetState: "direct",
                  occurrences: 1,
                  followOccurrences: 1,
                  nofollowOccurrences: 0,
                  anchorTexts: ["Pricing"],
                  placements: ["navigation"],
                },
                after: {
                  targetPageUrl: "https://example.com/pricing",
                  targetStatusCode: 500,
                  targetIndexable: false,
                  targetState: "broken",
                  occurrences: 2,
                  followOccurrences: 2,
                  nofollowOccurrences: 0,
                  anchorTexts: ["Pricing"],
                  placements: ["navigation"],
                },
              },
            ],
            truncated: false,
            warnings: [
              "Added and removed links remain neutral unless target evidence proves a broken-link regression or recovery; editorial intent still requires review.",
            ],
          },
          truncated: {
            issueRegressions: false,
            issueImprovements: false,
            pageChanges: false,
          },
          warnings: [
            "Ignored and false-positive findings were excluded from effective issue counts and deltas.",
          ],
        },
        meta: { state: "fresh" },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AuditComparisonCard runs={runs} />);

    expect(mocks.useRunComparison).toHaveBeenCalledWith(
      "current-audit",
      "baseline-audit",
    );
    expect(screen.getByLabelText("Baseline audit")).toHaveValue(
      "baseline-audit",
    );
    expect(screen.getByLabelText("Current audit")).toHaveValue("current-audit");
    expect(screen.queryByText(/research-run/u)).not.toBeInTheDocument();
    expect(screen.getByText("-2")).toBeVisible();
    expect(screen.queryByText("priority-v1")).not.toBeInTheDocument();
    expect(screen.getByText("regression-v1")).toBeVisible();
    expect(
      screen.getByText("Pricing page returns a server error"),
    ).toBeVisible();
    expect(screen.getByText("Page title is missing")).toBeVisible();
    const pageTable = screen.getByRole("table", {
      name: "Page-level changes between audit snapshots",
    });
    expect(within(pageTable).getByText("200 · indexable")).toBeVisible();
    expect(within(pageTable).getByText("500 · not indexable")).toBeVisible();
    const linkTable = screen.getByRole("table", {
      name: "Internal-link changes between audit snapshots",
    });
    expect(within(linkTable).getByText("changed")).toBeVisible();
    expect(
      within(linkTable).getByText(/direct · 200 · 1 occurrence/u),
    ).toBeVisible();
    expect(
      within(linkTable).getByText(/broken · 500 · 2 occurrences/u),
    ).toBeVisible();
    expect(screen.getByText("link-delta-v1")).toBeVisible();
    expect(screen.getByText(/editorial intent/u)).toBeVisible();
    expect(screen.getByText(/Ignored and false-positive/u)).toBeVisible();
  });

  it("explains the evidence requirement before a second audit exists", () => {
    mocks.useRunComparison.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AuditComparisonCard runs={[runs[0]!]} />);

    expect(screen.getByText("Two completed audits are required")).toBeVisible();
    expect(screen.queryByLabelText("Baseline audit")).not.toBeInTheDocument();
  });
});

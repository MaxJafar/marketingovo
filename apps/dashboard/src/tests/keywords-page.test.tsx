import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useKeywords: () => ({
    data: {
      data: {
        opportunities: [],
        clusters: [],
        providerUsage: {
          actualCostUsd: 0.0042,
          billableRequests: 2,
          unreportedBillableRequests: 1,
          freeRequests: 2,
        },
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useStartWorkflow: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import { KeywordsPage } from "../pages/keywords";

describe("KeywordsPage workflows", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("starts keyword research with a trimmed seed and declared evidence sources", async () => {
    const user = userEvent.setup();
    render(<KeywordsPage />);

    await user.type(
      screen.getByLabelText("Seed keyword"),
      "  technical seo software  ",
    );
    await user.click(
      screen.getByRole("button", { name: "Start keyword research" }),
    );

    expect(mocks.mutate).toHaveBeenCalledWith({
      projectId: "project-1",
      workflowId: "keyword-research",
      options: {
        seed: "technical seo software",
        includeTrends: true,
        includePaa: true,
        includeRelated: true,
      },
    });
  });

  it("shows reported cost without converting unknown billable cost to zero", () => {
    render(<KeywordsPage />);

    expect(screen.getByText(/\$0\.0042 was reported/u)).toBeInTheDocument();
    expect(
      screen.getByText(/1 billable request\(s\) did not report/u),
    ).toBeInTheDocument();
  });

  it("normalizes and caps content-plan seeds before starting a durable run", async () => {
    const user = userEvent.setup();
    render(<KeywordsPage />);

    await user.type(
      screen.getByLabelText("Seed topics"),
      "technical seo, site migrations\ncore web vitals, log analysis",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate content plan" }),
    );

    expect(mocks.mutate).toHaveBeenCalledWith({
      projectId: "project-1",
      workflowId: "content-plan",
      options: {
        seeds: [
          "technical seo",
          "site migrations",
          "core web vitals",
          "log analysis",
        ],
      },
    });
  });
});

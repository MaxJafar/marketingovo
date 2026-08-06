import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetch: vi.fn(),
  filters: null as unknown,
  item: {
    issue: {
      fingerprint: "f".repeat(64),
      ruleId: "duplicate-dom-id",
      moduleId: "html-quality",
      canonicalUrl: "https://example.com/product",
      severity: "high",
      title: "Duplicate DOM id",
      description: "The same DOM id appears more than once.",
      evidence: [
        {
          kind: "dom",
          label: "Repeated id",
          value: "buy-button",
          source: "static-crawl",
          observedAt: "2026-07-15T12:00:00.000Z",
        },
      ],
      firstSeenAt: "2026-07-14T12:00:00.000Z",
      lastSeenAt: "2026-07-15T12:00:00.000Z",
      status: "open",
    },
    latestRunId: "run-2",
    occurrenceCount: 2,
    adjudication: null,
  },
}));

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
  useIssues: (_siteId: string, filters: unknown) => {
    mocks.filters = filters;
    return {
      data: {
        data: { items: [mocks.item], total: 1, offset: 0, limit: 50 },
        meta: { state: "fresh" },
      },
      isLoading: false,
      error: null,
      refetch: mocks.refetch,
    };
  },
  useUpdateIssueAdjudication: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import { IssuesPage } from "../pages/issues";

describe("Issue review workspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.filters = null;
  });

  it("keeps adjudication evidence-first, reasoned, confirmed, and reversible", async () => {
    const user = userEvent.setup();
    render(<IssuesPage />);

    expect(
      screen.getByRole("table", {
        name: "SEO issues awaiting or carrying review decisions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1 issues")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(
      screen.getByRole("heading", { name: "Duplicate DOM id", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Repeated id")).toBeInTheDocument();
    expect(screen.getByText("buy-button")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save review" });
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText(/Mark false positive/u));
    await user.type(
      screen.getByLabelText(/Review reason/u),
      "The repeated element is inside inert template markup.",
    );
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText(/I reviewed the evidence/u));
    expect(save).toBeEnabled();
    await user.click(save);

    expect(mocks.mutate).toHaveBeenCalledWith({
      fingerprint: mocks.item.issue.fingerprint,
      status: "false_positive",
      note: "The repeated element is inside inert template markup.",
    });
    expect(
      screen.getByText("Raw audit evidence and history are never deleted."),
    ).toBeInTheDocument();
  });

  it("exposes bounded server-side search and review-state filters", async () => {
    const user = userEvent.setup();
    render(<IssuesPage />);

    const search = screen.getByLabelText("Search issues");
    expect(search).toHaveAttribute("maxlength", "160");
    await user.type(search, "canonical");
    await user.selectOptions(screen.getByLabelText("Status"), "false_positive");
    await user.selectOptions(screen.getByLabelText("Severity"), "high");

    expect(mocks.filters).toMatchObject({
      limit: 50,
      offset: 0,
      status: "false_positive",
      severity: "high",
      search: "canonical",
    });
  });
});

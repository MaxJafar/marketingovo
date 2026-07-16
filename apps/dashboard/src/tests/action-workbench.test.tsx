import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetch: vi.fn(),
  actions: [
    {
      id: "canonical-action",
      title: "Consolidate duplicate canonical targets",
      summary: "Stop high-value landing pages from competing.",
      moduleId: "on-page",
      ruleId: "canonical-conflict",
      priority: "critical",
      priorityScore: 91,
      status: "in_progress",
      verification: "verified",
      effort: "high",
      confidence: 0.92,
      affectedUrls: 3,
      updatedAt: "2026-07-15T12:00:00.000Z",
    },
    {
      id: "broken-links-action",
      title: "Repair broken internal links",
      summary: "Restore crawl paths to product pages.",
      moduleId: "links",
      ruleId: "internal-4xx",
      priority: "high",
      priorityScore: 82,
      status: "open",
      verification: "pending",
      effort: "small",
      confidence: 0.84,
      affectedUrls: 12,
      updatedAt: "2026-07-14T12:00:00.000Z",
    },
    {
      id: "titles-action",
      title: "Rewrite duplicated page titles",
      summary: "Clarify intent across the resource library.",
      moduleId: "content",
      ruleId: "title-duplicate",
      priority: "medium",
      priorityScore: 56,
      status: "resolved",
      verification: "regressed",
      effort: "medium",
      confidence: 0.78,
      affectedUrls: 20,
      updatedAt: "2026-07-13T12:00:00.000Z",
    },
  ],
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
    <a
      className={className}
      href={to.replace("$actionId", params?.actionId ?? "")}
    >
      {children}
    </a>
  ),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useActions: () => ({
    data: {
      data: { items: mocks.actions, total: mocks.actions.length },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useUpdateAction: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
    variables: undefined,
    error: null,
  }),
}));

import { ActionsPage } from "../pages/actions";

describe("Action Evidence workbench queue", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("combines accessible search, priority, status, verification, and effort filters", async () => {
    const user = userEvent.setup();
    render(<ActionsPage />);

    expect(
      screen.getByRole("table", { name: "Prioritized SEO actions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3 actions")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Verification"), "verified");
    await user.selectOptions(screen.getByLabelText("Effort"), "high");
    await user.click(screen.getByRole("button", { name: "Critical" }));

    expect(
      screen.getByRole("link", {
        name: "Consolidate duplicate canonical targets",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Repair broken internal links" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3 actions")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await user.type(screen.getByLabelText("Search actions"), "internal-4xx");

    expect(
      screen.getByRole("link", { name: "Repair broken internal links" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Consolidate duplicate canonical targets",
      }),
    ).not.toBeInTheDocument();
  });

  it("sorts by affected scope and persists marketer workflow status", async () => {
    const user = userEvent.setup();
    render(<ActionsPage />);

    await user.selectOptions(screen.getByLabelText("Sort by"), "affected");
    const rows = within(
      screen.getByRole("table", { name: "Prioritized SEO actions" }),
    ).getAllByRole("row");
    expect(
      within(rows[1]!).getByText("Rewrite duplicated page titles"),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Workflow status for Repair broken internal links",
      }),
      "acknowledged",
    );
    expect(mocks.mutate).toHaveBeenCalledWith({
      actionId: "broken-links-action",
      status: "acknowledged",
    });
  });
});

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
  useActions: () => ({
    data: { data: { items: [] }, meta: { state: "fresh" } },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateAction: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    variables: undefined,
    error: null,
  }),
}));

import { ActionsPage } from "../pages/actions";

describe("Action filters", () => {
  afterEach(cleanup);

  it("announces the active toggle with aria-pressed", async () => {
    const user = userEvent.setup();
    render(<ActionsPage />);

    const all = screen.getByRole("button", { name: "All" });
    const high = screen.getByRole("button", { name: "High" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(high).toHaveAttribute("aria-pressed", "false");

    await user.click(high);
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(high).toHaveAttribute("aria-pressed", "true");
  });
});

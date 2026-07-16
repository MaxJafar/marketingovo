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
  useCompetitors: () => ({
    data: {
      data: { items: [] },
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

import { CompetitorsPage } from "../pages/competitors";

describe("CompetitorsPage workflow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("normalizes at most two domains and starts a fair comparison run", async () => {
    const user = userEvent.setup();
    render(<CompetitorsPage />);

    await user.type(
      screen.getByLabelText("Competitor domains"),
      "competitor-one.com\nhttps://competitor-two.com, ignored.example",
    );
    await user.click(screen.getByRole("button", { name: "Compare sites" }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      projectId: "project-1",
      workflowId: "compare",
      options: {
        competitorUrls: [
          "https://competitor-one.com",
          "https://competitor-two.com",
        ],
        maxUrls: 30,
        renderMode: "static",
      },
    });
  });
});

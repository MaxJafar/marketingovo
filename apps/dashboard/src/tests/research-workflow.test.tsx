import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GolemIntelClient } from "@golem-intel/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  researchStart: vi.fn(),
  comparisonStart: vi.fn(),
  runGet: vi.fn(),
}));

vi.mock("../api/client-context.js", () => ({
  useIntelClient: () =>
    ({
      research: { start: mocks.researchStart },
      comparisons: { start: mocks.comparisonStart },
      runs: {
        get: mocks.runGet,
        report: vi.fn(),
        cancel: vi.fn(),
      },
    }) as unknown as GolemIntelClient,
}));

vi.mock("../api/use-run-event-stream.js", () => ({
  useRunEventStream: vi.fn(),
}));

import { ResearchPage } from "../pages/ResearchPage.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Research workspace", () => {
  it("starts a typed research workflow with the visible question and budget", async () => {
    const user = userEvent.setup();
    mocks.researchStart.mockResolvedValue({ id: "run-research" });
    mocks.runGet.mockResolvedValue({
      id: "run-research",
      project_id: "competitive-pulse-demo",
      workflow: "research",
      status: "queued",
      progress: 0,
      stage: "queued",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      report_available: false,
      events: [],
      artifacts: [],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchPage />
      </QueryClientProvider>,
    );

    await user.selectOptions(screen.getByLabelText("Workflow"), "research");
    const question = screen.getByLabelText("Question");
    await user.clear(question);
    await user.type(question, "What materially changed across these brands?");
    const budget = screen.getByLabelText("Sources");
    await user.clear(budget);
    await user.type(budget, "7");
    await user.click(screen.getByRole("button", { name: "Start research" }));

    await waitFor(() =>
      expect(mocks.researchStart).toHaveBeenCalledWith({
        project_id: "competitive-pulse-demo",
        target_ids: ["northstar-labs", "orbit-coffee", "vertex-studio"],
        question: "What materially changed across these brands?",
        source_budget: 7,
      }),
    );
    expect(mocks.comparisonStart).not.toHaveBeenCalled();
    queryClient.clear();
  });
});

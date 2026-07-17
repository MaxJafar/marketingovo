import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GolemIntelClient } from "@golem-intel/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  datasetsPreview: vi.fn(),
  comparisonStart: vi.fn(),
  runGet: vi.fn(),
}));

vi.mock("../api/client-context.js", () => ({
  useIntelClient: () =>
    ({
      datasets: { previewCompetitivePulse: mocks.datasetsPreview },
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
  it("starts a synthetic demo workflow with the chosen failure mode", async () => {
    const user = userEvent.setup();
    mocks.comparisonStart.mockResolvedValue({ id: "run-demo" });
    mocks.runGet.mockResolvedValue({
      id: "run-demo",
      project_id: "competitive-pulse-demo",
      workflow: "compare",
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

    await user.selectOptions(screen.getByLabelText("Source"), "demo");
    await user.selectOptions(screen.getByLabelText("Failure mode"), "slow");
    await user.click(screen.getByRole("button", { name: "Start comparison" }));

    await waitFor(() =>
      expect(mocks.comparisonStart).toHaveBeenCalledWith({
        project_id: "competitive-pulse-demo",
        target_ids: ["northstar-labs", "orbit-coffee", "vertex-studio"],
        goal: "Compare public growth, engagement quality and content cadence.",
        connector_ids: ["fixture.competitive-pulse"],
        simulate: "slow",
      }),
    );
    queryClient.clear();
  });
});

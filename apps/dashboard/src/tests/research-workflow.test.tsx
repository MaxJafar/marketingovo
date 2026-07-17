import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GolemIntelClient } from "@golem-intel/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  datasetsPreview: vi.fn(),
  comparisonStart: vi.fn(),
  runGet: vi.fn(),
  runReplay: vi.fn(),
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
        replay: mocks.runReplay,
      },
    }) as unknown as GolemIntelClient,
}));

vi.mock("../api/use-run-event-stream.js", () => ({
  useRunEventStream: vi.fn(),
}));

import { ResearchPage } from "../pages/ResearchPage.js";

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  cleanup();
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

  it("handles valid import path with attestation, preview confirmation, and keyboard focus", async () => {
    const user = userEvent.setup();
    mocks.datasetsPreview.mockResolvedValue({
      dataset_id: "ds-123",
      valid: true,
      diagnostics: [],
      targets: [
        { target_id: "t1", target_name: "T1", row_count: 10 },
        { target_id: "t2", target_name: "T2", row_count: 20 },
      ],
    });
    mocks.comparisonStart.mockResolvedValue({ id: "run-import" });
    mocks.runGet.mockResolvedValue({
      id: "run-import",
      status: "succeeded",
      report_available: true,
      events: [],
    });
    mocks.runReplay.mockResolvedValue({ id: "run-replayed" });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchPage />
      </QueryClientProvider>,
    );

    const fileInput = screen.getByLabelText("Select CSV");
    expect(fileInput).toBeDisabled();

    // Check attestation
    const attestation = screen.getByLabelText(/I attest I have the right/i);
    await user.click(attestation);
    expect(fileInput).not.toBeDisabled();

    // Upload CSV
    const file = new File(["test"], "test.csv", { type: "text/csv" });
    await user.upload(fileInput, file);

    await waitFor(() => expect(screen.getByText("Dataset Reference")).toBeInTheDocument());

    // Select targets (keyboard path)
    const t1 = screen.getByLabelText(/T1/i);
    const t2 = screen.getByLabelText(/T2/i);

    // Keyboard focus & selec
    t1.focus();
    await user.keyboard(" ");
    t2.focus();
    await user.keyboard(" ");

    // Check confirmation
    const confirmation = screen.getByLabelText(/I confirm the validation results/i);
    await user.click(confirmation);

    // Submi
    const submitBtn = screen.getByRole("button", { name: "Start comparison" });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.submit(submitBtn.closest("form")!);

    await waitFor(() => {
      expect(mocks.comparisonStart).toHaveBeenCalledWith({
        project_id: "competitive-pulse-import",
        target_ids: ["t1", "t2"],
        goal: "Compare imported targets.",
        connector_ids: [],
        dataset_id: "ds-123",
        simulate: "none",
      });
      expect(sessionStorage.getItem("activeRunId")).toBe("run-import");
    });

    // Test Replay
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay run" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Replay run" }));
    await waitFor(() => expect(mocks.runReplay).toHaveBeenCalledWith("run-import"));

    queryClient.clear();
  });

  it("handles validation-error/redaction path", async () => {
    const user = userEvent.setup();
    mocks.datasetsPreview.mockResolvedValue({
      dataset_id: "ds-invalid",
      valid: false,
      diagnostics: [
        { severity: "error", message: "Missing column", record_number: 1 },
      ],
      targets: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchPage />
      </QueryClientProvider>,
    );

    await user.click(screen.getByLabelText(/I attest I have the right/i));
    const file = new File(["invalid"], "invalid.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Select CSV"), file);

    await waitFor(() => {
      expect(screen.getByText("Validation Issues")).toBeInTheDocument();
      expect(screen.getByText(/Missing column/)).toBeInTheDocument();
    });

    // Start comparison should be disabled
    expect(screen.getByRole("button", { name: "Start comparison" })).toBeDisabled();
    queryClient.clear();
  });

  it("restores the active run from sessionStorage", async () => {
    sessionStorage.setItem("activeRunId", "run-restored");
    mocks.runGet.mockResolvedValue({
      id: "run-restored",
      status: "succeeded",
      report_available: false,
      events: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.runGet).toHaveBeenCalledWith("run-restored");
    });
    queryClient.clear();
  });
});

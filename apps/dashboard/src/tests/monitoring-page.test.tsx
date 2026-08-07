import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  refetch: vi.fn(),
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
  useMonitoring: () => ({
    data: {
      data: {
        schedules: [
          {
            id: "schedule-1",
            name: "SEO audit",
            cadence: "0 6 * * 1",
            cron: "0 6 * * 1",
            timezone: "UTC",
            enabled: true,
            nextRunAt: "2026-07-20T06:00:00.000Z",
            status: "healthy",
          },
        ],
        alerts: [],
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useCreateSchedule: () => ({
    mutate: mocks.create,
    isPending: false,
    error: null,
  }),
  useUpdateSchedule: () => ({
    mutate: mocks.update,
    isPending: false,
    error: null,
    variables: undefined,
  }),
  useDeleteSchedule: () => ({
    mutate: mocks.remove,
    isPending: false,
    error: null,
    variables: undefined,
  }),
}));

import { MonitoringPage } from "../pages/monitoring";

describe("MonitoringPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("creates a weekly schedule from marketer-friendly controls", async () => {
    const user = userEvent.setup();
    render(<MonitoringPage />);

    await user.selectOptions(screen.getByLabelText("Frequency"), "weekly");
    await user.clear(screen.getByLabelText("Local time"));
    await user.type(screen.getByLabelText("Local time"), "09:30");
    await user.selectOptions(screen.getByLabelText("Day"), "3");
    await user.clear(screen.getByLabelText("Timezone"));
    await user.type(screen.getByLabelText("Timezone"), "America/New_York");
    await user.click(screen.getByRole("button", { name: "Create schedule" }));

    expect(mocks.create).toHaveBeenCalledWith(
      {
        cron: "30 9 * * 3",
        timezone: "America/New_York",
        enabled: true,
        workflowId: "audit",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("creates a monthly cross-channel report schedule", async () => {
    const user = userEvent.setup();
    render(<MonitoringPage />);

    await user.selectOptions(
      screen.getByLabelText("What to run"),
      "marketing-report",
    );
    await user.selectOptions(screen.getByLabelText("Frequency"), "monthly");
    await user.clear(screen.getByLabelText("Local time"));
    await user.type(screen.getByLabelText("Local time"), "08:00");
    await user.clear(screen.getByLabelText("Timezone"));
    await user.type(screen.getByLabelText("Timezone"), "UTC");
    // The report only cites an audit from its own period; the editor says so.
    expect(screen.getByText(/pair a report schedule/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create schedule" }));

    expect(mocks.create).toHaveBeenCalledWith(
      {
        cron: "0 8 1 * *",
        timezone: "UTC",
        enabled: true,
        workflowId: "marketing-report",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("pauses, edits, and deletes an existing schedule through real mutation hooks", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MonitoringPage />);

    await user.click(
      screen.getByRole("button", { name: "Pause SEO audit schedule" }),
    );
    expect(mocks.update).toHaveBeenCalledWith({
      scheduleId: "schedule-1",
      input: { enabled: false },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Edit schedule" }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Frequency"), "daily");
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(mocks.update).toHaveBeenLastCalledWith(
      {
        scheduleId: "schedule-1",
        input: {
          cron: "0 6 * * *",
          timezone: "UTC",
          enabled: true,
          workflowId: "audit",
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith(
      "Delete the SEO audit schedule?",
    );
    expect(mocks.remove).toHaveBeenCalledWith("schedule-1");
  });
});

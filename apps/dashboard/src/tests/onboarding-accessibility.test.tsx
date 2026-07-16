import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startAudit: vi.fn(),
  createSchedule: vi.fn(),
  createSite: vi.fn(),
  refetch: vi.fn(),
  runs: [] as Array<{
    id: string;
    startedAt: string;
    status:
      "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
  }>,
  schedules: [] as Array<{
    id: string;
    name: string;
    cadence: string;
    enabled: boolean;
  }>,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({
    siteId: "project-1",
    site: {
      id: "project-1",
      name: "Example",
      url: "https://example.com",
      status: "active",
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("../api/queries", () => ({
  useCreateSite: () => ({
    mutate: mocks.createSite,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
  useIntegrations: () => ({
    data: {
      data: {
        items: [
          { id: "gsc", name: "Google Search Console", status: "connected" },
        ],
      },
    },
    isError: false,
    error: null,
  }),
  useRuns: () => ({
    data: { data: { items: mocks.runs } },
    isError: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useMonitoring: () => ({
    data: { data: { schedules: mocks.schedules, alerts: [] } },
    isError: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useStartAudit: () => ({
    mutate: mocks.startAudit,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
  useCreateSchedule: () => ({
    mutate: mocks.createSchedule,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import { OnboardingPage } from "../pages/onboarding";

describe("Onboarding accessibility and completion gates", () => {
  beforeEach(() => {
    mocks.runs = [];
    mocks.schedules = [];
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("exposes current-step and pressed-state semantics and sends the selected goal to a real run", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const goalProgress = screen.getByText("Choose a goal").closest("li");
    expect(goalProgress).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Step 3 of 6: Choose a goal/i)).toBeInTheDocument();

    const goal = screen.getByRole("button", {
      name: /Grow qualified traffic/i,
    });
    expect(goal).toHaveAttribute("aria-pressed", "false");
    await user.click(goal);
    expect(goal).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getByRole("button", { name: "Run baseline audit" }),
    );
    expect(mocks.startAudit).toHaveBeenCalledWith({
      siteId: "project-1",
      mode: "full",
      goal: "Grow qualified organic traffic from existing and new search demand",
    });

    const review = screen.getByRole("button", {
      name: "Review prioritized actions",
    });
    expect(review).toBeDisabled();
    expect(review).toHaveAccessibleDescription(
      "Waiting for a completed baseline run.",
    );
  });

  it("unlocks action review only after a terminal run and activates durable monitoring after review", async () => {
    mocks.runs = [
      {
        id: "run-1",
        startedAt: "2026-07-15T10:00:00.000Z",
        status: "completed",
      },
    ];
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(
      screen.getByRole("button", { name: /Improve technical health/i }),
    );
    const review = screen.getByRole("link", {
      name: /Review prioritized actions/i,
    });
    expect(review).toHaveAttribute("href", "/actions");
    await user.click(review);

    const monitoringProgress = screen
      .getByText("Activate monitoring")
      .closest("li");
    expect(monitoringProgress).toHaveAttribute("aria-current", "step");

    const activate = screen.getByRole("button", {
      name: "Activate weekly monitoring",
    });
    expect(activate).toBeEnabled();
    await user.click(activate);

    expect(mocks.createSchedule).toHaveBeenCalledWith({
      cron: "0 6 * * 1",
      timezone: expect.any(String),
      enabled: true,
    });
  });
});

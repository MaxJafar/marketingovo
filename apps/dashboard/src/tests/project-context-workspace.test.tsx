import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  appendMutate: vi.fn(),
  refetch: vi.fn(),
  workspace: {
    projectId: "project-1",
    current: {
      projectId: "project-1",
      revision: 2,
      profile: {
        summary: "Turn search evidence into verified improvements.",
        audiences: ["SEO leads"],
        markets: ["United States", "United Kingdom"],
        languages: ["English"],
        conversionGoals: ["Qualified demo request"],
        priorityTopics: ["Technical SEO automation"],
        competitors: ["example-competitor.com"],
        constraints: ["Legal review for comparative claims"],
      },
      changeSummary: "Added the United Kingdom market",
      actor: "local-user",
      createdAt: "2026-07-15T12:00:00.000Z",
    },
    history: [
      {
        projectId: "project-1",
        revision: 2,
        profile: {},
        changeSummary: "Added the United Kingdom market",
        actor: "local-user",
        createdAt: "2026-07-15T12:00:00.000Z",
      },
      {
        projectId: "project-1",
        revision: 1,
        profile: {},
        changeSummary: "Established the shared SEO brief",
        actor: "local-user",
        createdAt: "2026-07-14T12:00:00.000Z",
      },
    ],
    journal: [
      {
        id: "journal-1",
        projectId: "project-1",
        sequence: 1,
        kind: "observation",
        title: "Comparison pages attract qualified teams",
        detail: "Search demand supports an evidence-led comparison page.",
        sourceRunId: "run-2",
        actor: "local-user",
        createdAt: "2026-07-15T13:00:00.000Z",
      },
    ],
  },
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useProjectContext: () => ({
    data: {
      data: mocks.workspace,
      meta: { state: "fresh", generatedAt: "2026-07-15T13:00:00.000Z" },
    },
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
  useRuns: () => ({
    data: {
      data: {
        items: [
          {
            id: "run-2",
            status: "completed",
            startedAt: "2026-07-15T11:00:00.000Z",
            completedAt: "2026-07-15T12:00:00.000Z",
          },
        ],
      },
    },
  }),
  useUpdateProjectContext: () => ({
    mutate: mocks.updateMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
  useAppendProjectContextJournal: () => ({
    mutate: mocks.appendMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import { ProjectContextPage } from "../pages/project-context";

describe("Project context workspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates normalized profile revisions while keeping immutable history visible", async () => {
    const user = userEvent.setup();
    render(<ProjectContextPage />);

    expect(
      screen.getByRole("heading", { name: "Project context", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Revision 2", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Established the shared SEO brief")).toBeVisible();

    await user.clear(screen.getByLabelText("Priority audiences"));
    await user.type(
      screen.getByLabelText("Priority audiences"),
      "SEO leads\nseo LEADS\nGrowth teams",
    );
    await user.type(
      screen.getByLabelText("Revision summary"),
      "Added growth team audience",
    );
    await user.click(screen.getByRole("button", { name: "Save new revision" }));

    expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        changeSummary: "Added growth team audience",
        profile: expect.objectContaining({
          summary: "Turn search evidence into verified improvements.",
          audiences: ["SEO leads", "Growth teams"],
          markets: ["United States", "United Kingdom"],
        }),
      }),
    );
    expect(
      screen.getByText("Profile revisions are immutable and newest-first."),
    ).toBeVisible();
  });

  it("appends typed decisions with an optional audit source and preserves prior entries", async () => {
    const user = userEvent.setup();
    render(<ProjectContextPage />);

    expect(
      screen.getByText("Comparison pages attract qualified teams"),
    ).toBeVisible();
    expect(screen.getByText("Source run: run-2")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Entry type"), "decision");
    await user.selectOptions(
      screen.getByLabelText("Source audit (optional)"),
      "run-2",
    );
    await user.type(
      screen.getByLabelText("Entry title"),
      "Prioritize verifiable fixes",
    );
    await user.type(
      screen.getByLabelText("Evidence and implication"),
      "Require a baseline and a repeat audit before claiming impact.",
    );
    await user.click(
      screen.getByRole("button", { name: "Append journal entry" }),
    );

    expect(mocks.appendMutate).toHaveBeenCalledWith(
      {
        kind: "decision",
        title: "Prioritize verifiable fixes",
        detail: "Require a baseline and a repeat audit before claiming impact.",
        sourceRunId: "run-2",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(
      screen.getByText(/Entries cannot be edited in place/u),
    ).toBeVisible();
  });
});

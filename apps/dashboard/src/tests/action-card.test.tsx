import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionCard } from "../components/action-card";

describe("ActionCard", () => {
  it("shows all decision factors and preserves valid zero values", () => {
    render(
      <ActionCard
        rank={1}
        action={{
          id: "action-1",
          title: "Repair broken internal links",
          summary: "Restore navigation paths to high-intent pages.",
          priority: "high",
          priorityScore: 0,
          priorityExplanation:
            "A crawl found repeat failures on conversion paths.",
          impact: "high",
          effort: "small",
          confidence: 0.8,
          evidence: [{ label: "Broken links", value: 0, source: "Crawler" }],
        }}
      />,
    );

    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Effort")).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("A crawl found repeat failures on conversion paths."),
    ).toBeInTheDocument();
  });

  it("labels missing decision inputs instead of rendering zero", () => {
    render(
      <ActionCard
        action={{
          id: "action-2",
          title: "Review schema",
          summary: "Inspect structured data coverage.",
        }}
      />,
    );

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(4);
    expect(
      screen.getByText("The API did not provide a priority explanation."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No supporting evidence was returned for this action."),
    ).toBeInTheDocument();
  });

  it("exposes an accessible status control when updates are enabled", async () => {
    const onStatusChange = vi.fn();
    render(
      <ActionCard
        action={{
          id: "action-3",
          title: "Repair canonical tags",
          summary: "Consolidate duplicate landing pages.",
          status: "open",
        }}
        onStatusChange={onStatusChange}
      />,
    );

    await userEvent.selectOptions(
      screen.getByRole("combobox", {
        name: "Workflow status for Repair canonical tags",
      }),
      "in_progress",
    );

    expect(onStatusChange).toHaveBeenCalledWith("action-3", "in_progress");
  });
});

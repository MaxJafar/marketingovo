import { render, screen } from "@testing-library/react";
import type { ComparisonReport } from "@golem-intel/sdk";
import { describe, expect, it } from "vitest";
import { EvidencePanel } from "../components/EvidencePanel.js";

const report: ComparisonReport = {
  schema_version: "golem.comparison-report.v1",
  run_id: "run-research",
  workflow: "research",
  research_question: "What changed?",
  source_budget: 4,
  research_plan: ["Use committed evidence.", "Cite every material finding."],
  derivation: {
    worker_version: "worker@1",
    model_version: "model@1",
    connector_version: "fixture@1",
    parser_version: "parser@1",
  },
  generated_at: "2026-07-16T00:00:00Z",
  title: "Research dossier: What changed?",
  summary: "A bounded synthesis of public evidence.",
  targets: [
    {
      entity_id: "northstar",
      entity_name: "Northstar",
      follower_delta: 5,
      median_engagement_rate: 0.04,
      posting_cadence_per_week: 2,
      content_format_mix: { video: 1 },
      confidence: 0.9,
      warnings: [],
      citations: [
        {
          observation_id: "observation-1",
          entity_id: "northstar",
          source_url: "https://example.invalid/northstar",
          native_id: "native-1",
          observed_at: "2026-07-15T00:00:00Z",
          connector_version: "fixture@1",
          confidence: 0.9,
        },
      ],
    },
  ],
  metric_definitions: [],
  contradictions: [],
  limitations: ["Synthetic fixture."],
};

describe("EvidencePanel", () => {
  it("renders the research plan and inspectable derivation", () => {
    render(<EvidencePanel report={report} />);

    expect(screen.getByText(report.title)).toBeInTheDocument();
    expect(screen.getByText("budget · 4 sources")).toBeInTheDocument();
    expect(
      screen.getByText("Cite every material finding."),
    ).toBeInTheDocument();
    expect(screen.getByText("worker@1")).toBeInTheDocument();
    expect(screen.getByText("model@1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "native-1" })).toHaveAttribute(
      "href",
      "https://example.invalid/northstar",
    );
  });
});

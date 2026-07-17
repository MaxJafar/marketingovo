import { render, screen, cleanup } from "@testing-library/react";
import type { ComparisonReport } from "@golem-intel/sdk";
import { describe, expect, it, afterEach } from "vitest";
import { EvidencePanel } from "../components/EvidencePanel.js";
import { components } from "@golem-intel/sdk/generated";

type ImportComparisonReport = components["schemas"]["ImportComparisonReport"];

afterEach(() => {
  cleanup();
});

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

const reportV2: ImportComparisonReport = {
  schema_version: "golem.comparison-report.v2",
  run_id: "run-import",
  workflow: "compare",
  derivation: {
    worker_version: "worker@2",
    model_version: "model@2",
    connector_version: "import@2",
    parser_version: "parser@2",
  },
  generated_at: "2026-07-16T00:00:00Z",
  dataset: {
    dataset_id: "dataset-12345",
    input_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    input_size_bytes: 1024,
    metric_catalog_version: "competitive-pulse.v1",
    input_schema_id: "golem.competitive-pulse-import.v1",
    platform: "TestPlatform",
    validated_at: "2026-07-16T00:00:00Z",
    retention_until: "2027-01-01T00:00:00Z",
    input_parser_version: "golem-python-competitive-pulse-csv@1.0.0",
  },
  summary: "V2 test comparison.",
  targets: [
    {
      target_id: "target-1",
      target_name: "Target V2",
      metrics: [
        {
          id: "followers.delta",
          definition_version: "v1",
          availability: "missing",
          value: null,
          unit: "followers",
          population: "entire_dataset",
          numerator: "test-num",
          denominator: "test-denom",
          period: { start: "2026-01-01T00:00:00Z", end: "2026-01-31T00:00:00Z" },
          quality: {
            candidate_count: 100,
            included_count: 50,
            excluded_count: 50,
            min_input_confidence: 0.8,
            mean_input_confidence: 0.9,
            mean_input_coverage: 0.95,
          },
          evidence_observation_ids: ["obs-v2"],
          limitations: ["Metric missing"],
        },
      ],
    },
  ],
  comparisons: [],
  evidence: {
    "obs-v2": {
      observation_id: "obs-v2",
      entity_id: "target-1",
      entity_name: "Target V2",
      platform: "TestPlatform",
      content_id: null,
      dimension: null,
      metric: "followers.delta",
      metric_definition_version: "v1",
      numerator: null,
      denominator: null,
      value: 100,
      unit: "followers",
      published_at: null,
      observed_at: "2026-07-16T00:00:00Z",
      recorded_at: "2026-07-16T00:00:00Z",
      valid_from: "2026-07-16T00:00:00Z",
      valid_to: null,
      source_url: "https://v2.example.invalid/source",
      native_id: "v2-native-1",
      connector_version: "import@2",
      classification: "observed",
      confidence: 0.9,
      artifact_hash: "hash",
      extraction_pointer: "pointer",
      freshness_seconds: 0,
      availability: "available",
      coverage: 1.0,
      acquisition_mode: "user_import",
      data_class: "public",
      permitted_purpose: "competitive_research",
      retention_until: "2027-01-01T00:00:00Z",
      rights_state: "permitted",
    },
  },
  contradictions: [],
  limitations: [],
};

describe("EvidencePanel", () => {
  it("renders the research plan and inspectable derivation for V1", () => {
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

  it("renders v2 report per-metric exact evidence, quality fields, and inert citations", () => {
    render(<EvidencePanel report={reportV2} />);

    expect(screen.getByText("V2 test comparison.")).toBeInTheDocument();
    expect(screen.getByText("MISSING")).toBeInTheDocument();
    expect(screen.getByText("Metric missing")).toBeInTheDocument();

    // Quality check
    expect(screen.getByText("Mean Coverage: 95.0%")).toBeInTheDocument();
    expect(screen.getByText("Mean Confidence: 90.0%")).toBeInTheDocument();
    expect(screen.getByText("Pop: entire_dataset")).toBeInTheDocument();
    expect(screen.getByText("Included: 50 / 100")).toBeInTheDocument();
    expect(screen.getByText("Excluded: 50")).toBeInTheDocument();

    // Inert citation check
    const copyButton = screen.getByRole("button", { name: "Copy source URL" });
    expect(copyButton).toBeInTheDocument();

    // Make sure no link exists for this imported citation
    const links = screen.queryAllByRole("link");
    expect(links.length).toBe(0);

    // Ensure exact source URL is printed
    expect(screen.getByText("https://v2.example.invalid/source")).toBeInTheDocument();
  });
});

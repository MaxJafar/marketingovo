import { describe, expect, it } from "vitest";
import {
  PUBLIC_AGENT_TOOL_CONTRACTS,
  PUBLIC_AGENT_TOOL_NAMES,
} from "./agent-tools.js";

describe("public agent tool contracts", () => {
  it("keeps unique workflow-level tools", () => {
    expect(PUBLIC_AGENT_TOOL_NAMES).toEqual([
      "marketingovo_audit_start",
      "marketingovo_run_get",
      "marketingovo_run_evidence",
      "marketingovo_run_links",
      "marketingovo_run_compare",
      "marketingovo_compare_start",
      "marketingovo_keyword_research_start",
      "marketingovo_content_plan_start",
      "marketingovo_osint_research_start",
      "marketingovo_monitoring_status",
    ]);
    expect(new Set(PUBLIC_AGENT_TOOL_NAMES).size).toBe(10);
    expect(
      PUBLIC_AGENT_TOOL_NAMES.every((toolName) =>
        toolName.startsWith("marketingovo_"),
      ),
    ).toBe(true);
  });

  it("publishes strict schemas without credential-shaped inputs", () => {
    for (const contract of PUBLIC_AGENT_TOOL_CONTRACTS) {
      expect(contract.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
      expect(
        Object.keys(contract.inputSchema.properties).some((field) =>
          /secret|token|password|api_?key/iu.test(field),
        ),
      ).toBe(false);
    }
  });

  it("marks only start operations optional and keeps read tools closed-world", () => {
    expect(
      PUBLIC_AGENT_TOOL_CONTRACTS.filter((contract) => contract.optional).map(
        (contract) => contract.name,
      ),
    ).toEqual(
      PUBLIC_AGENT_TOOL_NAMES.filter((name) => name.endsWith("_start")),
    );

    for (const contract of PUBLIC_AGENT_TOOL_CONTRACTS) {
      expect(contract.annotations.destructiveHint).toBe(false);
      if (!contract.name.endsWith("_start")) {
        expect(contract.annotations).toMatchObject({
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: false,
        });
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  PUBLIC_AGENT_TOOL_CONTRACTS,
  PUBLIC_AGENT_TOOL_NAMES,
  type AgentToolSafetyAnnotations,
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
      "marketingovo_ads_cabinets",
      "marketingovo_ads_performance",
      "marketingovo_ads_audit_start",
      "marketingovo_campaign_stage",
      "marketingovo_brand_kit",
      "marketingovo_email_templates",
      "marketingovo_email_draft",
      "marketingovo_marketing_report",
      "marketingovo_campaign_link",
    ]);
    expect(new Set(PUBLIC_AGENT_TOOL_NAMES).size).toBe(
      PUBLIC_AGENT_TOOL_NAMES.length,
    );
    expect(
      PUBLIC_AGENT_TOOL_NAMES.every((toolName) =>
        toolName.startsWith("marketingovo_"),
      ),
    ).toBe(true);
  });

  it("never offers a tool that publishes or spends", () => {
    // The composer stages; a person approves in a browser. If a publish or
    // approve tool ever appears in this registry, the transport split that
    // keeps an agent from spending money under the operator's brand has been
    // routed around, and that is worth failing a build over.
    expect(
      PUBLIC_AGENT_TOOL_NAMES.filter((name) =>
        /publish|approve|launch|spend/iu.test(name),
      ),
    ).toEqual([]);
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

  it("marks every state-changing tool optional and keeps read tools closed-world", () => {
    // `optional` is what an operator allowlists against, so it must line up
    // with "this tool changes something" rather than with a name suffix. The
    // two coincided while every writing tool was a `_start`; stating the real
    // rule keeps the allowlist meaningful now that staging a draft also
    // writes without touching the network.
    for (const contract of PUBLIC_AGENT_TOOL_CONTRACTS) {
      expect(contract.annotations.destructiveHint).toBe(false);
      // `readOnlyHint` is absent rather than false on writing tools, so the
      // const-asserted union does not carry the key on every member.
      const annotations: AgentToolSafetyAnnotations = contract.annotations;
      const readOnly = annotations.readOnlyHint === true;
      expect(contract.optional).toBe(!readOnly);
      if (readOnly) {
        expect(contract.annotations).toMatchObject({
          idempotentHint: true,
          openWorldHint: false,
        });
      }
    }
  });

  it("marks exactly the network-initiating tools open-world", () => {
    expect(
      PUBLIC_AGENT_TOOL_CONTRACTS.filter(
        (contract) => contract.annotations.openWorldHint,
      ).map((contract) => contract.name),
    ).toEqual(
      PUBLIC_AGENT_TOOL_NAMES.filter((name) => name.endsWith("_start")),
    );
  });
});

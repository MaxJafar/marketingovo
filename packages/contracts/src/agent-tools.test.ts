import { describe, expect, it } from "vitest";
import { PUBLIC_AGENT_TOOLS } from "./agent-tools.js";

describe("public agent boundary", () => {
  it("exposes six unique workflow-level tools", () => {
    expect(PUBLIC_AGENT_TOOLS).toHaveLength(6);
    expect(new Set(PUBLIC_AGENT_TOOLS.map(({ name }) => name)).size).toBe(6);
  });

  it("keeps reveal, deletion, policy and outreach outside the agent surface", () => {
    const names = PUBLIC_AGENT_TOOLS.map(({ name }) => name).join(" ");
    expect(names).not.toMatch(/contact|delete|outreach|policy|credential/u);
  });
});


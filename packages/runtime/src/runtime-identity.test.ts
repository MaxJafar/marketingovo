import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentSeoRuntime, GolemSeoRuntime } from "@agentseoapp/contracts";
import { AgentSeoLocalRuntime, GolemLocalRuntime } from "./index.js";

describe("runtime identity compatibility", () => {
  it("keeps the deprecated 1.x runtime names as exact canonical aliases", () => {
    expect(GolemLocalRuntime).toBe(AgentSeoLocalRuntime);

    const dataDir = mkdtempSync(join(tmpdir(), "agentseo-runtime-identity-"));
    const runtime: GolemLocalRuntime = new GolemLocalRuntime({ dataDir });
    const canonicalContract: AgentSeoRuntime = runtime;
    const legacyContract: GolemSeoRuntime = canonicalContract;

    expect(runtime).toBeInstanceOf(AgentSeoLocalRuntime);
    expect(legacyContract).toBe(canonicalContract);

    runtime.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
});

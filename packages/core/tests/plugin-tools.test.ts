// The core package is an engine library, not an agent plugin or CLI package.
// Public agent tools live behind the exact six-tool MCP/OpenClaw/Codex surface.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
) as {
  exports?: Record<string, unknown>;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe("core package public surface", () => {
  it("does not publish the legacy plugin manifest", () => {
    expect(packageJson.exports?.["./plugin.json"]).toBeUndefined();
    expect(packageJson.files).not.toContain("plugin.json");
  });

  it("does not publish a duplicate marketingovo CLI binary", () => {
    expect(packageJson.bin?.["marketingovo"]).toBeUndefined();
    expect(packageJson.scripts?.["start"]).toBeUndefined();
    expect(packageJson.scripts?.["demo"]).toBeUndefined();
  });

  it("retains only a synthetic quarantined legacy migration fixture", () => {
    const legacy = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../migrations/legacy-v0/plugin.json",
        ),
        "utf8",
      ),
    ) as { private?: boolean; quarantined?: boolean; synthetic?: boolean };
    expect(legacy.private).toBe(false);
    expect(legacy.quarantined).toBe(true);
    expect(legacy.synthetic).toBe(true);
  });
});

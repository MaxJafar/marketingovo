import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("CLI help", () => {
  it("documents the canonical connection flags and environment variables", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const packageDirectory = resolve(sourceDirectory, "..");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve(sourceDirectory, "cli.ts"), "help"],
      {
        cwd: packageDirectory,
        encoding: "utf8",
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Connection options:");
    expect(result.stdout).toContain("--data-dir PATH");
    expect(result.stdout).toContain("AGENTSEO_DATA_DIR");
    expect(result.stdout).toContain("--service-token-file PATH");
    expect(result.stdout).toContain("AGENTSEO_SERVICE_TOKEN_FILE");
    expect(result.stdout).toContain("--api-url URL");
    expect(result.stdout).toContain("AGENTSEO_API_URL");
    expect(result.stdout).toContain(
      "--port PORT                 Port for the default API URL only",
    );
  });
});

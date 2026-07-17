import { describe, expect, it } from "vitest";
import { renderCliHelp } from "./cli-help.js";

describe("CLI help", () => {
  it("documents the canonical connection flags and environment variables", () => {
    const output = renderCliHelp("0.11.0-test.0");

    expect(output).toContain("Connection options:");
    expect(output).toContain("--data-dir PATH");
    expect(output).toContain("AGENTSEO_DATA_DIR");
    expect(output).toContain("--service-token-file PATH");
    expect(output).toContain("AGENTSEO_SERVICE_TOKEN_FILE");
    expect(output).toContain("--api-url URL");
    expect(output).toContain("AGENTSEO_API_URL");
    expect(output).toContain(
      "--port PORT                 Port for the default API URL only",
    );
  });
});

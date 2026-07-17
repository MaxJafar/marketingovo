import { describe, expect, it, vi } from "vitest";
import {
  resolveMcpConnectionEnvironment,
  warnLegacyMcpInvocation,
} from "./compatibility.js";

describe("MCP connection environment compatibility", () => {
  it("warns when the deprecated executable alias is invoked", () => {
    const warn = vi.fn();
    warnLegacyMcpInvocation(warn);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("golem-seo-mcp is deprecated"),
    );
    expect(warn.mock.calls[0]![0]).toContain("agentseo-mcp");
  });

  it("prefers canonical connection variables", () => {
    const warn = vi.fn();
    expect(
      resolveMcpConnectionEnvironment(
        {
          AGENTSEO_SERVICE_TOKEN_FILE: "/canonical/token",
          GOLEM_SEO_SERVICE_TOKEN_FILE: "/legacy/token",
          AGENTSEO_API_URL: "http://127.0.0.1:3210/api/v1",
          GOLEM_SEO_API_URL: "http://127.0.0.1:9999/api/v1",
        },
        warn,
        new Set(),
      ),
    ).toEqual({
      tokenFile: "/canonical/token",
      baseUrl: "http://127.0.0.1:3210/api/v1",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts legacy variables with explicit deprecation warnings", () => {
    const warn = vi.fn();
    expect(
      resolveMcpConnectionEnvironment(
        {
          GOLEM_SEO_SERVICE_TOKEN_FILE: "/legacy/token",
          GOLEM_SEO_API_URL: "http://127.0.0.1:9999/api/v1",
        },
        warn,
        new Set(),
      ),
    ).toEqual({
      tokenFile: "/legacy/token",
      baseUrl: "http://127.0.0.1:9999/api/v1",
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.join("\n")).toContain("AGENTSEO_SERVICE_TOKEN_FILE");
    expect(warn.mock.calls.join("\n")).toContain("AGENTSEO_API_URL");
  });

  it("uses GOLEMSEO before GOLEM_SEO and warns once per selected alias", () => {
    const warn = vi.fn();
    const state = new Set<string>();
    const environment = {
      GOLEMSEO_SERVICE_TOKEN_FILE: "/compact/token",
      GOLEM_SEO_SERVICE_TOKEN_FILE: "/underscored/token",
      GOLEMSEO_API_URL: "http://127.0.0.1:4000/api/v1",
      GOLEM_SEO_API_URL: "http://127.0.0.1:5000/api/v1",
    };
    expect(resolveMcpConnectionEnvironment(environment, warn, state)).toEqual({
      tokenFile: "/compact/token",
      baseUrl: "http://127.0.0.1:4000/api/v1",
    });
    expect(resolveMcpConnectionEnvironment(environment, warn, state)).toEqual({
      tokenFile: "/compact/token",
      baseUrl: "http://127.0.0.1:4000/api/v1",
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.join("\n")).toContain("GOLEMSEO_SERVICE_TOKEN_FILE");
    expect(warn.mock.calls.join("\n")).toContain("GOLEMSEO_API_URL");
  });
});

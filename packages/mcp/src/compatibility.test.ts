import { describe, expect, it, vi } from "vitest";
import { resolveMcpConnectionEnvironment } from "./compatibility.js";

describe("MCP connection environment compatibility", () => {
  it("prefers canonical connection variables", () => {
    const warn = vi.fn();
    expect(
      resolveMcpConnectionEnvironment(
        {
          MARKETINGOVO_SERVICE_TOKEN_FILE: "/canonical/token",
          GOLEM_SEO_SERVICE_TOKEN_FILE: "/legacy/token",
          MARKETINGOVO_API_URL: "http://127.0.0.1:3210/api/v1",
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
    expect(warn.mock.calls.join("\n")).toContain(
      "MARKETINGOVO_SERVICE_TOKEN_FILE",
    );
    expect(warn.mock.calls.join("\n")).toContain("MARKETINGOVO_API_URL");
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

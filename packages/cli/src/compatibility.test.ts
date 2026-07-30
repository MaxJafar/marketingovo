import { describe, expect, it, vi } from "vitest";
import { join, resolve } from "node:path";
import {
  readCompatibleEnvironmentVariable,
  resolveCliConnectionOptions,
} from "./compatibility.js";

describe("CLI identity compatibility", () => {
  it("prefers the canonical variable without warning", () => {
    const warn = vi.fn();
    expect(
      readCompatibleEnvironmentVariable(
        "AGENTSEO_MASTER_PASSWORD",
        ["GOLEMSEO_MASTER_PASSWORD", "GOLEM_SEO_MASTER_PASSWORD"],
        {
          AGENTSEO_MASTER_PASSWORD: " canonical ",
          GOLEM_SEO_MASTER_PASSWORD: "legacy",
        },
        warn,
        new Set(),
      ),
    ).toBe("canonical");
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts the legacy variable with a value-safe deprecation warning", () => {
    const warn = vi.fn();
    expect(
      readCompatibleEnvironmentVariable(
        "AGENTSEO_MASTER_PASSWORD",
        ["GOLEMSEO_MASTER_PASSWORD", "GOLEM_SEO_MASTER_PASSWORD"],
        { GOLEM_SEO_MASTER_PASSWORD: "do-not-log-this" },
        warn,
        new Set(),
      ),
    ).toBe("do-not-log-this");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain("GOLEM_SEO_MASTER_PASSWORD");
    expect(warn.mock.calls[0]![0]).toContain("AGENTSEO_MASTER_PASSWORD");
    expect(warn.mock.calls[0]![0]).not.toContain("do-not-log-this");
  });

  it.each([
    {
      environment: {
        GOLEMSEO_MASTER_PASSWORD: "compact",
        GOLEM_SEO_MASTER_PASSWORD: "underscored",
      },
      expected: "compact",
      warned: "GOLEMSEO_MASTER_PASSWORD",
    },
    {
      environment: { GOLEM_SEO_MASTER_PASSWORD: "underscored" },
      expected: "underscored",
      warned: "GOLEM_SEO_MASTER_PASSWORD",
    },
    {
      environment: { SCREAMINGCLAW_CHROME_PATH: "/legacy/chrome" },
      canonical: "AGENTSEO_CHROME_PATH",
      legacy: [
        "GOLEMSEO_CHROME_PATH",
        "GOLEM_SEO_CHROME_PATH",
        "SCREAMINGCLAW_CHROME_PATH",
      ],
      expected: "/legacy/chrome",
      warned: "SCREAMINGCLAW_CHROME_PATH",
    },
  ])(
    "uses the ordered legacy matrix and warns for $warned",
    ({
      environment,
      canonical = "AGENTSEO_MASTER_PASSWORD",
      legacy = ["GOLEMSEO_MASTER_PASSWORD", "GOLEM_SEO_MASTER_PASSWORD"],
      expected,
      warned,
    }) => {
      const warn = vi.fn();
      expect(
        readCompatibleEnvironmentVariable(
          canonical,
          legacy,
          environment,
          warn,
          new Set(),
        ),
      ).toBe(expected);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]![0]).toContain(warned);
    },
  );

  it("warns only once for repeated reads of the same legacy name", () => {
    const warn = vi.fn();
    const state = new Set<string>();
    for (let index = 0; index < 2; index++) {
      expect(
        readCompatibleEnvironmentVariable(
          "AGENTSEO_CREDENTIAL_BROKER",
          ["GOLEMSEO_CREDENTIAL_BROKER", "GOLEM_SEO_CREDENTIAL_BROKER"],
          { GOLEMSEO_CREDENTIAL_BROKER: "/legacy/broker" },
          warn,
          state,
        ),
      ).toBe("/legacy/broker");
    }
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("CLI connection compatibility", () => {
  const cwd = resolve("workspace", "current");
  const defaultDataDirectory = resolve("legacy-default", "Golem SEO");

  function resolveConnection(
    flags: ReadonlyMap<string, string | boolean> = new Map(),
    environment: Readonly<Record<string, string | undefined>> = {},
    warn = vi.fn(),
    warningState = new Set<string>(),
  ) {
    return resolveCliConnectionOptions({
      flags,
      environment,
      currentWorkingDirectory: cwd,
      defaultDataDirectory,
      warn,
      warningState,
    });
  }

  it("uses the existing local defaults and lets --port alter only the default URL", () => {
    expect(resolveConnection()).toEqual({
      dataDirectory: defaultDataDirectory,
      serviceTokenFile: join(defaultDataDirectory, "service-token"),
      apiUrl: "http://127.0.0.1:3210/api/v1",
    });

    expect(resolveConnection(new Map([["port", "4310"]])).apiUrl).toBe(
      "http://127.0.0.1:4310/api/v1",
    );
    expect(
      resolveConnection(new Map([["port", "4310"]]), {
        AGENTSEO_API_URL: "http://localhost:7310/api/v1",
      }).apiUrl,
    ).toBe("http://127.0.0.1:7310/api/v1");
  });

  it("resolves relative flag paths and gives flags precedence without legacy warnings", () => {
    const warn = vi.fn();
    const resolved = resolveConnection(
      new Map([
        ["data-dir", "flag-data"],
        ["service-token-file", "secrets/token"],
        ["api-url", "http://localhost:4567/api/v1"],
        ["port", "9999"],
      ]),
      {
        AGENTSEO_DATA_DIR: "canonical-data",
        GOLEMSEO_DATA_DIR: "legacy-data",
        AGENTSEO_SERVICE_TOKEN_FILE: "canonical-token",
        GOLEMSEO_SERVICE_TOKEN_FILE: "legacy-token",
        AGENTSEO_API_URL: "http://127.0.0.1:7654/api/v1",
        GOLEMSEO_API_URL: "http://127.0.0.1:8765/api/v1",
      },
      warn,
    );

    expect(resolved).toEqual({
      dataDirectory: resolve(cwd, "flag-data"),
      serviceTokenFile: resolve(cwd, "secrets/token"),
      apiUrl: "http://127.0.0.1:4567/api/v1",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("prefers canonical variables and resolves their relative paths", () => {
    const warn = vi.fn();
    expect(
      resolveConnection(
        new Map(),
        {
          AGENTSEO_DATA_DIR: "canonical-data",
          GOLEMSEO_DATA_DIR: "ignored-data",
          AGENTSEO_SERVICE_TOKEN_FILE: "canonical-token",
          GOLEMSEO_SERVICE_TOKEN_FILE: "ignored-token",
          AGENTSEO_API_URL: "http://[::1]:4100/api/v1",
          GOLEMSEO_API_URL: "http://127.0.0.1:4200/api/v1",
        },
        warn,
      ),
    ).toEqual({
      dataDirectory: resolve(cwd, "canonical-data"),
      serviceTokenFile: resolve(cwd, "canonical-token"),
      apiUrl: "http://127.0.0.1:4100/api/v1",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses the ordered legacy families for each connection value", () => {
    const warn = vi.fn();
    expect(
      resolveConnection(
        new Map(),
        {
          GOLEMSEO_DATA_DIR: "compact-data",
          GOLEM_SEO_DATA_DIR: "underscored-data",
          SCREAMINGCLAW_DATA_DIR: "oldest-data",
          GOLEM_SEO_SERVICE_TOKEN_FILE: "underscored-token",
          SCREAMINGCLAW_SERVICE_TOKEN_FILE: "oldest-token",
          SCREAMINGCLAW_API_URL: "http://localhost:5100/api/v1",
        },
        warn,
      ),
    ).toEqual({
      dataDirectory: resolve(cwd, "compact-data"),
      serviceTokenFile: resolve(cwd, "underscored-token"),
      apiUrl: "http://127.0.0.1:5100/api/v1",
    });
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("GOLEMSEO_DATA_DIR"),
      expect.stringContaining("GOLEM_SEO_SERVICE_TOKEN_FILE"),
      expect.stringContaining("SCREAMINGCLAW_API_URL"),
    ]);
  });

  it("warns once per used legacy name without exposing values", () => {
    const warn = vi.fn();
    const warningState = new Set<string>();
    const environment = {
      GOLEMSEO_DATA_DIR: "private-data-location",
      GOLEMSEO_SERVICE_TOKEN_FILE: "private-token-location",
      GOLEMSEO_API_URL: "http://localhost:6100/api/v1",
    };

    resolveConnection(new Map(), environment, warn, warningState);
    resolveConnection(new Map(), environment, warn, warningState);

    expect(warn).toHaveBeenCalledTimes(3);
    const warnings = warn.mock.calls.flat().join("\n");
    expect(warnings).not.toContain("private-data-location");
    expect(warnings).not.toContain("private-token-location");
    expect(warnings).not.toContain("http://localhost:6100");
  });

  it.each([
    ["http://127.0.0.1:7100/api/v1", "http://127.0.0.1:7100/api/v1"],
    ["http://localhost:7200/api/v1", "http://127.0.0.1:7200/api/v1"],
    ["http://[::1]:7300/api/v1", "http://127.0.0.1:7300/api/v1"],
  ])("accepts the loopback API URL %s", (apiUrl, expected) => {
    expect(resolveConnection(new Map([["api-url", apiUrl]])).apiUrl).toBe(
      expected,
    );
  });

  it.each([
    "http://example.com:3210/api/v1",
    "http://192.168.1.20:3210/api/v1",
  ])("rejects the remote API URL %s", (apiUrl) => {
    expect(() => resolveConnection(new Map([["api-url", apiUrl]]))).toThrow(
      /remote API URLs are not allowed/u,
    );
  });

  it.each([
    "https://127.0.0.1:3210/api/v1",
    "http://127.0.0.1:3210/",
    "http://user:secret@127.0.0.1:3210/api/v1",
  ])("rejects the unsafe local API URL shape %s", (apiUrl) => {
    expect(() => resolveConnection(new Map([["api-url", apiUrl]]))).toThrow(
      /must match http:\/\/127\.0\.0\.1/u,
    );
  });
});

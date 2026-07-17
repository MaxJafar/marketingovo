import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetEnvCompatForTests,
  envBool,
  envInt,
  envStr,
} from "../src/env.js";

const KEYS = [
  "AGENTSEO_TEST_SECRET",
  "GOLEMSEO_TEST_SECRET",
  "GOLEM_SEO_TEST_SECRET",
  "SCREAMINGCLAW_TEST_SECRET",
  "AGENTSEO_TEST_BOOL",
  "GOLEMSEO_TEST_BOOL",
  "AGENTSEO_TEST_INT",
  "GOLEM_SEO_TEST_INT",
] as const;

describe("AGENTseo environment compatibility", () => {
  beforeEach(() => {
    _resetEnvCompatForTests();
    for (const key of KEYS) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefers the canonical value without warning", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("AGENTSEO_TEST_SECRET", "canonical-secret");
    vi.stubEnv("GOLEMSEO_TEST_SECRET", "legacy-secret");
    vi.stubEnv("GOLEM_SEO_TEST_SECRET", "older-secret");
    vi.stubEnv("SCREAMINGCLAW_TEST_SECRET", "oldest-secret");

    expect(
      envStr("AGENTSEO_TEST_SECRET", "SCREAMINGCLAW_TEST_SECRET", "fallback"),
    ).toBe("canonical-secret");
    expect(warning).not.toHaveBeenCalled();
  });

  it.each([
    ["GOLEMSEO_TEST_SECRET", "golemseo-secret"],
    ["GOLEM_SEO_TEST_SECRET", "golem-seo-secret"],
    ["SCREAMINGCLAW_TEST_SECRET", "screamingclaw-secret"],
  ] as const)(
    "accepts %s, warns once, and never logs its value",
    (key, value) => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv(key, value);

      expect(
        envStr("AGENTSEO_TEST_SECRET", "SCREAMINGCLAW_TEST_SECRET", "fallback"),
      ).toBe(value);
      expect(
        envStr("AGENTSEO_TEST_SECRET", "SCREAMINGCLAW_TEST_SECRET", "fallback"),
      ).toBe(value);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0]?.join(" ")).toContain(key);
      expect(warning.mock.calls[0]?.join(" ")).toContain(
        "AGENTSEO_TEST_SECRET",
      );
      expect(warning.mock.calls[0]?.join(" ")).not.toContain(value);
    },
  );

  it("uses the documented legacy priority order", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("GOLEMSEO_TEST_SECRET", "first");
    vi.stubEnv("GOLEM_SEO_TEST_SECRET", "second");
    vi.stubEnv("SCREAMINGCLAW_TEST_SECRET", "third");

    expect(
      envStr("AGENTSEO_TEST_SECRET", "SCREAMINGCLAW_TEST_SECRET", "fallback"),
    ).toBe("first");
  });

  it("applies the same compatibility rules to booleans and integers", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("GOLEMSEO_TEST_BOOL", "true");
    vi.stubEnv("GOLEM_SEO_TEST_INT", "42");

    expect(envBool("AGENTSEO_TEST_BOOL", "", false)).toBe(true);
    expect(envInt("AGENTSEO_TEST_INT", "", 1, 20)).toBe(20);
  });

  it("rejects noncanonical primary names", () => {
    vi.stubEnv("GOLEMSEO_TEST_SECRET", "legacy-value");
    expect(() => envStr("GOLEMSEO_TEST_SECRET", "", "fallback")).toThrow(
      /must start with AGENTSEO_/u,
    );
  });
});

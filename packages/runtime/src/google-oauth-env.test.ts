import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGoogleDesktopClientId } from "./google-oauth-env.js";

describe("Google desktop OAuth environment compatibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefers explicit configuration, then the canonical environment name", () => {
    vi.stubEnv(
      "MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID",
      "canonical-client.apps.googleusercontent.com",
    );
    vi.stubEnv(
      "GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID",
      "legacy-client.apps.googleusercontent.com",
    );
    vi.stubEnv(
      "GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID",
      "irregular-client.apps.googleusercontent.com",
    );
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      resolveGoogleDesktopClientId(
        "explicit-client.apps.googleusercontent.com",
      ),
    ).toBe("explicit-client.apps.googleusercontent.com");
    expect(resolveGoogleDesktopClientId()).toBe(
      "canonical-client.apps.googleusercontent.com",
    );
    expect(warning).not.toHaveBeenCalled();
  });

  it("warns once per selected legacy name without logging either value", () => {
    const legacyValue = "legacy-client-value-must-not-be-logged";
    const irregularValue = "irregular-client-value-must-not-be-logged";
    vi.stubEnv("MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID", "");
    vi.stubEnv("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID", legacyValue);
    vi.stubEnv("GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID", irregularValue);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(resolveGoogleDesktopClientId()).toBe(legacyValue);
    expect(resolveGoogleDesktopClientId()).toBe(legacyValue);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenLastCalledWith(
      "[marketingovo] env GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID is deprecated; use MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID instead",
    );

    vi.stubEnv("GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID", "");
    expect(resolveGoogleDesktopClientId()).toBe(irregularValue);
    expect(resolveGoogleDesktopClientId()).toBe(irregularValue);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenLastCalledWith(
      "[marketingovo] env GOLEM_SEO_GOOGLE_DESKTOP_CLIENT_ID is deprecated; use MARKETINGOVO_GOOGLE_DESKTOP_CLIENT_ID instead",
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(legacyValue);
    expect(JSON.stringify(warning.mock.calls)).not.toContain(irregularValue);
  });
});

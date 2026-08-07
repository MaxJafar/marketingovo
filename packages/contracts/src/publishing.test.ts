import { describe, expect, it } from "vitest";
import { checkPlatformFit, PLATFORM_CAPABILITIES } from "./publishing.js";

/**
 * These encode what the platforms physically accept, checked before a post is
 * scheduled rather than discovered at 09:00 by the provider refusing it.
 */
describe("platform fit", () => {
  const draft = (
    overrides: Partial<Parameters<typeof checkPlatformFit>[1]> = {},
  ) => ({
    body: "Short and fine.",
    attachmentCount: 0,
    publicAttachmentCount: 0,
    ...overrides,
  });

  it("accepts a short text post on the platforms that allow one", () => {
    for (const platform of ["telegram", "x", "facebook-page"] as const) {
      expect(checkPlatformFit(platform, draft())).toMatchObject({
        ok: true,
        problems: [],
      });
    }
  });

  it("refuses an over-length body rather than letting it be truncated", () => {
    const fit = checkPlatformFit("x", draft({ body: "a".repeat(281) }));
    // A post cut at 280 characters mid-word is published under the operator's
    // name and cannot be taken back, so this is a refusal not a warning.
    expect(fit.ok).toBe(false);
    expect(fit.problems[0]).toMatch(/281 characters and x accepts 280/i);
  });

  it("refuses a text-only Instagram post, because there is no such thing", () => {
    const fit = checkPlatformFit("instagram", draft());
    expect(fit.ok).toBe(false);
    expect(fit.problems).toContain(
      "instagram has no text-only post. Attach an image or video.",
    );
  });

  it("refuses Instagram media that only exists locally, and says why", () => {
    const fit = checkPlatformFit(
      "instagram",
      draft({ attachmentCount: 2, publicAttachmentCount: 0 }),
    );
    expect(fit.ok).toBe(false);
    // The defining constraint of the platform, in the operator's terms and
    // with both remedies named.
    expect(fit.problems.join(" ")).toMatch(/fetches media from a public URL/i);
    expect(fit.problems.join(" ")).toMatch(/your own storage|already host/i);
  });

  it("accepts Instagram once the media is publicly reachable", () => {
    expect(
      checkPlatformFit(
        "instagram",
        draft({
          body: "Launch day.",
          attachmentCount: 2,
          publicAttachmentCount: 2,
        }),
      ),
    ).toMatchObject({ ok: true, problems: [] });
  });

  it("does not require a public URL from platforms that take bytes", () => {
    expect(
      checkPlatformFit(
        "telegram",
        draft({ attachmentCount: 3, publicAttachmentCount: 0 }),
      ).ok,
    ).toBe(true);
  });

  it("reports every problem at once rather than the first", () => {
    // Someone fixing a post should learn everything wrong with it in one pass.
    const fit = checkPlatformFit(
      "x",
      draft({ body: "a".repeat(400), attachmentCount: 9 }),
    );
    expect(fit.problems).toHaveLength(2);
  });

  it("records only limits the providers actually document", () => {
    // Instagram publishes 25 per 24h; the others document no ceiling, and
    // inventing one would refuse posts the platform would have accepted.
    expect(PLATFORM_CAPABILITIES.instagram.dailyPostLimit).toBe(25);
    expect(PLATFORM_CAPABILITIES.telegram.dailyPostLimit).toBeNull();
    expect(PLATFORM_CAPABILITIES.x.dailyPostLimit).toBeNull();
    // Only Instagram refuses bytes; that single fact is why the media relay
    // exists at all.
    expect(
      Object.entries(PLATFORM_CAPABILITIES)
        .filter(([, limits]) => !limits.acceptsBytes)
        .map(([platform]) => platform),
    ).toEqual(["instagram"]);
  });
});

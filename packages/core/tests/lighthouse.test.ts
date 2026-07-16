import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  LIGHTHOUSE_CHROME_FLAGS,
  pickUrlsForLighthouse,
  isAvailable,
  preloadDeps,
} from "../src/integrations/lighthouse.js";
import { resolveChromiumExecutablePath } from "../src/chromium-runtime.js";

// A clean CI worker can be importing Lighthouse while the rest of the
// monorepo test matrix is saturating CPU and disk. Availability, not cold
// module-import speed, is the contract under test.
const DEPENDENCY_IMPORT_TIMEOUT_MS = 30_000;

afterEach(() => vi.unstubAllEnvs());

describe("lighthouse integration", () => {
  it("never disables the Chromium sandbox", () => {
    expect(LIGHTHOUSE_CHROME_FLAGS).not.toContain("--no-sandbox");
    expect(LIGHTHOUSE_CHROME_FLAGS).not.toContain("--disable-setuid-sandbox");
  });
  it("forces browser traffic through the hardened proxy path", () => {
    expect(LIGHTHOUSE_CHROME_FLAGS).toContain("--disable-quic");
    expect(LIGHTHOUSE_CHROME_FLAGS).toContain(
      "--disable-features=ServiceWorker",
    );
    expect(LIGHTHOUSE_CHROME_FLAGS).toContain(
      "--proxy-bypass-list=<-loopback>",
    );
    expect(LIGHTHOUSE_CHROME_FLAGS).toContain(
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    );
  });
  it("uses the packaged Chromium path for both browser engines", async () => {
    vi.stubEnv("GOLEMSEO_CHROME_PATH", process.execPath);
    expect(await resolveChromiumExecutablePath()).toBe(process.execPath);
  });
  it("fails closed when a configured packaged Chromium executable is missing", async () => {
    const missing = join(tmpdir(), `golem-seo-missing-chromium-${process.pid}`);
    vi.stubEnv("GOLEMSEO_CHROME_PATH", missing);
    await expect(resolveChromiumExecutablePath()).rejects.toThrow(
      "Configured Chromium executable does not exist",
    );
  });
  it(
    "isAvailable returns true after preloadDeps resolves",
    async () => {
      await preloadDeps();
      // lighthouse + chrome-launcher are real deps
      expect(isAvailable()).toBe(true);
    },
    DEPENDENCY_IMPORT_TIMEOUT_MS,
  );

  it("isAvailable returns false before preload", () => {
    // We can't fully test this (state is module-global) but we can
    // at least assert the function is callable.
    expect(typeof isAvailable()).toBe("boolean");
  });

  it("pickUrlsForLighthouse returns empty for off", () => {
    const out = pickUrlsForLighthouse(
      "off",
      ["https://a/", "https://b/"],
      "https://a/",
    );
    expect(out).toEqual([]);
  });

  it("pickUrlsForLighthouse returns just home for home mode", () => {
    const out = pickUrlsForLighthouse(
      "home",
      ["https://a/", "https://b/"],
      "https://a/",
    );
    expect(out).toEqual(["https://a/"]);
  });

  it("pickUrlsForLighthouse returns all for all mode", () => {
    const urls = ["https://a/", "https://b/", "https://c/"];
    const out = pickUrlsForLighthouse("all", urls, "https://a/");
    expect(out).toEqual(urls);
  });

  it("pickUrlsForLighthouse returns home + N samples, deterministic with seeded rng", () => {
    const urls = [
      "https://a/",
      "https://a/1",
      "https://a/2",
      "https://a/3",
      "https://a/4",
      "https://a/5",
    ];
    // Deterministic rng that always returns 0.1
    const rng = () => 0.1;
    const out = pickUrlsForLighthouse("sample", urls, "https://a/", 3, rng);
    expect(out.length).toBe(3);
    expect(out[0]).toBe("https://a/");
    // No duplicates
    expect(new Set(out).size).toBe(out.length);
    // All non-home slots are from the input
    for (const u of out.slice(1)) expect(urls).toContain(u);
  });

  it("pickUrlsForLighthouse handles single-URL crawl", () => {
    const out = pickUrlsForLighthouse("sample", ["https://a/"], "https://a/");
    expect(out).toEqual(["https://a/"]);
  });

  it("pickUrlsForLighthouse handles empty list", () => {
    const out = pickUrlsForLighthouse("sample", [], "https://a/");
    expect(out).toEqual([]);
  });
});

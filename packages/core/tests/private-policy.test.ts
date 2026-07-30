import { describe, expect, it } from "vitest";
import { StaticRenderer } from "../src/renderer.js";

const base = {
  timeoutMs: 100,
  maxBodyBytes: 1_024,
  userAgent: "marketingovo-private-policy-test",
  allowPrivate: true,
  enforcePrivateHostAllowlist: true,
  maxRedirects: 0,
};

describe("explicit private crawl policy", () => {
  it("does not implicitly trust the initial private host", async () => {
    const renderer = new StaticRenderer();
    try {
      await expect(
        renderer.render("http://127.0.0.1/", {
          ...base,
          privateHostAllowlist: ["intranet.example"],
        }),
      ).rejects.toThrow(/private\/loopback address blocked/i);
    } finally {
      await renderer.close();
    }
  });

  it("keeps cloud metadata blocked even when explicitly listed", async () => {
    const renderer = new StaticRenderer();
    try {
      await expect(
        renderer.render("http://169.254.169.254/latest/meta-data", {
          ...base,
          privateHostAllowlist: ["169.254.169.254"],
        }),
      ).rejects.toThrow(/cloud metadata address blocked/i);
    } finally {
      await renderer.close();
    }
  });

  it("honors a pre-aborted run signal before DNS or network work", async () => {
    const renderer = new StaticRenderer();
    const controller = new AbortController();
    controller.abort(new Error("cancelled by test"));
    try {
      await expect(
        renderer.render("https://example.com/", {
          ...base,
          allowPrivate: false,
          privateHostAllowlist: [],
          signal: controller.signal,
        }),
      ).rejects.toThrow("cancelled by test");
    } finally {
      await renderer.close();
    }
  });
});

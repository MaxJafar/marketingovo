import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applyExtraction,
  EXTRACTION_LIMITS,
  loadExtractors,
  previewExtraction,
  validateExtractorRules,
} from "../src/extraction.js";

describe("applyExtraction", () => {
  const html = `
    <html>
      <head>
        <title>Product page</title>
        <meta name="price" content="99.90">
      </head>
      <body>
        <span class="price">$99.90</span>
        <span class="sku">SKU-12345</span>
        <div class="stock" data-state="out-of-stock">Out of stock</div>
      </body>
    </html>`;

  it("extracts text, html, and attribute values", () => {
    const out = applyExtraction(html, [
      { label: "title", selector: "title", type: "text" },
      { label: "body_price", selector: ".price", type: "text" },
      {
        label: "meta_price",
        selector: 'meta[name="price"]',
        type: "attribute",
        attribute: "content",
      },
      { label: "first_div", selector: "div", type: "html" },
    ]);
    expect(out[0]).toEqual({ label: "title", value: "Product page" });
    expect(out[1]).toEqual({ label: "body_price", value: "$99.90" });
    expect(out[2]).toEqual({ label: "meta_price", value: "99.90" });
    expect(out[3]?.value).toContain("Out of stock");
  });

  it("applies a regex and keeps group 1 when present", () => {
    const out = applyExtraction(html, [
      { label: "sku", selector: ".sku", type: "text", regex: "SKU-(\\d+)" },
    ]);
    expect(out[0]).toEqual({ label: "sku", value: "12345" });
  });

  it("returns null when selector does not match", () => {
    const out = applyExtraction(html, [
      { label: "missing", selector: ".nope", type: "text" },
    ]);
    expect(out[0]).toEqual({ label: "missing", value: null });
  });

  it("handles malformed input gracefully", () => {
    const out = applyExtraction("", [
      { label: "x", selector: "a", type: "text" },
    ]);
    expect(out[0]).toEqual({ label: "x", value: null });
  });

  it("bounds captured values and reports truncation explicitly", () => {
    const out = applyExtraction(
      `<html><body><div class="large">${"x".repeat(
        EXTRACTION_LIMITS.maxValueChars + 10,
      )}</div></body></html>`,
      [{ label: "large", selector: ".large", type: "text" }],
    );
    expect(out[0]).toMatchObject({
      label: "large",
      truncated: true,
    });
    expect(out[0]?.value).toHaveLength(EXTRACTION_LIMITS.maxValueChars);
  });

  it("never executes an unsafe extraction regex", () => {
    expect(() =>
      applyExtraction(html, [
        {
          label: "unsafe",
          selector: ".sku",
          type: "text",
          regex: "(a+)+$",
        },
      ]),
    ).toThrow(/unsafe regex/);
  });
});

describe("loadExtractors", () => {
  const saved = process.env.SCREAMINGCLAW_EXTRACTORS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SCREAMINGCLAW_EXTRACTORS;
    else process.env.SCREAMINGCLAW_EXTRACTORS = saved;
  });
  beforeEach(() => delete process.env.SCREAMINGCLAW_EXTRACTORS);

  it("returns empty array when env is unset", () => {
    expect(loadExtractors()).toEqual([]);
  });

  it("parses rules from env JSON", () => {
    process.env.SCREAMINGCLAW_EXTRACTORS = JSON.stringify([
      { label: "p", selector: ".price", type: "text" },
      {
        label: "sku",
        selector: ".sku",
        type: "text",
        regex: "(\\d+)",
      },
    ]);
    const r = loadExtractors();
    expect(r).toHaveLength(2);
    expect(r[1]?.regex).toBe("(\\d+)");
  });

  it("rejects invalid JSON", () => {
    process.env.SCREAMINGCLAW_EXTRACTORS = "nope";
    expect(() => loadExtractors()).toThrow(/invalid JSON/);
  });

  it("rejects non-array input", () => {
    process.env.SCREAMINGCLAW_EXTRACTORS = '{"label":"x"}';
    expect(() => loadExtractors()).toThrow(/array/);
  });

  it("skips malformed rule entries", () => {
    process.env.SCREAMINGCLAW_EXTRACTORS = JSON.stringify([
      { label: "ok", selector: "a", type: "text" },
      { label: "bad" }, // missing selector
      { selector: "b", type: "text" }, // missing label
      { label: "badtype", selector: "c", type: "javascript" },
    ]);
    expect(loadExtractors()).toHaveLength(1);
  });

  it("rejects unsafe regex configuration before a crawl starts", () => {
    process.env.SCREAMINGCLAW_EXTRACTORS = JSON.stringify([
      {
        label: "unsafe",
        selector: "body",
        type: "text",
        regex: "(a+)+$",
      },
    ]);
    expect(() => loadExtractors()).toThrow(/unsafe regex/);
  });
});

describe("validateExtractorRules", () => {
  it("normalizes a complete rule set and rejects duplicate labels", () => {
    expect(
      validateExtractorRules([
        {
          label: " Price ",
          selector: " .price ",
          type: "attribute",
          attribute: " content ",
        },
      ]),
    ).toEqual([
      {
        label: "Price",
        selector: ".price",
        type: "attribute",
        attribute: "content",
      },
    ]);

    expect(() =>
      validateExtractorRules([
        { label: "Price", selector: ".price", type: "text" },
        { label: "price", selector: ".sale", type: "text" },
      ]),
    ).toThrow(/labels must be unique/i);
  });

  it("rejects invalid selectors and incomplete attribute rules before fetch", () => {
    expect(() =>
      validateExtractorRules([
        { label: "Broken", selector: "div[", type: "text" },
      ]),
    ).toThrow(/invalid CSS selector/i);
    expect(() =>
      validateExtractorRules([
        { label: "SKU", selector: "[data-sku]", type: "attribute" },
      ]),
    ).toThrow(/valid attribute name/i);
  });

  it("previews through the egress policy and requires exact private-host opt-in", async () => {
    const rules = [
      { label: "Price", selector: ".price", type: "text" as const },
    ];
    await expect(
      previewExtraction({
        url: "http://127.0.0.1:1/product",
        rules,
      }),
    ).rejects.toThrow(/private\/loopback address blocked/i);

    const optedInError = await previewExtraction({
      url: "http://127.0.0.1:1/product",
      allowPrivateHost: true,
      rules,
    }).catch((error: unknown) => error);
    expect(optedInError).toBeInstanceOf(Error);
    expect((optedInError as Error).message).toMatch(/network error/i);
    expect((optedInError as Error).message).not.toMatch(/private\/loopback/i);

    await expect(
      previewExtraction({
        url: "http://169.254.169.254/latest/meta-data/",
        allowPrivateHost: true,
        rules,
      }),
    ).rejects.toThrow(/cloud metadata address blocked/i);
  });
});

import { describe, it, expect } from "vitest";
import { parsePage } from "../src/parser.js";

describe("parsePage", () => {
  it("extracts title, meta, canonical, robots", () => {
    const html = `
      <html><head>
        <title>  Hello World  </title>
        <meta name="description" content="A page">
        <link rel="canonical" href="https://example.com/x">
        <meta name="robots" content="index, follow">
      </head><body></body></html>`;
    const p = parsePage(html, "https://example.com/x");
    expect(p.title).toBe("Hello World");
    expect(p.metaDescription).toBe("A page");
    expect(p.canonical).toBe("https://example.com/x");
    expect(p.robotsMeta).toBe("index, follow");
  });

  it("combines generic and Googlebot robots directives", () => {
    const parsed = parsePage(
      '<html><head><meta name="ROBOTS" content="index, follow"><meta name="googlebot" content="noindex"></head></html>',
      "https://example.com/",
    );
    expect(parsed.robotsMeta).toBe("index, follow, noindex");
  });

  it("extracts H1, H2, viewport", () => {
    const html = `
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head><body>
        <h1>One</h1>
        <h2>Sub</h2>
        <h2>Sub 2</h2>
      </body></html>`;
    const p = parsePage(html, "https://example.com/");
    expect(p.h1).toEqual(["One"]);
    expect(p.h2).toEqual(["Sub", "Sub 2"]);
    expect(p.hasViewport).toBe(true);
  });

  it("classifies links internal vs external", () => {
    const html = `
      <html><body>
        <a href="/a">a</a>
        <a href="https://example.com/b">b</a>
        <a href="https://other.com/c">c</a>
        <a href="#frag">frag</a>
        <a href="javascript:alert(1)">x</a>
        <a href="mailto:x@y">m</a>
      </body></html>`;
    const p = parsePage(html, "https://example.com/");
    expect(p.internalLinks.sort()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(p.externalLinks).toEqual(["https://other.com/c"]);
  });

  it("flags nofollow links separately", () => {
    const html = `
      <html><body>
        <a href="/a">a</a>
        <a href="/b" rel="nofollow">b</a>
        <a href="/c" rel="sponsored nofollow">c</a>
      </body></html>`;
    const p = parsePage(html, "https://example.com/");
    expect(p.nofollowLinks.sort()).toEqual([
      "https://example.com/b",
      "https://example.com/c",
    ]);
    expect(p.internalLinks.sort()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ]);
  });

  it("captures immutable internal-link evidence without evaluating markup", () => {
    const html = `
      <html><body>
        <header><a href="/pricing#plans">  Pricing plans  </a></header>
        <main>
          <a href="/pricing" rel="nofollow">Compare pricing</a>
          <nav><a href="/docs">Docs</a></nav>
        </main>
      </body></html>`;
    const parsed = parsePage(html, "https://example.com/");

    expect(parsed.internalLinkDetails).toEqual([
      {
        targetUrl: "https://example.com/pricing#plans",
        anchorText: "Pricing plans",
        nofollow: false,
        placement: "header",
      },
      {
        targetUrl: "https://example.com/pricing",
        anchorText: "Compare pricing",
        nofollow: true,
        placement: "main",
      },
      {
        targetUrl: "https://example.com/docs",
        anchorText: "Docs",
        nofollow: false,
        placement: "navigation",
      },
    ]);
  });

  it("extracts images and detects missing alt", () => {
    const html = `
      <html><body>
        <img src="/a.jpg" alt="A">
        <img src="/b.jpg">
      </body></html>`;
    const p = parsePage(html, "https://example.com/");
    expect(p.images).toEqual([
      { src: "/a.jpg", alt: "A" },
      { src: "/b.jpg", alt: null },
    ]);
  });

  it("extracts hreflang pairs", () => {
    const html = `
      <html><head>
        <link rel="alternate" hreflang="en" href="https://example.com/en">
        <link rel="alternate" hreflang="de" href="https://example.com/de">
      </head></html>`;
    const p = parsePage(html, "https://example.com/");
    expect(p.hreflang).toEqual([
      { lang: "en", href: "https://example.com/en" },
      { lang: "de", href: "https://example.com/de" },
    ]);
  });

  it("counts words and extracts json-ld", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@context":"https://schema.org"}</script>
      </head><body>
        <p>one two three four five</p>
        <script>doNotCount()</script>
      </body></html>`;
    const p = parsePage(html, "https://example.com/");
    // textContent includes script content too in linkedom; we are
    // counting crude words for a thin-content signal, not exactness.
    expect(p.wordCount).toBeGreaterThanOrEqual(5);
    expect(p.jsonLd).toEqual(['{"@context":"https://schema.org"}']);
  });

  it("handles empty and malformed input safely", () => {
    expect(() => parsePage("", "https://example.com/")).not.toThrow();
    expect(() =>
      parsePage("<not really html", "https://example.com/"),
    ).not.toThrow();
  });
});

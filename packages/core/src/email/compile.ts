// Source HTML in, sendable email out.
//
// The order matters and is not arbitrary:
//
//   inline → sanitize → validate
//
// Inlining first means the sanitizer sees the style attributes the stylesheet
// produced, so `expression()` hidden in a `<style>` block is caught after it
// lands on an element rather than only where it was written. Sanitizing before
// validating means the report describes the document an operator will actually
// export, not the one they submitted.

import { inlineEmailCss } from "./inline.js";
import { sanitizeEmailHtml } from "./sanitize.js";
import {
  PREHEADER_MARKER,
  toPlainText,
  validateEmailHtml,
  type EmailBrandExpectations,
  type EmailFinding,
  type EmailValidationReport,
} from "./validate.js";

export interface CompileEmailOptions {
  html: string;
  subject: string;
  preheader?: string;
  brand?: EmailBrandExpectations | undefined;
}

export interface CompiledEmail {
  subject: string;
  preheader: string;
  compiledHtml: string;
  plainText: string;
  report: EmailValidationReport;
}

/**
 * The preheader element.
 *
 * Hidden text at the top of the body, which every inbox reads for the preview
 * line. The trailing run of zero-width joiners is the standard trick: without
 * it, clients keep scraping past the preheader and append whatever text comes
 * next, so the preview reads "Your order shipped View in browser Unsubscribe".
 */
function preheaderMarkup(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const spacer = "&#847;&zwnj;&nbsp;".repeat(60);
  return (
    `<div ${PREHEADER_MARKER} style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">` +
    `${escaped}${spacer}</div>`
  );
}

export function compileEmail(options: CompileEmailOptions): CompiledEmail {
  const preheader = (options.preheader ?? "").trim();
  const inlined = inlineEmailCss(options.html);
  const sanitized = sanitizeEmailHtml(inlined.html, {
    retainedCss: inlined.retainedCss,
  });

  let html = sanitized.html;
  if (preheader) {
    // Injected after sanitizing so the markup is ours and known-safe; the text
    // itself is escaped above.
    html = html.replace(/(<body[^>]*>)/i, `$1${preheaderMarkup(preheader)}`);
  }

  const findings: EmailFinding[] = sanitized.findings.map((finding) => ({
    rule: finding.rule,
    // Anything the sanitizer removed changed the document, which is the one
    // category an author must read before exporting: what they wrote is not
    // what they now have.
    severity: "blocking" as const,
    message: finding.message,
    where: finding.where,
    remedy: "Rewrite that part without the removed element or attribute.",
    affects: ["all clients"],
  }));

  if (inlined.unusedSelectors.length > 0) {
    findings.push({
      rule: "email.unused-selector",
      severity: "info",
      message: `${inlined.unusedSelectors.length} selector(s) matched nothing and were dropped: ${inlined.unusedSelectors.slice(0, 5).join(", ")}.`,
      where: null,
      remedy:
        "Usually a typo in a class name, or a rule left over from an earlier draft.",
      affects: ["nothing — the styles simply had no effect"],
    });
  }

  const report = validateEmailHtml({
    html,
    preheader,
    subject: options.subject,
    brand: options.brand,
    priorFindings: findings,
  });

  return {
    subject: options.subject,
    preheader,
    compiledHtml: html,
    plainText: toPlainText(html),
    report,
  };
}

/**
 * A starting document that already satisfies the validator.
 *
 * Offered to an agent as a base, because the fastest way to get a
 * client-safe email is to start from one rather than to write markup and
 * discover Outlook's constraints one finding at a time. The table nesting and
 * the mso conditional are the standard shape every email framework converges
 * on, for the same reasons.
 */
export function starterEmailHtml(brand: {
  contentWidthPx: number;
  bodyFont: string;
  headingFont: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  companyName: string;
  postalAddress: string;
  unsubscribePlaceholder: string;
}): string {
  return `<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${brand.background};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${brand.background};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="${brand.contentWidthPx}" cellpadding="0" cellspacing="0" border="0" style="width:${brand.contentWidthPx}px;max-width:100%;background-color:${brand.surface};">
          <tr>
            <td style="padding:32px;font-family:${brand.bodyFont};font-size:16px;line-height:1.5;color:${brand.text};background-color:${brand.surface};">
              <h1 style="margin:0 0 16px;font-family:${brand.headingFont};font-size:24px;line-height:1.3;color:${brand.text};">Headline</h1>
              <p style="margin:0 0 16px;">Body copy.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${brand.accent};">
                    <a href="https://example.com" style="display:inline-block;padding:12px 24px;font-family:${brand.bodyFont};font-size:16px;color:${brand.surface};text-decoration:none;">Call to action</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;font-family:${brand.bodyFont};font-size:12px;line-height:1.5;color:${brand.text};background-color:${brand.surface};">
              <p style="margin:0 0 8px;">${brand.companyName}</p>
              <p style="margin:0 0 8px;">${brand.postalAddress}</p>
              <p style="margin:0;"><a href="${brand.unsubscribePlaceholder}" style="color:${brand.text};">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

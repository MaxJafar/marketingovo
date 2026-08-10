// What actually breaks in real inboxes.
//
// Every rule here exists because a specific client does a specific thing, and
// each message says which client and what it does. "Invalid CSS" teaches an
// author nothing; "Outlook on Windows renders with Microsoft Word, which has
// no flexbox, so this row will stack" tells them what to write instead.
//
// That specificity is not decoration. An agent iterating against this report
// is the intended user, and a model can act on a named client behaviour far
// more reliably than on a generic complaint.

import { parseHTML } from "linkedom";

export interface EmailFinding {
  rule: string;
  severity: "blocking" | "error" | "warning" | "info";
  message: string;
  where: string | null;
  remedy: string | null;
  affects: string[];
}

/**
 * Gmail's clipping threshold.
 *
 * Past this, Gmail truncates the message and shows a "View entire message"
 * link — which drops everything after the cut, usually including the
 * unsubscribe link, and breaks open tracking for anyone who does not click
 * through.
 */
export const GMAIL_CLIP_BYTES = 102 * 1024;

/** The Word engine behind Outlook on Windows has no notion of these. */
const OUTLOOK_UNSUPPORTED_PROPERTIES = new Map<string, string>([
  ["display", "flex and grid values are ignored; the children stack"],
  ["position", "absolute and fixed positioning are ignored"],
  ["float", "floats are unreliable and often collapse the layout"],
  ["flex", "flexbox is not implemented"],
  ["flex-direction", "flexbox is not implemented"],
  ["justify-content", "flexbox is not implemented"],
  ["align-items", "flexbox is not implemented"],
  ["gap", "gap has no effect outside flex and grid, which are unsupported"],
  ["grid-template-columns", "grid is not implemented"],
  ["box-shadow", "shadows are dropped"],
  ["text-shadow", "shadows are dropped"],
  ["transform", "transforms are dropped"],
  ["transition", "transitions do nothing in a static renderer"],
  ["animation", "animations do nothing in a static renderer"],
  ["object-fit", "object-fit is ignored, so the image is stretched"],
]);

// `max-width` is deliberately absent from that list. Outlook does ignore it,
// but `max-width: 100%` on an image or a wrapper table is the standard
// responsive-email pattern and is already paired with an explicit width. A
// rule that fires on correct markup teaches people to ignore the report.

/**
 * Marks the preheader block the compiler injects.
 *
 * It is hidden with `display:none` and `max-height:0`, which are exactly the
 * declarations several rules below look for. Validating our own known-good
 * markup would produce findings nobody can act on.
 */
export const PREHEADER_MARKER = "data-marketingovo-preheader";

function pathTo(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 5) {
    const tag = current.tagName?.toLowerCase() ?? "?";
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter(
        (child) => child.tagName === current!.tagName,
      );
      const index = siblings.indexOf(current);
      parts.unshift(
        siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag,
      );
    } else {
      parts.unshift(tag);
    }
    current = parent;
    depth += 1;
  }
  return parts.join(" > ");
}

function declarationsOf(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of style.split(";")) {
    const separator = part.indexOf(":");
    if (separator < 1) continue;
    map.set(
      part.slice(0, separator).trim().toLowerCase(),
      part
        .slice(separator + 1)
        .trim()
        .toLowerCase(),
    );
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

export function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1]!;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.04045
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const first = parseHexColor(foreground);
  const second = parseHexColor(background);
  if (!first || !second) return null;
  const brighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (brighter + 0.05) / (darker + 0.05);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface EmailBrandExpectations {
  /** Hex colours the brand allows, lowercased. Empty disables the check. */
  colors: string[];
  /** Font stacks the brand allows, lowercased. Empty disables the check. */
  fontStacks: string[];
  contentWidthPx: number;
  unsubscribePlaceholder: string;
  postalAddress: string;
}

export interface ValidateEmailOptions {
  html: string;
  preheader: string;
  subject: string;
  brand?: EmailBrandExpectations | undefined;
  /** Findings the sanitizer already produced, folded into one report. */
  priorFindings?: readonly EmailFinding[];
}

export interface EmailValidationReport {
  ok: boolean;
  findings: EmailFinding[];
  sizeBytes: number;
  gmailClips: boolean;
  counts: { blocking: number; error: number; warning: number; info: number };
}

export function validateEmailHtml(
  options: ValidateEmailOptions,
): EmailValidationReport {
  const findings: EmailFinding[] = [...(options.priorFindings ?? [])];
  const { document } = parseHTML(options.html);
  const add = (finding: EmailFinding): void => {
    if (findings.length < 300) findings.push(finding);
  };

  /* --- Structure a client needs before it renders predictably ------- */

  if (!options.preheader.trim()) {
    add({
      rule: "email.missing-preheader",
      severity: "warning",
      message:
        "No preheader. Inboxes fill that line by scraping the first text in the body, which is usually a 'view in browser' link or an image alt.",
      where: null,
      remedy:
        "Add a short preheader summarizing the email. It is the only preview a recipient reads before deciding to open.",
      affects: ["Gmail", "Apple Mail", "Outlook"],
    });
  }
  if (options.subject.length > 78) {
    add({
      rule: "email.long-subject",
      severity: "info",
      message: `The subject is ${options.subject.length} characters, and most inboxes truncate around 60 on desktop and fewer on mobile.`,
      where: null,
      remedy: "Front-load the meaning in the first 40 characters.",
      affects: ["Gmail", "Apple Mail"],
    });
  }

  /* --- Images ------------------------------------------------------- */

  for (const image of [...document.querySelectorAll("img")]) {
    const where = pathTo(image);
    if (image.getAttribute("alt") === null) {
      add({
        rule: "email.image-missing-alt",
        severity: "error",
        message:
          "This image has no alt attribute. Outlook blocks remote images by default, so the alt text is what most recipients see first.",
        where,
        remedy:
          'Add alt text describing the image, or alt="" if it is purely decorative.',
        affects: ["Outlook", "Gmail", "screen readers"],
      });
    }
    if (!image.getAttribute("width")) {
      add({
        rule: "email.image-missing-width",
        severity: "warning",
        message:
          "This image has no width attribute. Outlook sizes a blocked image from the attribute, and without one the placeholder collapses and the layout shifts.",
        where,
        remedy: "Set width as an HTML attribute in pixels, not only in CSS.",
        affects: ["Outlook"],
      });
    }
    const source = image.getAttribute("src") ?? "";
    if (source && !source.startsWith("https://")) {
      add({
        rule: "email.image-not-https",
        severity: "error",
        message:
          "This image is not served over https, so clients will refuse to load it or warn the recipient.",
        where,
        remedy: "Host the image at an https URL.",
        affects: ["Gmail", "Apple Mail", "Outlook"],
      });
    }
  }

  /* --- Layout ------------------------------------------------------- */

  for (const table of [...document.querySelectorAll("table")]) {
    if (!table.getAttribute("role")) {
      add({
        rule: "email.table-missing-role",
        severity: "warning",
        message:
          'A layout table without role="presentation" is announced as a data table, so a screen reader reads out row and column positions that mean nothing.',
        where: pathTo(table),
        remedy: 'Add role="presentation" to tables used for layout.',
        affects: ["screen readers"],
      });
    }
  }

  for (const element of [...document.querySelectorAll("[style]")]) {
    // Our own preheader is hidden with exactly the declarations several rules
    // below look for, and reporting on markup the compiler wrote would be
    // noise nobody can act on.
    if (element.hasAttribute(PREHEADER_MARKER)) continue;
    const declarations = declarationsOf(element.getAttribute("style") ?? "");
    const where = pathTo(element);

    for (const [property, consequence] of OUTLOOK_UNSUPPORTED_PROPERTIES) {
      const value = declarations.get(property);
      if (value === undefined) continue;
      // `display: block` and `position: static` are fine; only the values
      // Word cannot do are worth reporting.
      if (
        property === "display" &&
        !/flex|grid|inline-grid|inline-flex/.test(value)
      ) {
        continue;
      }
      if (property === "position" && !/absolute|fixed|sticky/.test(value)) {
        continue;
      }
      add({
        rule: "email.outlook-unsupported",
        severity:
          property === "display" || property === "position"
            ? "error"
            : "warning",
        message: `Outlook on Windows renders with Microsoft Word: ${consequence}.`,
        where,
        remedy:
          property === "display" || property === "float"
            ? "Lay this out with nested tables and table cells instead."
            : "Keep it as a progressive enhancement and make sure the design works without it.",
        affects: ["Outlook 2016–2021", "Outlook on Windows"],
      });
    }

    if (declarations.has("background-image")) {
      add({
        rule: "email.background-image",
        severity: "warning",
        message:
          "Outlook ignores CSS background images, so anything relying on this will show the background colour instead.",
        where,
        remedy:
          "Set a background-color that the design still works against, or use a VML fallback.",
        affects: ["Outlook on Windows"],
      });
    }

    // Contrast, where both colours are stated on the same element.
    const color = declarations.get("color");
    const background = declarations.get("background-color");
    if (color && background) {
      const ratio = contrastRatio(color, background);
      if (ratio !== null && ratio < 4.5) {
        add({
          rule: "email.low-contrast",
          severity: ratio < 3 ? "error" : "warning",
          message: `Text contrast is ${ratio.toFixed(2)}:1 against its background, below the 4.5:1 WCAG AA threshold for body text.`,
          where,
          remedy:
            "Darken the text or lighten the background until the ratio reaches 4.5:1.",
          affects: ["all clients", "low-vision readers"],
        });
      }
    }
  }

  /* --- Links -------------------------------------------------------- */

  for (const anchor of [...document.querySelectorAll("a")]) {
    const href = anchor.getAttribute("href") ?? "";
    if (!href) continue;
    if (!(anchor.textContent ?? "").trim() && !anchor.querySelector("img")) {
      add({
        rule: "email.empty-link",
        severity: "warning",
        message:
          "This link has neither text nor an image, so nothing is clickable.",
        where: pathTo(anchor),
        remedy: "Give the link visible text, or remove it.",
        affects: ["all clients"],
      });
    }
  }

  /* --- Legal and brand --------------------------------------------- */

  const text = document.body?.textContent ?? "";
  const html = options.html;
  if (options.brand) {
    const brand = options.brand;
    if (
      brand.unsubscribePlaceholder &&
      !html.includes(brand.unsubscribePlaceholder)
    ) {
      add({
        rule: "email.missing-unsubscribe",
        severity: "error",
        message: `The unsubscribe placeholder ${brand.unsubscribePlaceholder} does not appear anywhere in the email. Commercial mail is required to carry a working unsubscribe mechanism.`,
        where: null,
        remedy: `Add a link whose href is ${brand.unsubscribePlaceholder} so your ESP substitutes the real URL at send time.`,
        affects: ["CAN-SPAM", "GDPR", "your sending reputation"],
      });
    }
    if (
      brand.postalAddress &&
      !text.includes(brand.postalAddress.split("\n")[0]!.trim())
    ) {
      add({
        rule: "email.missing-postal-address",
        severity: "error",
        message:
          "The brand's postal address does not appear in the email. A physical mailing address is legally required in commercial mail in most jurisdictions.",
        where: null,
        remedy: "Add the postal address from the brand kit to the footer.",
        affects: ["CAN-SPAM"],
      });
    }

    if (brand.colors.length > 0) {
      const used = new Set(
        (html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((value) =>
          value.toLowerCase(),
        ),
      );
      const offBrand = [...used].filter(
        (value) => !brand.colors.includes(value),
      );
      if (offBrand.length > 0) {
        add({
          rule: "email.off-brand-color",
          severity: "info",
          message: `${offBrand.length} colour(s) are not in the brand kit: ${offBrand.slice(0, 6).join(", ")}.`,
          where: null,
          // Reported, never corrected: a shade outside the palette is often a
          // deliberate choice, and silently rewriting it would change a design
          // decision without telling anyone.
          remedy:
            "Replace them with brand colours, or add them to the brand kit if they belong there.",
          affects: ["brand consistency"],
        });
      }
    }

    if (brand.fontStacks.length > 0) {
      const declaredStacks = [
        ...html.matchAll(/font-family\s*:\s*([^;"']+)/gi),
      ].map((match) => match[1]!.trim().toLowerCase());
      const offBrand = declaredStacks.filter(
        (stack) =>
          !brand.fontStacks.some((allowed) =>
            stack.startsWith(allowed.slice(0, 20)),
          ),
      );
      if (offBrand.length > 0) {
        add({
          rule: "email.off-brand-font",
          severity: "info",
          message: `${offBrand.length} font stack(s) do not match the brand kit.`,
          where: null,
          remedy: "Use the heading and body stacks defined in the brand kit.",
          affects: ["brand consistency"],
        });
      }
      for (const stack of declaredStacks) {
        if (!/(sans-serif|serif|monospace|cursive|fantasy)\s*$/.test(stack)) {
          add({
            rule: "email.font-stack-no-fallback",
            severity: "warning",
            message: `The stack "${stack.slice(0, 60)}" ends without a generic family. Outlook and several mobile clients ignore web fonts, and with nothing left to fall back to they pick their own default.`,
            where: null,
            remedy: "End every font stack with sans-serif, serif or monospace.",
            affects: ["Outlook", "Gmail mobile"],
          });
          break;
        }
      }
    }
  }

  /* --- Size --------------------------------------------------------- */

  const sizeBytes = Buffer.byteLength(options.html, "utf8");
  const gmailClips = sizeBytes > GMAIL_CLIP_BYTES;
  if (gmailClips) {
    add({
      rule: "email.gmail-clipping",
      severity: "error",
      message: `The compiled email is ${Math.round(sizeBytes / 1024)}KB and Gmail clips above ${Math.round(GMAIL_CLIP_BYTES / 1024)}KB, hiding everything past the cut behind a "view entire message" link — usually including the footer and the unsubscribe link.`,
      where: null,
      remedy:
        "Shorten the copy, remove repeated inline styles, or move long content to a landing page.",
      affects: ["Gmail"],
    });
  }

  const counts = {
    blocking: findings.filter((finding) => finding.severity === "blocking")
      .length,
    error: findings.filter((finding) => finding.severity === "error").length,
    warning: findings.filter((finding) => finding.severity === "warning")
      .length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };

  return {
    // `ok` means nothing will visibly break. Warnings and info do not block,
    // because a template that fails on a brand-palette note would train
    // everyone to ignore the report.
    ok: counts.blocking === 0 && counts.error === 0,
    findings,
    sizeBytes,
    gmailClips,
    counts,
  };
}

/**
 * The plain-text alternative.
 *
 * Not optional in practice: a message with no text part scores worse with spam
 * filters, and it is the only version some clients and most screen readers on
 * older setups will show. Derived from the compiled document so the two can
 * never disagree about what the email says.
 */
export function toPlainText(html: string): string {
  const { document } = parseHTML(html);
  for (const element of [...document.querySelectorAll("style, head")]) {
    element.remove();
  }
  // Links carry their destination, because "click here" is meaningless once
  // the markup is gone.
  for (const anchor of [...document.querySelectorAll("a")]) {
    const href = anchor.getAttribute("href") ?? "";
    const label = (anchor.textContent ?? "").trim();
    if (href && label && !href.startsWith("mailto:")) {
      anchor.replaceWith(document.createTextNode(`${label} <${href}>`));
    }
  }
  for (const block of [
    ...document.querySelectorAll("p, div, tr, h1, h2, h3, h4, br, li"),
  ]) {
    block.append(document.createTextNode("\n"));
  }
  return (document.body?.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

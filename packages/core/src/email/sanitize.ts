// Making agent-authored HTML safe to keep.
//
// Everything that reaches this file is untrusted. It was written by a language
// model, possibly from copy that came off a web page, and it is about to be
// stored, previewed in a browser, and pasted into an email service that will
// send it to a list of real people. Any one of those is enough reason not to
// trust it; together they are the reason this runs before anything else.
//
// The parser is linkedom, which builds a DOM without executing scripts or
// fetching anything. Parsing with a regex instead is how sanitizers get
// bypassed, because an attacker writes the markup and the regex author only
// imagined some of it.
//
// Every removal is reported. A sanitizer that silently deletes half a document
// leaves an author debugging why their email is empty.

import { parseHTML } from "linkedom";

export interface SanitizeFinding {
  rule: string;
  message: string;
  where: string | null;
}

export interface SanitizeResult {
  html: string;
  findings: SanitizeFinding[];
}

/**
 * Elements that are removed with their contents.
 *
 * Two separate reasons, and both matter. `script`, `iframe`, `object`,
 * `embed`, `base` and `meta[http-equiv]` are unsafe to store and render.
 * `form`, `input`, `button`, `select` and `textarea` are safe but useless:
 * no major email client submits a form, so a "form" in an email is a control
 * that looks interactive and does nothing, which is worse than its absence.
 */
const FORBIDDEN_ELEMENTS = new Set([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "base",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "noscript",
  "template",
  "slot",
  "canvas",
  "audio",
  "video",
  "svg",
  "math",
  "link",
]);

/** Attributes carrying URLs, checked against the scheme allowlist below. */
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "srcset",
  "background",
  "action",
  "formaction",
  "poster",
  "cite",
  "longdesc",
  "usemap",
  "profile",
  "data",
  "codebase",
]);

/**
 * Schemes an email may link to.
 *
 * `mailto` and `tel` are ordinary in email. `data:` is deliberately absent
 * even for images: Gmail and Outlook both refuse data URIs, so one is a broken
 * image in most inboxes as well as a way to smuggle markup past a reviewer
 * reading the source.
 */
const ALLOWED_SCHEMES = new Set(["https:", "mailto:", "tel:"]);

/** A readable path to an element, for a finding an author has to locate. */
function pathTo(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 6) {
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

/**
 * Decides whether a URL may stay.
 *
 * Merge tags are the interesting case: an ESP's `{{unsubscribe_url}}` or
 * `*|UNSUB|*` is not a URL and never parses as one, but stripping it would
 * remove the legally required unsubscribe link from every template built here.
 * So a value that is entirely a merge tag is left alone, and anything else has
 * to be a real URL in an allowed scheme.
 */
function isAcceptableUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    /^(\{\{[^{}]{1,120}\}\}|\*\|[^|*]{1,120}\|\*|%%[^%]{1,120}%%|\$\{[^}]{1,120}\})$/.test(
      trimmed,
    )
  ) {
    return true;
  }
  // A relative URL in an email has no base to resolve against once it is in an
  // inbox, so it is not a working link anywhere.
  try {
    const url = new URL(trimmed);
    return ALLOWED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

const WHITESPACE = /^\s$/;

/**
 * Removes `name(...)` calls with a hand-rolled scan.
 *
 * This runs on hostile input, and the obvious regex — `name\s*\([^)]*\)` —
 * backtracks polynomially on unterminated calls, which hands an attacker a
 * CPU knob on the daemon. The scan is linear by construction, and it treats
 * an unterminated call as running to the end of the text, which is also what
 * a CSS parser would do.
 */
function stripCssCalls(
  source: string,
  name: string,
  replaceWith: string,
  isUnsafe: (inner: string) => boolean,
): { output: string; found: boolean } {
  const lower = source.toLowerCase();
  let output = "";
  let index = 0;
  let found = false;
  while (index < source.length) {
    const hit = lower.indexOf(name, index);
    if (hit === -1) {
      output += source.slice(index);
      break;
    }
    let cursor = hit + name.length;
    while (cursor < source.length && WHITESPACE.test(source[cursor]!))
      cursor += 1;
    if (source[cursor] !== "(") {
      output += source.slice(index, hit + name.length);
      index = hit + name.length;
      continue;
    }
    const close = source.indexOf(")", cursor + 1);
    const end = close === -1 ? source.length : close + 1;
    const inner = source.slice(
      cursor + 1,
      close === -1 ? source.length : close,
    );
    if (isUnsafe(inner)) {
      output += source.slice(index, hit) + replaceWith;
      found = true;
    } else {
      output += source.slice(index, end);
    }
    index = end;
  }
  return { output, found };
}

/** True when a `url(...)` body resolves to a scheme that executes or embeds. */
function unsafeUrlBody(inner: string): boolean {
  // Collapse quotes and every kind of whitespace before reading the scheme,
  // so padding cannot smuggle `javascript:` past a width-limited pattern.
  const normalized = inner.replace(/["'\s]+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:")
  );
}

/** Strips CSS that can execute or reach out, wherever it appears. */
export function sanitizeCssText(css: string): {
  css: string;
  removed: string[];
} {
  const removed: string[] = [];
  let output = css;

  // `expression()` executes JavaScript in old Outlook/IE rendering paths.
  const expressions = stripCssCalls(output, "expression", "", () => true);
  if (expressions.found) {
    removed.push("expression()");
    output = expressions.output;
  }
  // `behavior` and `-moz-binding` attach scripts to elements.
  if (/(behavior|-moz-binding)\s*:/i.test(output)) {
    removed.push("behavior");
    output = output.replace(/(behavior|-moz-binding)\s*:[^;}]*/gi, "");
  }
  // `@import` fetches a stylesheet, which no email client honours anyway.
  if (/@import/i.test(output)) {
    removed.push("@import");
    output = output.replace(/@import[^;]*;?/gi, "");
  }
  const urls = stripCssCalls(output, "url", "none", unsafeUrlBody);
  if (urls.found) {
    removed.push("unsafe url()");
    output = urls.output;
  }
  return { css: output, removed };
}

export interface SanitizeOptions {
  /** Retained style text, appended to the head after inlining. */
  retainedCss?: string;
}

/**
 * Parses, strips and re-serializes.
 *
 * Returns a full document rather than a fragment: an email is a document, and
 * clients that receive one without `<html>` and a charset guess at the
 * encoding, which is how a curly quote becomes three characters of noise.
 */
export function sanitizeEmailHtml(
  html: string,
  options: SanitizeOptions = {},
): SanitizeResult {
  const findings: SanitizeFinding[] = [];
  const { document } = parseHTML(
    html.includes("<html")
      ? html
      : `<!doctype html><html><body>${html}</body></html>`,
  );

  const report = (
    rule: string,
    message: string,
    where: string | null,
  ): void => {
    // One finding per rule per element is enough; a document with forty
    // stripped handlers should not produce forty lines to read.
    if (findings.length < 200) findings.push({ rule, message, where });
  };

  for (const element of [...document.querySelectorAll("*")]) {
    const tag = element.tagName?.toLowerCase() ?? "";

    if (FORBIDDEN_ELEMENTS.has(tag)) {
      report(
        "email.forbidden-element",
        tag === "form" || tag === "input" || tag === "button"
          ? `<${tag}> was removed. No major email client submits a form, so an interactive control in an email does nothing when a recipient uses it.`
          : `<${tag}> was removed because it cannot be safely stored or rendered in an email.`,
        pathTo(element),
      );
      element.remove();
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value ?? "";

      // Event handlers. Nothing runs them in an inbox, and they are the first
      // thing anyone tries when they want script into a stored document.
      if (name.startsWith("on")) {
        report(
          "email.event-handler",
          `The ${name} handler was removed. Email clients do not run scripts.`,
          pathTo(element),
        );
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "style") {
        const { css, removed } = sanitizeCssText(value);
        if (removed.length > 0) {
          report(
            "email.unsafe-css",
            `Removed ${removed.join(", ")} from an inline style.`,
            pathTo(element),
          );
          element.setAttribute("style", css);
        }
        continue;
      }

      if (URL_ATTRIBUTES.has(name) && !isAcceptableUrl(value)) {
        report(
          "email.unsafe-url",
          /^\s*(javascript|vbscript|data):/i.test(value)
            ? `A ${name} using an unsupported scheme was removed.`
            : `The ${name} value is not an absolute https, mailto or tel URL, and a relative link has nothing to resolve against once the message is in an inbox.`,
          pathTo(element),
        );
        element.removeAttribute(attribute.name);
      }
    }
  }

  // `<meta http-equiv="refresh">` survives the element sweep because `meta` is
  // legitimate for charset and viewport; only the redirecting form is removed.
  for (const meta of [...document.querySelectorAll("meta[http-equiv]")]) {
    const equiv = meta.getAttribute("http-equiv")?.toLowerCase() ?? "";
    if (equiv === "refresh" || equiv === "content-security-policy") {
      report(
        "email.forbidden-meta",
        `A meta http-equiv="${equiv}" was removed.`,
        pathTo(meta),
      );
      meta.remove();
    }
  }

  ensureDocumentFrame(document, options.retainedCss ?? "");

  return {
    html: `<!doctype html>\n${document.documentElement.outerHTML}`,
    findings,
  };
}

/**
 * Guarantees the parts a client needs before it will render predictably.
 *
 * A charset so text is not re-guessed, a viewport so mobile clients do not
 * zoom out, `lang` for screen readers, and the retained media queries that
 * could not be inlined.
 */
function ensureDocumentFrame(document: Document, retainedCss: string): void {
  const html = document.documentElement;
  if (!html.getAttribute("lang")) html.setAttribute("lang", "en");

  let head = document.querySelector("head");
  if (!head) {
    head = document.createElement("head");
    html.insertBefore(head, html.firstChild);
  }
  if (!head.querySelector("meta[charset]")) {
    const meta = document.createElement("meta");
    meta.setAttribute("charset", "utf-8");
    head.insertBefore(meta, head.firstChild);
  }
  if (!head.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    meta.setAttribute("content", "width=device-width, initial-scale=1");
    head.appendChild(meta);
  }
  if (retainedCss.trim()) {
    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.textContent = retainedCss;
    head.appendChild(style);
  }
}

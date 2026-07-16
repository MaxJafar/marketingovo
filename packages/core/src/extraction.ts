// Custom extraction. Operators define a set of CSS selectors and
// attribute names; the crawler pulls the first match per selector
// off every rendered page and stores the result on the page record.
// Inspired by Screaming Frog's "Custom Extraction" feature, but
// configured via JSON / env instead of a desktop UI.

import { parseHTML } from "linkedom";
import { envStr } from "./env.js";
import { buildUserAgent } from "./core/config.js";
import { loadLimits } from "./core/limits.js";
import { createRenderer } from "./renderer.js";
import {
  compileSafeCustomRuleRegex,
  limitCustomRuleRegexInput,
  validateCustomRuleRegex,
} from "./custom-rule-regex.js";

export const EXTRACTION_LIMITS = Object.freeze({
  maxRules: 50,
  maxValueChars: 20_000,
  maxLabelChars: 240,
  maxSelectorChars: 2_000,
  maxAttributeChars: 256,
});

export interface ExtractorRule {
  // Human label, e.g. "price", "author".
  label: string;
  // CSS selector (linkedom-compatible).
  selector: string;
  // What to extract: text, html, or an attribute name.
  type: "text" | "html" | "attribute";
  // Required when type === "attribute".
  attribute?: string;
  // Regex to run over the extracted string. Group 1 (if present) is
  // kept; otherwise the full match.
  regex?: string;
}

export interface ExtractedField {
  label: string;
  value: string | null;
  /** Present only when the captured value exceeded the public evidence limit. */
  truncated?: true;
}

export class ExtractorRuleError extends Error {
  readonly ruleIndex: number;
  readonly field: "label" | "selector" | "type" | "attribute" | "regex";

  constructor(
    message: string,
    ruleIndex: number,
    field: ExtractorRuleError["field"],
  ) {
    super(message);
    this.name = "ExtractorRuleError";
    this.ruleIndex = ruleIndex;
    this.field = field;
  }
}

/**
 * Validate the complete rule set once at a configuration boundary.
 *
 * CSS selectors are compiled against an inert document and regular
 * expressions pass through the bounded custom-rule language before any
 * marketer-controlled page content is evaluated.
 */
export function validateExtractorRules(
  rules: readonly ExtractorRule[],
): ExtractorRule[] {
  if (rules.length > EXTRACTION_LIMITS.maxRules) {
    throw new ExtractorRuleError(
      `At most ${EXTRACTION_LIMITS.maxRules} extraction rules are allowed.`,
      EXTRACTION_LIMITS.maxRules,
      "label",
    );
  }
  const inertDocument = parseHTML(
    "<!doctype html><html><body></body></html>",
  ).document;
  const labels = new Set<string>();
  return rules.map((candidate, ruleIndex) => {
    const label = candidate.label.trim();
    if (label.length === 0 || label.length > EXTRACTION_LIMITS.maxLabelChars) {
      throw new ExtractorRuleError(
        `Rule ${ruleIndex + 1} needs a label between 1 and ${EXTRACTION_LIMITS.maxLabelChars} characters.`,
        ruleIndex,
        "label",
      );
    }
    const labelKey = label.toLocaleLowerCase("en-US");
    if (labels.has(labelKey)) {
      throw new ExtractorRuleError(
        `Extraction rule labels must be unique; "${label}" is duplicated.`,
        ruleIndex,
        "label",
      );
    }
    labels.add(labelKey);

    const selector = candidate.selector.trim();
    if (
      selector.length === 0 ||
      selector.length > EXTRACTION_LIMITS.maxSelectorChars
    ) {
      throw new ExtractorRuleError(
        `Rule ${ruleIndex + 1} needs a CSS selector between 1 and ${EXTRACTION_LIMITS.maxSelectorChars} characters.`,
        ruleIndex,
        "selector",
      );
    }
    try {
      inertDocument.querySelector(selector);
    } catch {
      throw new ExtractorRuleError(
        `Rule ${ruleIndex + 1} contains an invalid CSS selector.`,
        ruleIndex,
        "selector",
      );
    }

    if (
      candidate.type !== "text" &&
      candidate.type !== "html" &&
      candidate.type !== "attribute"
    ) {
      throw new ExtractorRuleError(
        `Rule ${ruleIndex + 1} has an unsupported extraction type.`,
        ruleIndex,
        "type",
      );
    }

    const attribute = candidate.attribute?.trim();
    if (candidate.type === "attribute") {
      if (
        !attribute ||
        attribute.length > EXTRACTION_LIMITS.maxAttributeChars ||
        !/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(attribute)
      ) {
        throw new ExtractorRuleError(
          `Rule ${ruleIndex + 1} needs a valid attribute name of at most ${EXTRACTION_LIMITS.maxAttributeChars} characters.`,
          ruleIndex,
          "attribute",
        );
      }
    } else if (attribute) {
      throw new ExtractorRuleError(
        `Rule ${ruleIndex + 1} can define an attribute only when its type is attribute.`,
        ruleIndex,
        "attribute",
      );
    }

    if (candidate.regex !== undefined) {
      const validation = validateCustomRuleRegex(candidate.regex);
      if (!validation.safe) {
        throw new ExtractorRuleError(
          `Rule ${ruleIndex + 1}: ${validation.message}`,
          ruleIndex,
          "regex",
        );
      }
    }

    return {
      label,
      selector,
      type: candidate.type,
      ...(attribute ? { attribute } : {}),
      ...(candidate.regex !== undefined ? { regex: candidate.regex } : {}),
    };
  });
}

export interface ExtractionPreviewOptions {
  url: string;
  rules: readonly ExtractorRule[];
  renderMode?: "static" | "js";
  /** Explicit, exact private target opt-in. Cloud metadata remains blocked. */
  allowPrivateHost?: boolean;
  signal?: AbortSignal;
}

export interface ExtractionPreviewResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  renderMode: "static" | "js";
  responseTimeMs: number;
  fields: ExtractedField[];
}

/** Render exactly one page through the production egress policy and preview it. */
export async function previewExtraction(
  options: ExtractionPreviewOptions,
): Promise<ExtractionPreviewResult> {
  const rules = validateExtractorRules(options.rules);
  const limits = loadLimits();
  const renderMode = options.renderMode === "js" ? "js" : "static";
  const target = new URL(options.url);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Extraction preview accepts only HTTP or HTTPS URLs.");
  }
  target.hash = "";
  const renderer = await createRenderer(renderMode, limits);
  try {
    const rendered = await renderer.render(target.href, {
      timeoutMs: Math.min(limits.requestTimeoutMs, 30_000),
      maxBodyBytes: Math.min(limits.maxBodyBytes, 5 * 1024 * 1024),
      userAgent: buildUserAgent(limits.userAgent, ""),
      allowPrivate: options.allowPrivateHost === true,
      privateHostAllowlist:
        options.allowPrivateHost === true ? [target.hostname] : [],
      enforcePrivateHostAllowlist: true,
      maxRedirects: limits.maxRedirects,
      headers: {},
      signal: options.signal,
    });
    return {
      requestedUrl: target.href,
      finalUrl: rendered.finalUrl,
      statusCode: rendered.status,
      contentType: rendered.contentType,
      renderMode: rendered.renderMode,
      responseTimeMs: rendered.responseTimeMs,
      fields: applyExtraction(rendered.body.toString("utf8"), rules),
    };
  } finally {
    await renderer.close();
  }
}

export function applyExtraction(
  html: string,
  rules: ExtractorRule[],
): ExtractedField[] {
  if (rules.length === 0) return [];
  let document: ReturnType<typeof parseHTML>["document"];
  try {
    document = parseHTML(html).document;
  } catch {
    return rules.map((r) => ({ label: r.label, value: null }));
  }
  if (!document) {
    return rules.map((r) => ({ label: r.label, value: null }));
  }
  const out: ExtractedField[] = [];
  for (const rule of rules) {
    let value: string | null = null;
    const el = document.querySelector(rule.selector);
    if (el) {
      if (rule.type === "text") {
        value = (el.textContent ?? "").trim() || null;
      } else if (rule.type === "html") {
        value = el.innerHTML ?? null;
      } else if (rule.type === "attribute" && rule.attribute) {
        value = el.getAttribute(rule.attribute) ?? null;
      }
    }
    if (value && rule.regex) {
      const expression = compileSafeCustomRuleRegex(rule.regex);
      if (!expression)
        throw new Error(`Extractor ${rule.label} has an unsafe regex.`);
      const match = expression.exec(limitCustomRuleRegexInput(value));
      if (match) value = match[1] ?? match[0] ?? null;
    }
    if (value && value.length > EXTRACTION_LIMITS.maxValueChars) {
      out.push({
        label: rule.label,
        value: value.slice(0, EXTRACTION_LIMITS.maxValueChars),
        truncated: true,
      });
    } else {
      out.push({ label: rule.label, value });
    }
  }
  return out;
}

export function loadExtractors(): ExtractorRule[] {
  // Inline: SCREAMINGCLAW_EXTRACTORS = JSON array of rules.
  const raw = envStr("GOLEMSEO_EXTRACTORS", "SCREAMINGCLAW_EXTRACTORS", "");
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `SCREAMINGCLAW_EXTRACTORS: invalid JSON: ${(err as Error).message}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error("SCREAMINGCLAW_EXTRACTORS: expected JSON array");
  }
  if (parsed.length > EXTRACTION_LIMITS.maxRules) {
    throw new Error(
      `SCREAMINGCLAW_EXTRACTORS: at most ${EXTRACTION_LIMITS.maxRules} rules are allowed`,
    );
  }
  const out: ExtractorRule[] = [];
  for (const r of parsed) {
    if (
      r &&
      typeof r === "object" &&
      typeof (r as Record<string, unknown>).label === "string" &&
      typeof (r as Record<string, unknown>).selector === "string"
    ) {
      const label = (r as Record<string, unknown>).label as string;
      const selector = (r as Record<string, unknown>).selector as string;
      if (
        label.length === 0 ||
        label.length > EXTRACTION_LIMITS.maxLabelChars ||
        selector.length === 0 ||
        selector.length > EXTRACTION_LIMITS.maxSelectorChars
      ) {
        continue;
      }
      const t = (r as Record<string, unknown>).type;
      if (t !== "text" && t !== "html" && t !== "attribute") continue;
      const rule: ExtractorRule = {
        label,
        selector,
        type: t,
      };
      const attr = (r as Record<string, unknown>).attribute;
      if (typeof attr === "string") rule.attribute = attr;
      const re = (r as Record<string, unknown>).regex;
      if (typeof re === "string") {
        const validation = validateCustomRuleRegex(re);
        if (!validation.safe) {
          throw new Error(
            `SCREAMINGCLAW_EXTRACTORS: unsafe regex for ${label}: ${validation.message}`,
          );
        }
        rule.regex = re;
      }
      out.push(rule);
    }
  }
  return validateExtractorRules(out);
}

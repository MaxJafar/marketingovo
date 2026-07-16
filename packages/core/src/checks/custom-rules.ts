// Custom rules: operators can drop a custom-rules.json in the project
// root to add their own checks. Each rule is evaluated against every
// page in the crawl and contributes Issue(s) to the standard report.
//
// This is the "low-code" extension point. Without it, every project
// would have to maintain a fork; with it, most projects only edit JSON.
//
// Schema:
// {
//   "rules": [
//     {
//       "id": "legal-mention",                  // required, unique
//       "name": "Legal notice on every page",   // required, human label
//       "category": "Compliance",               // required
//       "priority": "High" | "Medium" | "Low",  // required
//       "match": "contains" | "regex" | "css-exists",  // required
//       "value": "Legal Notice",                // for "contains"
//       "pattern": "G-[A-Z0-9]{10}",            // for "regex"
//       "selector": "footer .legal",            // for "css-exists"
//       "expect": "present" | "absent",         // default "present"
//       "fix": "Add a link to /legal-notice/ in the page footer." // optional
//     }
//   ]
// }
//
// Match types:
//   contains   — pass if page text contains the `value` substring (case-insensitive)
//   regex      — pass if page text or raw html matches the `pattern` regex
//   css-exists — pass if the `selector` matches at least one DOM node
//
// expect="absent" inverts the result (e.g. "noindex on indexable pages" —
// the standard check is the inverse of this).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import {
  compileSafeCustomRuleRegex,
  limitCustomRuleRegexInput,
  validateCustomRuleRegex,
} from "../custom-rule-regex.js";
import type { CheckFn, CrawledPage, CrawlIndex, Issue } from "./index.js";

export const FILE_NAME = "custom-rules.json";

export interface CustomRule {
  id: string;
  name: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  match: "contains" | "regex" | "css-exists";
  value?: string;
  pattern?: string;
  selector?: string;
  expect?: "present" | "absent";
  fix?: string;
}

export interface CustomRulesFile {
  rules: CustomRule[];
}

export function loadCustomRules(projectRoot: string): CustomRule[] {
  if (!projectRoot) return [];
  const path = join(projectRoot, FILE_NAME);
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const file = parsed as CustomRulesFile;
  if (!Array.isArray(file.rules)) return [];
  const seenIds = new Set<string>();
  const out: CustomRule[] = [];
  for (const r of file.rules) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.id !== "string" || !r.id) continue;
    if (seenIds.has(r.id)) continue; // de-dupe; first wins
    if (typeof r.name !== "string" || !r.name) continue;
    if (typeof r.category !== "string" || !r.category) continue;
    if (
      r.priority !== "High" &&
      r.priority !== "Medium" &&
      r.priority !== "Low"
    )
      continue;
    if (
      r.match !== "contains" &&
      r.match !== "regex" &&
      r.match !== "css-exists"
    )
      continue;
    if (r.match === "contains" && typeof r.value !== "string") continue;
    if (r.match === "regex" && !validateCustomRuleRegex(r.pattern).safe)
      continue;
    if (r.match === "css-exists" && typeof r.selector !== "string") continue;
    if (
      r.expect !== undefined &&
      r.expect !== "present" &&
      r.expect !== "absent"
    )
      continue;
    seenIds.add(r.id);
    out.push({
      id: r.id,
      name: r.name,
      category: r.category,
      priority: r.priority,
      match: r.match,
      value: r.value,
      pattern: r.pattern,
      selector: r.selector,
      expect: r.expect ?? "present",
      fix: typeof r.fix === "string" ? r.fix : undefined,
    });
  }
  return out;
}

interface PreparedCustomRule {
  rule: CustomRule;
  regex: RegExp | null;
}

function evalRule(prepared: PreparedCustomRule, page: CrawledPage): boolean {
  const { rule } = prepared;
  const text = page.parsed?.text ?? "";
  const html = page.rawHtml ?? "";
  const expect = rule.expect ?? "present";
  let present = false;
  if (rule.match === "contains") {
    present = text.toLowerCase().includes((rule.value ?? "").toLowerCase());
  } else if (rule.match === "regex") {
    const re = prepared.regex;
    if (!re) return true; // invalid/unsafe rules fail closed before page work
    present =
      re.test(limitCustomRuleRegexInput(text)) ||
      re.test(limitCustomRuleRegexInput(html));
  } else {
    // css-exists — needs raw HTML
    if (!html) return true;
    try {
      const doc = parseHTML(html).document;
      present = doc.querySelectorAll(rule.selector ?? "").length > 0;
    } catch {
      return true;
    }
  }
  return expect === "present" ? present : !present;
}

// Build a single CheckFn that runs every loaded rule. We expect to be
// called once per crawl; the check factory captures the rules.
export function makeCustomRulesCheck(rules: CustomRule[]): CheckFn {
  // Callers may construct rules directly instead of using loadCustomRules().
  // Compile once here so no unsafe pattern reaches the per-page crawl loop.
  const preparedRules: PreparedCustomRule[] = [];
  for (const rule of rules) {
    if (rule.match !== "regex") {
      preparedRules.push({ rule, regex: null });
      continue;
    }
    const regex = compileSafeCustomRuleRegex(rule.pattern);
    if (regex) preparedRules.push({ rule, regex });
  }
  return function customRulesCheck(index: CrawlIndex): Issue[] {
    if (preparedRules.length === 0) return [];
    const out: Issue[] = [];
    for (const prepared of preparedRules) {
      const { rule } = prepared;
      const failures: string[] = [];
      for (const page of index.pages.values()) {
        if (page.status !== 200 || !page.parsed) continue;
        if (!evalRule(prepared, page)) failures.push(page.url);
      }
      if (failures.length === 0) continue;
      out.push({
        id: `custom-${rule.id}`,
        category: rule.category,
        priority: rule.priority,
        message: `[${rule.name}] ${failures.length} page(s) failed this rule.`,
        urls: failures,
        fix: rule.fix,
      });
    }
    return out;
  };
}

// Moving CSS into style attributes, because email clients throw the rest away.
//
// Gmail strips `<style>` from a forwarded or clipped message. Outlook.com
// rewrites selectors. Several mobile clients ignore stylesheets entirely. An
// inline `style` attribute is the only declaration every client honours, which
// is why every serious email pipeline inlines and why authoring inline by hand
// is miserable enough that nobody should.
//
// Media queries are the exception and must survive as a stylesheet: they
// cannot be expressed inline at all, and the clients that support them are
// exactly the ones that keep a `<style>` block. So they are separated out and
// re-attached rather than dropped.

import { parseHTML } from "linkedom";
import { sanitizeCssText } from "./sanitize.js";

export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

export interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
  /** (id, class, type) — CSS specificity, compared left to right. */
  specificity: [number, number, number];
  /** Source order, which breaks ties the way a browser does. */
  order: number;
}

export interface ParsedStylesheet {
  rules: CssRule[];
  /** Blocks that cannot be inlined and must stay in a style element. */
  retained: string;
}

/**
 * Strips comments with an index scan rather than `\/\*[\s\S]*?\*\//`, whose
 * lazy quantifier backtracks polynomially on hostile unterminated comments.
 * An unterminated comment runs to the end of the text, as CSS defines it.
 */
function stripComments(css: string): string {
  let output = "";
  let index = 0;
  while (index < css.length) {
    const start = css.indexOf("/*", index);
    if (start === -1) {
      output += css.slice(index);
      break;
    }
    output += css.slice(index, start) + " ";
    const end = css.indexOf("*/", start + 2);
    if (end === -1) break;
    index = end + 2;
  }
  return output;
}

function parseDeclarations(block: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const part of block.split(";")) {
    const separator = part.indexOf(":");
    if (separator < 1) continue;
    const property = part.slice(0, separator).trim().toLowerCase();
    let value = part.slice(separator + 1).trim();
    if (!property || !value) continue;
    const important = /!important$/i.test(value);
    if (important) value = value.replace(/!important$/i, "").trim();
    if (!value) continue;
    declarations.push({ property, value, important });
  }
  return declarations;
}

/**
 * CSS specificity for one selector.
 *
 * Approximate by design: the goal is to apply rules in the order a browser
 * would, not to implement the cascade exactly. Getting the common cases right
 * — an id beats a class beats a tag — is what stops a base rule overwriting
 * the override an author wrote to fix it.
 */
export function specificityOf(selector: string): [number, number, number] {
  // Bounded so a hostile run of unclosed brackets cannot make the regex
  // backtrack polynomially; a real attribute selector is far shorter, and an
  // absurd one merely keeps its literal characters in this approximation.
  const cleaned = selector.replace(/\[[^\]]{0,256}\]/g, " [] ");
  const ids = (cleaned.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (cleaned.match(/\.[\w-]+/g) ?? []).length +
    (cleaned.match(/\[\]/g) ?? []).length +
    (cleaned.match(/:(?!:)[\w-]+/g) ?? []).length;
  const types = (cleaned.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
}

/**
 * Splits a stylesheet into inlinable rules and blocks that must be retained.
 *
 * Anything inside an at-rule is retained whole. `@media` is the one that
 * matters for responsive email; `@font-face` is retained because it is the
 * only way a custom face reaches the clients that support one at all.
 */
export function parseStylesheet(css: string): ParsedStylesheet {
  const source = stripComments(sanitizeCssText(css).css);
  const rules: CssRule[] = [];
  const retained: string[] = [];
  let order = 0;
  let index = 0;

  while (index < source.length) {
    const braceStart = source.indexOf("{", index);
    if (braceStart < 0) break;
    const prelude = source.slice(index, braceStart).trim();

    if (prelude.startsWith("@")) {
      // Walk to the matching close brace, since at-rules nest.
      let depth = 0;
      let cursor = braceStart;
      for (; cursor < source.length; cursor += 1) {
        if (source[cursor] === "{") depth += 1;
        else if (source[cursor] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      retained.push(`${prelude} ${source.slice(braceStart, cursor + 1)}`);
      index = cursor + 1;
      continue;
    }

    const braceEnd = source.indexOf("}", braceStart);
    if (braceEnd < 0) break;
    const declarations = parseDeclarations(
      source.slice(braceStart + 1, braceEnd),
    );
    if (declarations.length > 0) {
      for (const selector of prelude.split(",")) {
        const trimmed = selector.trim();
        if (!trimmed) continue;
        // A pseudo-element or state has no inline equivalent — there is no way
        // to write `:hover` in a style attribute — so it is retained instead.
        if (/::|:hover|:focus|:active|:visited|:checked/i.test(trimmed)) {
          retained.push(
            `${trimmed} { ${serializeDeclarations(declarations)} }`,
          );
          continue;
        }
        rules.push({
          selector: trimmed,
          declarations,
          specificity: specificityOf(trimmed),
          order: order++,
        });
      }
    }
    index = braceEnd + 1;
  }

  return { rules, retained: retained.join("\n") };
}

function serializeDeclarations(
  declarations: readonly CssDeclaration[],
): string {
  return declarations
    .map(
      (declaration) =>
        `${declaration.property}: ${declaration.value}${declaration.important ? " !important" : ""}`,
    )
    .join("; ");
}

function compareRules(left: CssRule, right: CssRule): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = left.specificity[index]! - right.specificity[index]!;
    if (difference !== 0) return difference;
  }
  return left.order - right.order;
}

export interface InlineResult {
  html: string;
  /** Media queries, pseudo-classes and font faces, for the head. */
  retainedCss: string;
  /** Selectors that matched nothing, which usually means a typo. */
  unusedSelectors: string[];
}

/**
 * Inlines every stylesheet in the document.
 *
 * Rules are applied weakest first so the strongest wins by being written last,
 * and the author's own inline styles are re-applied at the very end: something
 * written directly on the element is the most specific statement of intent in
 * the document, and a stylesheet should not silently overrule it.
 */
export function inlineEmailCss(html: string): InlineResult {
  const { document } = parseHTML(
    html.includes("<html")
      ? html
      : `<!doctype html><html><body>${html}</body></html>`,
  );

  const rules: CssRule[] = [];
  const retained: string[] = [];
  for (const style of [...document.querySelectorAll("style")]) {
    const parsed = parseStylesheet(style.textContent ?? "");
    rules.push(...parsed.rules);
    if (parsed.retained.trim()) retained.push(parsed.retained);
    style.remove();
  }

  // Remember what the author wrote inline before anything is merged in.
  const authored = new Map<Element, string>();
  for (const element of [...document.querySelectorAll("[style]")]) {
    authored.set(element, element.getAttribute("style") ?? "");
  }

  const unused: string[] = [];
  for (const rule of [...rules].sort(compareRules)) {
    let matches: Element[];
    try {
      matches = [...document.querySelectorAll(rule.selector)];
    } catch {
      // An unsupported selector is the author's problem to see, not a reason
      // to abandon the whole stylesheet.
      unused.push(rule.selector);
      continue;
    }
    if (matches.length === 0) {
      unused.push(rule.selector);
      continue;
    }
    for (const element of matches) {
      const merged = mergeDeclarations(
        element.getAttribute("style") ?? "",
        rule.declarations,
      );
      element.setAttribute("style", merged);
    }
  }

  for (const [element, original] of authored) {
    if (!original.trim()) continue;
    element.setAttribute(
      "style",
      mergeDeclarations(
        element.getAttribute("style") ?? "",
        parseDeclarations(original),
      ),
    );
  }

  return {
    html: `<!doctype html>\n${document.documentElement.outerHTML}`,
    retainedCss: retained.join("\n"),
    unusedSelectors: [...new Set(unused)],
  };
}

/**
 * Merges incoming declarations over existing ones.
 *
 * A later declaration replaces an earlier one for the same property, except
 * that an existing `!important` holds — which is the one part of the cascade
 * an author reaches for precisely because they expect it to be respected.
 */
function mergeDeclarations(
  existing: string,
  incoming: readonly CssDeclaration[],
): string {
  const merged = new Map<string, CssDeclaration>();
  for (const declaration of parseDeclarations(existing)) {
    merged.set(declaration.property, declaration);
  }
  for (const declaration of incoming) {
    const current = merged.get(declaration.property);
    if (current?.important && !declaration.important) continue;
    merged.set(declaration.property, declaration);
  }
  return serializeDeclarations([...merged.values()]);
}

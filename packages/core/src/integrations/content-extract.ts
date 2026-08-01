// Main-content extractor. Given raw HTML, returns the visible text
// of the page's primary content (article / main / post body) with
// nav, footer, aside, script, and style stripped. Used by the
// content-gap tool to feed a clean corpus into TF-IDF.
//
// Strategy:
//   1. Parse with linkedom (we already do this elsewhere; it's fast
//      and safe — no JS execution).
//   2. If the document has an <article> or <main>, prefer it. We
//      try them in order: <article>, <main>, [role=main], <body>.
//   3. Within the chosen root, strip: <script>, <style>, <noscript>,
//      <template>, <svg>, <iframe>, <header>, <footer>, <nav>,
//      <aside>, <form>, [aria-hidden=true], [hidden].
//   4. Collect text nodes; collapse whitespace; decode HTML entities
//      (linkedom decodes them already).
//   5. Return both raw text and a flat list of words for TF-IDF.

import { parseHTML } from "linkedom";

const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "header",
  "footer",
  "nav",
  "aside",
  "form",
  "[aria-hidden=true]",
  "[hidden]",
  // Common ad / cookie-banner slots. We don't try to be exhaustive;
  // we just want to drop the obvious noise so the term frequency
  // doesn't get dominated by "Accept cookies" or "Advertisement".
  "[role=alertdialog]",
  "[id*=cookie i]",
  "[class*=cookie i]",
  "[id*=consent i]",
  "[class*=consent i]",
  "[id*=ad-]",
  "[class*=ad-]",
  "[id*=banner]",
  "[class*=banner]",
];

const PREFERRED_ROOTS = [
  "article",
  "main",
  "[role=main]",
  // Common CMS containers.
  "[role=article]",
  ".post-content",
  ".entry-content",
  ".article-body",
  ".post",
  ".article",
  ".content",
];

export interface ExtractedContent {
  /** Best-effort root tagname used. "body" means we fell back. */
  root: string;
  /** Plain visible text. */
  text: string;
  /** Lowercased word tokens, length >= 2, alpha-only. */
  words: string[];
  /** Total word count. */
  wordCount: number;
}

export function extractMainContent(html: string): ExtractedContent {
  const { document } = safeParse(html);
  const root = pickRoot(document);
  // Clone the root so we don't mutate the original document. We then
  // strip the noise subtrees.
  const scope = root.cloneNode(true) as typeof root;
  for (const sel of STRIP_SELECTORS) {
    for (const el of Array.from(scope.querySelectorAll(sel)) as Array<{
      remove: () => void;
    }>) {
      el.remove();
    }
  }
  // textContent concatenates descendants with no separator, so
  // `<h1>Marathon training</h1><p>Marathon ...` yields "trainingMarathon" —
  // a word that appears on no page, but which scores as a real term and
  // surfaces in the content-gap report as a topic the site is "missing".
  // Block elements end a run of text, so give each one an explicit boundary
  // before flattening. Inline elements are left alone: splitting inside
  // `an <em>important</em> point` would be just as wrong in the other
  // direction.
  separateBlocks(document, scope);
  const text = normalizeWhitespace(
    (scope as unknown as { textContent: string | null }).textContent ?? "",
  );
  const words = tokenize(text);
  return {
    root: (root.tagName ?? "body").toLowerCase(),
    text,
    words,
    wordCount: words.length,
  };
}

/**
 * Elements that end a run of text. Kept explicit rather than inferred from
 * styling, because the parsed document has no layout to consult.
 */
const BLOCK_TAGS =
  "address,article,aside,blockquote,br,dd,details,dialog,div,dl,dt," +
  "fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr," +
  "li,main,nav,ol,p,pre,section,summary,table,tbody,td,tfoot,th,thead," +
  "tr,ul";

function separateBlocks(
  document: ReturnType<typeof parseHTML>["document"],
  scope: Element,
): void {
  const create = (
    document as unknown as { createTextNode?: (data: string) => unknown }
  ).createTextNode;
  if (typeof create !== "function") return;
  for (const element of Array.from(
    scope.querySelectorAll(BLOCK_TAGS),
  ) as Array<{
    appendChild?: (node: unknown) => void;
  }>) {
    element.appendChild?.(create.call(document, " "));
  }
}

function pickRoot(document: ReturnType<typeof parseHTML>["document"]): Element {
  for (const sel of PREFERRED_ROOTS) {
    const found = document.querySelector(sel);
    if (found) return found;
  }
  return document.body;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set<string>([
  // English (compact; we accept "some noise" — TF-IDF downweights
  // common terms anyway; we just want to skip the very obvious).
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
  "i",
  "we",
  "they",
  "he",
  "she",
  "his",
  "her",
  "their",
  "our",
  "but",
  "if",
  "not",
  "do",
  "does",
  "did",
  "so",
  "no",
  "yes",
  "all",
  "any",
  "some",
  "more",
  "most",
  "other",
  "such",
  "than",
  "then",
  "into",
  "out",
  "up",
  "down",
  "over",
  "under",
  "again",
  "further",
  "also",
  "can",
  "should",
  "would",
  "could",
  "may",
  "might",
  "must",
  // Russian (top frequency; helps avoid the corpus being dominated
  // by "и", "в", "на").
  "и",
  "в",
  "на",
  "с",
  "по",
  "для",
  "не",
  "что",
  "это",
  "как",
  "к",
  "из",
  "за",
  "то",
  "о",
  "от",
  "до",
  "но",
  "да",
  "мы",
  "вы",
  "он",
  "она",
  "они",
  "его",
  "ее",
  "их",
  "у",
  "же",
  "бы",
  "быть",
  "был",
  "была",
  "было",
  "были",
  "только",
  "или",
  "еще",
]);

const TOKEN_RE = /[a-zа-яё0-9]{2,}/giu;

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(TOKEN_RE)) {
    const w = m[0];
    if (w.length < 2) continue;
    if (STOPWORDS.has(w)) continue;
    // Skip pure numbers.
    if (/^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

function safeParse(html: string): {
  document: ReturnType<typeof parseHTML>["document"];
} {
  try {
    return { document: parseHTML(html).document };
  } catch {
    return {
      document: parseHTML("<html><head></head><body></body></html>").document,
    };
  }
}

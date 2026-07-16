// Safe HTML parser. Uses linkedom (no script execution, no fetch,
// no external resources). We extract a fixed, well-known set of
// signals; nothing user-controlled is evaluated.

import { parseHTML } from "linkedom";

function safeParse(html: string): {
  document: ReturnType<typeof parseHTML>["document"];
} {
  if (typeof html !== "string" || html.length === 0) {
    return parseHTML("<html><head></head><body></body></html>");
  }
  try {
    return parseHTML(html);
  } catch {
    return parseHTML("<html><head></head><body></body></html>");
  }
}

export interface ParsedPage {
  finalUrl: string;
  htmlLang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  hreflang: Array<{ lang: string; href: string }>;
  h1: string[];
  h2: string[];
  images: Array<{ src: string; alt: string | null }>;
  /** Image sources without both explicit width and height attributes. */
  imagesWithoutDimensions: string[];
  /** Number of picture elements that do not contain an img fallback. */
  picturesMissingImg: number;
  internalLinks: string[];
  /** Per-anchor evidence used by the immutable internal-link graph. */
  internalLinkDetails?: ParsedInternalLink[];
  externalLinks: string[];
  nofollowLinks: string[];
  wordCount: number;
  text: string;
  hasViewport: boolean;
  viewportContent: string | null;
  /** Total element count, used for an explainable large-DOM diagnostic. */
  domNodeCount: number;
  /** Distinct non-empty id values that occur more than once. */
  duplicateIds: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  jsonLd: string[];
}

export type InternalLinkPlacement =
  "header" | "navigation" | "main" | "aside" | "footer" | "body";

export interface ParsedInternalLink {
  targetUrl: string;
  anchorText: string | null;
  nofollow: boolean;
  placement: InternalLinkPlacement;
}

function internalLinkPlacement(anchor: Element): InternalLinkPlacement {
  let node: Element | null = anchor.parentElement;
  while (node) {
    switch (node.localName.toLowerCase()) {
      case "nav":
        return "navigation";
      case "header":
        return "header";
      case "main":
        return "main";
      case "aside":
        return "aside";
      case "footer":
        return "footer";
      default:
        node = node.parentElement;
    }
  }
  return "body";
}

export function parsePage(html: string, finalUrl: string): ParsedPage {
  const parsed = safeParse(html);
  const document = parsed.document;
  if (!document || !document.documentElement) {
    return emptyParsedPage(finalUrl);
  }
  const origin = safeOrigin(finalUrl);

  const htmlLang =
    document.documentElement.getAttribute("lang")?.trim() || null;

  const titleNode = document.querySelector("title");
  const title = titleNode ? (titleNode.textContent?.trim() ?? null) : null;

  const metaDescNode = document.querySelector('meta[name="description"]');
  const metaDescription = metaDescNode
    ? (metaDescNode.getAttribute("content")?.trim() ?? null)
    : null;

  const canonicalNode = document.querySelector('link[rel="canonical"]');
  const canonical = canonicalNode
    ? (canonicalNode.getAttribute("href")?.trim() ?? null)
    : null;

  const robotsDirectives = Array.from(document.querySelectorAll("meta"))
    .filter((node) => {
      const name = node.getAttribute("name")?.trim().toLowerCase();
      return name === "robots" || name === "googlebot";
    })
    .map((node) => node.getAttribute("content")?.trim() ?? "")
    .filter(Boolean);
  // Multiple directives are cumulative: a noindex in any applicable meta tag
  // is authoritative even when another tag says index.
  const robotsMeta =
    robotsDirectives.length > 0 ? robotsDirectives.join(", ") : null;

  const hreflang: Array<{ lang: string; href: string }> = [];
  for (const el of document.querySelectorAll(
    'link[rel="alternate"][hreflang]',
  )) {
    const lang = el.getAttribute("hreflang");
    const href = el.getAttribute("href");
    if (lang && href) hreflang.push({ lang, href: href.trim() });
  }

  const h1 = collectHeadings(document, "h1");
  const h2 = collectHeadings(document, "h2");

  const images: Array<{ src: string; alt: string | null }> = [];
  const imagesWithoutDimensions: string[] = [];
  for (const img of document.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src) continue;
    const cleanSrc = src.trim();
    images.push({ src: cleanSrc, alt: img.getAttribute("alt") });
    if (
      !img.getAttribute("width")?.trim() ||
      !img.getAttribute("height")?.trim()
    ) {
      imagesWithoutDimensions.push(cleanSrc);
    }
  }
  let picturesMissingImg = 0;
  for (const picture of document.querySelectorAll("picture")) {
    if (!picture.querySelector("img")) picturesMissingImg += 1;
  }

  const internalLinks: string[] = [];
  const internalLinkDetails: ParsedInternalLink[] = [];
  const externalLinks: string[] = [];
  const nofollowLinks: string[] = [];
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const trimmed = href.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("javascript:")
    ) {
      continue;
    }
    if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
      continue;
    }
    const rel = (a.getAttribute("rel") ?? "").toLowerCase();
    const isNofollow = rel.split(/\s+/).includes("nofollow");
    let resolved: string;
    try {
      resolved = new URL(trimmed, finalUrl).toString();
    } catch {
      continue;
    }
    if (origin && safeOrigin(resolved) === origin) {
      internalLinks.push(resolved);
      const anchorText = (a.textContent ?? "").replace(/\s+/gu, " ").trim();
      internalLinkDetails.push({
        targetUrl: resolved,
        anchorText: anchorText ? anchorText.slice(0, 500) : null,
        nofollow: isNofollow,
        placement: internalLinkPlacement(a),
      });
    } else {
      externalLinks.push(resolved);
    }
    if (isNofollow) nofollowLinks.push(resolved);
  }

  // Word count: text-only, no script/style content.
  const text = (document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  const wordCount = text === "" ? 0 : text.split(/\s+/).length;

  const viewportNode = document.querySelector('meta[name="viewport"]');
  const hasViewport = !!viewportNode;
  const viewportContent = viewportNode?.getAttribute("content")?.trim() || null;

  const domNodeCount = document.querySelectorAll("*").length;
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const node of document.querySelectorAll("[id]")) {
    const id = node.getAttribute("id")?.trim();
    if (!id) continue;
    if (seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);
  }

  const ogTitleNode = document.querySelector('meta[property="og:title"]');
  const ogTitle = ogTitleNode
    ? (ogTitleNode.getAttribute("content")?.trim() ?? null)
    : null;
  const ogDescNode = document.querySelector('meta[property="og:description"]');
  const ogDescription = ogDescNode
    ? (ogDescNode.getAttribute("content")?.trim() ?? null)
    : null;

  const jsonLd: string[] = [];
  for (const s of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    const txt = s.textContent?.trim();
    if (txt) jsonLd.push(txt);
  }

  return {
    finalUrl,
    htmlLang,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    hreflang,
    h1,
    h2,
    images,
    imagesWithoutDimensions,
    picturesMissingImg,
    internalLinks,
    internalLinkDetails,
    externalLinks,
    nofollowLinks,
    wordCount,
    hasViewport,
    viewportContent,
    domNodeCount,
    duplicateIds: [...duplicateIds],
    ogTitle,
    ogDescription,
    jsonLd,
    text,
  };
}

function collectHeadings(
  document: ReturnType<typeof parseHTML>["document"],
  tag: string,
): string[] {
  const out: string[] = [];
  for (const el of document.querySelectorAll(tag)) {
    const t = el.textContent?.trim();
    if (t) out.push(t);
  }
  return out;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return null;
  }
}

function emptyParsedPage(finalUrl: string): ParsedPage {
  return {
    finalUrl,
    htmlLang: null,
    title: null,
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    hreflang: [],
    h1: [],
    h2: [],
    images: [],
    imagesWithoutDimensions: [],
    picturesMissingImg: 0,
    internalLinks: [],
    internalLinkDetails: [],
    externalLinks: [],
    nofollowLinks: [],
    wordCount: 0,
    hasViewport: false,
    viewportContent: null,
    domNodeCount: 0,
    duplicateIds: [],
    text: "",
    ogTitle: null,
    ogDescription: null,
    jsonLd: [],
  };
}

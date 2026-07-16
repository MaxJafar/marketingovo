// Image checks: missing alt text, broken image src.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const imageChecks: CheckFn[] = [
  function imagesMissingAlt(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    let count = 0;
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      let pageMissing = false;
      for (const img of p.parsed.images) {
        if (img.alt === null || img.alt.trim() === "") {
          count += 1;
          pageMissing = true;
        }
      }
      if (pageMissing) urls.push(p.url);
    }
    if (count === 0) return [];
    return [
      {
        id: "image-alt-missing",
        category: "Images",
        priority: "Medium",
        message: `${count} image(s) on ${urls.length} URL(s) have no alt text.`,
        urls,
      },
    ];
  },

  function imagesMissingDimensions(index: CrawlIndex): Issue[] {
    const pages: Array<{ url: string; images: string[] }> = [];
    let imageCount = 0;
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      const images = [...new Set(page.parsed.imagesWithoutDimensions)];
      if (images.length === 0) continue;
      imageCount += images.length;
      pages.push({ url: page.url, images });
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "image-dimensions-missing",
        category: "Images",
        priority: "Medium",
        message: `${imageCount} image(s) on ${pages.length} page(s) omit an explicit width or height attribute.`,
        urls: pages.map((page) => page.url),
        detail: { pages },
      },
    ];
  },

  function pictureMissingImgFallback(index: CrawlIndex): Issue[] {
    const pages: Array<{ url: string; pictureCount: number }> = [];
    let pictureCount = 0;
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      if (page.parsed.picturesMissingImg === 0) continue;
      pictureCount += page.parsed.picturesMissingImg;
      pages.push({
        url: page.url,
        pictureCount: page.parsed.picturesMissingImg,
      });
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "picture-img-fallback-missing",
        category: "Images",
        priority: "Medium",
        message: `${pictureCount} picture element(s) on ${pages.length} page(s) have no img fallback.`,
        urls: pages.map((page) => page.url),
        detail: { pages },
      },
    ];
  },
];

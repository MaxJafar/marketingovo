import type { ReactNode } from "react";

/**
 * Inline stand-ins for the raster pixel art. These are deliberately drawn with
 * square caps, mitred joins, and no curves that a 16×16 grid could not express,
 * so the UI reads as one coherent thing whether or not the PNGs have landed.
 *
 * Each key matches the asset filename in
 * docs/design/terminal-ui-asset-packet.md — `nav.dashboard` stands in for
 * /pixel/nav/dashboard.png, and so on.
 */

const FRAME = <rect x="2.5" y="2.5" width="19" height="19" />;

export const navGlyphs: Record<string, ReactNode> = {
  dashboard: (
    <>
      {FRAME}
      <path d="M7 12.5 12 8l5 4.5V17H7v-4.5Z" />
      <path d="M11 17v-3h2v3" />
    </>
  ),
  "seo-analytics": (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  // A page with a rising bar chart on it, which is what a client report is.
  report: (
    <>
      {FRAME}
      <path d="M7 16.5v-3M11 16.5v-6M15 16.5v-4M17 16.5v-8" />
    </>
  ),
  // An envelope: the frame plus the flap fold.
  email: (
    <>
      {FRAME}
      <path d="M2.5 6.5 12 13l9.5-6.5" />
    </>
  ),
  // A QR code, reduced to the part that makes one recognisable: three finder
  // squares and a missing fourth corner. The absent corner is what tells a
  // scanner the orientation, so leaving it out is accurate as well as legible.
  links: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" />
      <rect x="14.5" y="3.5" width="6" height="6" />
      <rect x="3.5" y="14.5" width="6" height="6" />
      <path d="M14.5 14.5h3v3h-3zM19.5 19.5h1M14.5 20.5h1M19.5 14.5h1" />
    </>
  ),
  // A month grid with its header bar, which is what a content calendar is.
  calendar: (
    <>
      {FRAME}
      <path d="M2.5 8h19M8 2.5v3M16 2.5v3M8 12h2M13 12h3M8 16h2M13 16h3" />
    </>
  ),
  // A filing cabinet: two drawers with handles. "Cabinet" is the marketer's
  // word for an ad account, and the drawer reads as the thing that holds
  // several of them under one login.
  "ad-cabinets": (
    <>
      {FRAME}
      <path d="M5 12h14M9.5 8.5h5M9.5 15.5h5" />
    </>
  ),
  "social-research": (
    <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
  ),
  osint: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="m14 14 6 6M7.5 10h5M10 7.5v5" />
    </>
  ),
  "content-intel": (
    <>
      {FRAME}
      <path d="M8 7h5l3 3v7H8V7Z" />
      <path d="M13 7v3h3M9.5 13h5M9.5 15h5" />
    </>
  ),
  competitors: (
    <>
      {FRAME}
      <path d="M8 17v-4M12 17V8M16 17v-6" />
    </>
  ),
  "keyword-lab": (
    <>
      {FRAME}
      <path d="M10.5 7v4L7.5 17h9l-3-6V7" />
      <path d="M9.5 7h5" />
    </>
  ),
  backlinks: (
    <>
      {FRAME}
      <path d="M10.5 13.5 8 16a2.5 2.5 0 0 1-3.5-3.5" opacity="0" />
      <path
        d="M10 14.5 8.5 16a2.6 2.6 0 1 1-3.5-3.8"
        transform="translate(3 -1)"
      />
      <path
        d="M14 9.5 15.5 8a2.6 2.6 0 1 1 3.5 3.8"
        transform="translate(-3 1)"
      />
      <path d="m10 14 4-4" />
    </>
  ),
  reports: (
    <>
      {FRAME}
      <path d="M8 8h8v9H8V8Z" />
      <path d="M10 7h4v2h-4V7Z" />
      <path d="M10 12h4M10 14.5h4" />
    </>
  ),
  alerts: (
    <>
      <path d="M7 16V11a5 5 0 0 1 10 0v5h1.5v1.5h-13V16H7Z" />
      <path d="M10.5 19h3" />
    </>
  ),
  notes: (
    <>
      {FRAME}
      <path d="M8 7h8v6l-3 4H8V7Z" />
      <path d="M16 13h-3v4" />
    </>
  ),
};

export const kpiGlyphs: Record<string, ReactNode> = {
  visibility: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3.5" />
      <path d="m15 15 5.5 5.5" />
    </>
  ),
  traffic: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" />
      <path d="m6 16 3.5-3.5L12 15l5.5-6" />
      <path d="M14 9h4v4" />
    </>
  ),
  mentions: (
    <>
      <path d="M3.5 5.5h17v11h-9l-5 4v-4h-3v-11Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="2.4" />
    </>
  ),
  sentiment: (
    <>
      <path d="M12 20.5S3.5 15.5 3.5 9.8A4.8 4.8 0 0 1 12 6.8a4.8 4.8 0 0 1 8.5 3c0 5.7-8.5 10.7-8.5 10.7Z" />
      <path d="M7.5 8.5h2" />
    </>
  ),
};

export const panelGlyphs: Record<string, ReactNode> = {
  coffee: (
    <>
      <path d="M4.5 10.5h12v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6Z" />
      <path d="M16.5 12h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 3.5v3M12 3.5v3" />
    </>
  ),
  chat: (
    <>
      <path d="M3.5 4.5h17v12h-10l-4 3.5v-3.5h-3v-12Z" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.8L12 3.5Z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" strokeWidth="2" />
    </>
  ),
  feed: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" />
      <path d="M6.5 8h7M6.5 11h7M6.5 14h4" />
      <path d="M16 8h1.5v4H16z" />
    </>
  ),
};

export const feedGlyphs: Record<string, ReactNode> = {
  strategy: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" />
      <path d="M8 17v-4M12 17V8M16 17v-6" />
    </>
  ),
  trend: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 5.5v2M12 16.5v2M5.5 12h2M16.5 12h2" />
    </>
  ),
  benchmark: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" />
      <circle cx="10" cy="10" r="2.5" />
      <path d="M6 17.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
      <circle cx="15.5" cy="10.5" r="1.8" />
    </>
  ),
};

export const socialGlyphs: Record<string, ReactNode> = {
  twitter: (
    <path d="M21 6.2a7 7 0 0 1-2.1.6 3.6 3.6 0 0 0 1.6-2 7.2 7.2 0 0 1-2.3.9 3.6 3.6 0 0 0-6.2 3.3A10.3 10.3 0 0 1 4.5 5.2a3.6 3.6 0 0 0 1.1 4.8 3.5 3.5 0 0 1-1.6-.5 3.6 3.6 0 0 0 2.9 3.5 3.6 3.6 0 0 1-1.6.1 3.6 3.6 0 0 0 3.4 2.5A7.3 7.3 0 0 1 3 17.1a10.2 10.2 0 0 0 5.6 1.6c6.7 0 10.4-5.6 10.4-10.4v-.5A7.3 7.3 0 0 0 21 6.2Z" />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <circle cx="12" cy="12" r="4" />
      <path d="M16.5 7.5h.01" strokeWidth="2.4" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14 3.5v10.2a3.3 3.3 0 1 1-3.3-3.3h.8" />
      <path d="M14 3.5c.5 2.4 2 3.8 4.5 4v3c-1.9 0-3.4-.6-4.5-1.6" />
    </>
  ),
  reddit: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M9.5 12.5h.01M14.5 12.5h.01" strokeWidth="2.4" />
      <path d="M9.5 16c1.5 1 3.5 1 5 0" />
      <path d="M14 5.5 15 8" />
      <circle cx="15.5" cy="4.5" r="1.3" />
    </>
  ),
};

export const mascotGlyphs: Record<string, ReactNode> = {
  /** Cat head: also the fallback for the sidebar logo mark. */
  cat: (
    <>
      <path d="M5 9 4 4l4 2.5h8L20 4l-1 5" />
      <path d="M4.5 11.5a7.5 6.5 0 0 0 15 0" />
      <path d="M5 9v3M19 9v3" />
      <path d="M9 13h.01M15 13h.01" strokeWidth="2.4" />
      <path d="M11 16h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="3.5" y="5.5" width="17" height="12" />
      <path d="M7 10h.01M17 10h.01" strokeWidth="2.4" />
      <path d="M9 13.5c1.8 1.5 4.2 1.5 6 0" />
      <path d="M9.5 20.5h5M12 17.5v3" />
      <path d="M4 5.5V3.5h2" />
    </>
  ),
  blob: (
    <>
      <path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20Z" />
      <path d="M10 11h.01M14 11h.01" strokeWidth="2.4" />
    </>
  ),
};

export const decoGlyphs: Record<string, ReactNode> = {
  sparkle: (
    <path
      d="M12 2 13.4 9.6 21 11l-7.6 1.4L12 20l-1.4-7.6L3 11l7.6-1.4L12 2Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  star: (
    <path
      d="m12 3 2.5 5.5L20 9.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1L12 3Z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "context"
  | "actions"
  | "issues"
  | "audits"
  | "pages"
  | "keywords"
  | "competitors"
  | "monitoring"
  | "reports"
  | "integrations"
  | "settings"
  | "health"
  | "menu"
  | "close"
  | "arrow"
  | "check"
  | "warning"
  | "refresh"
  | "external"
  | "plus"
  | "search";

const paths: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" />
    </>
  ),
  context: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z" />
      <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22V4.5Z" />
    </>
  ),
  actions: (
    <>
      <path d="m12 3-1.6 5.1a2 2 0 0 1-1.3 1.3L4 11l5.1 1.6a2 2 0 0 1 1.3 1.3L12 19l1.6-5.1a2 2 0 0 1 1.3-1.3L20 11l-5.1-1.6a2 2 0 0 1-1.3-1.3L12 3Z" />
    </>
  ),
  issues: (
    <>
      <path d="M5 3h14v18H5V3Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
      <circle cx="7" cy="8" r=".5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r=".5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="16" r=".5" fill="currentColor" stroke="none" />
    </>
  ),
  audits: (
    <>
      <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
      <path d="m9 14 2 2 8-9" />
    </>
  ),
  pages: (
    <>
      <path d="M6 2h9l5 5v15H6V2Z" />
      <path d="M14 2v6h6M9 13h8M9 17h8" />
    </>
  ),
  keywords: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4M8 11h6M11 8v6" />
    </>
  ),
  competitors: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  monitoring: (
    <>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </>
  ),
  reports: (
    <>
      <path d="M4 19V5M4 19h16M8 16v-5M12 16V7M16 16v-8" />
    </>
  ),
  integrations: (
    <>
      <path d="M8 12h8M12 8v8" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  health: (
    <>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
      <path d="M12 22C6.5 19 3 15.7 3 10.5A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9 4.5C21 15.7 17.5 19 12 22Z" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v7H4V6h7" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

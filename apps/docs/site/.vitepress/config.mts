import { defineConfig } from "vitepress";

const repository = "https://github.com/GolemWorkers/golem-seo";

export default defineConfig({
  lang: "en-US",
  title: "Golem SEO",
  titleTemplate: ":title · Golem SEO Docs",
  description:
    "Local-first SEO operations documentation for marketers, developers, and agents.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  head: [
    ["meta", { name: "theme-color", content: "#171a24" }],
    ["meta", { name: "robots", content: "index,follow" }],
    ["link", { rel: "icon", href: "/brand-mark.svg", type: "image/svg+xml" }],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    logo: "/brand-mark.svg",
    siteTitle: "Golem SEO",
    nav: [
      { text: "Start", link: "/getting-started/quickstart" },
      {
        text: "Use Golem SEO",
        items: [
          { text: "Marketer workflows", link: "/workflows/marketer-workflows" },
          { text: "Dashboard and actions", link: "/product/dashboard-actions" },
          { text: "Project Context", link: "/product/project-context" },
          { text: "Integrations and BYOK", link: "/integrations/byok" },
          { text: "Reference-tool audit", link: "/product/reference-audit" },
        ],
      },
      {
        text: "Developers & agents",
        items: [
          { text: "REST API", link: "/agents/rest-api" },
          { text: "MCP, Codex, and OpenClaw", link: "/agents/agent-surfaces" },
        ],
      },
      { text: "Community vs GolemWorkers", link: "/product/editions" },
      { text: "0.11 alpha", link: "/product/release-status" },
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "What is Golem SEO?", link: "/getting-started/overview" },
          {
            text: "Quickstart and onboarding",
            link: "/getting-started/quickstart",
          },
        ],
      },
      {
        text: "Marketing operations",
        items: [
          { text: "Marketer workflows", link: "/workflows/marketer-workflows" },
          {
            text: "Dashboard and priority-v1",
            link: "/product/dashboard-actions",
          },
          {
            text: "Project Context and journal",
            link: "/product/project-context",
          },
          { text: "Integrations and BYOK", link: "/integrations/byok" },
        ],
      },
      {
        text: "Developers and agents",
        items: [
          { text: "REST API", link: "/agents/rest-api" },
          { text: "MCP, Codex, and OpenClaw", link: "/agents/agent-surfaces" },
        ],
      },
      {
        text: "Trust and product boundary",
        items: [
          { text: "Security and privacy", link: "/trust/security-privacy" },
          { text: "Community vs GolemWorkers", link: "/product/editions" },
          { text: "Release status", link: "/product/release-status" },
          { text: "Reference-tool audit", link: "/product/reference-audit" },
        ],
      },
      {
        text: "Community",
        items: [{ text: "Contributing", link: "/community/contributing" }],
      },
    ],
    outline: { level: [2, 3], label: "On this page" },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: repository }],
    editLink: {
      pattern: `${repository}/edit/main/apps/docs/site/:path`,
      text: "Suggest a documentation change",
    },
    lastUpdated: {
      text: "Source updated",
      formatOptions: { dateStyle: "medium", timeStyle: "short" },
    },
    footer: {
      message:
        "Community Edition is source-available under the Elastic License 2.0.",
      copyright: "Copyright © 2026 GolemWorkers",
    },
    docFooter: {
      prev: "Previous guide",
      next: "Next guide",
    },
  },
});

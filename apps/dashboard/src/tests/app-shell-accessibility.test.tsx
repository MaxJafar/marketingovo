import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  setSiteId: vi.fn(),
  send: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
  attached: false,
  busy: false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} onClick={(event) => event.preventDefault()}>
      {children}
    </a>
  ),
  Outlet: () => <div>Route content</div>,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("../context/site-context", () => ({
  useSite: () => ({
    sites: [
      { id: "project-1", name: "Example", url: "https://example.com" },
      { id: "project-2", name: "Second Site", url: "https://second.example" },
    ],
    siteId: "project-1",
    site: { id: "project-1", name: "Example", url: "https://example.com" },
    setSiteId: mocks.setSiteId,
    isLoading: false,
  }),
}));

vi.mock("../api/queries", () => ({
  useIntegrations: () => ({
    isLoading: false,
    data: {
      data: {
        items: [
          { id: "ga4", name: "Google Analytics", status: "connected" },
          { id: "gsc", name: "Search Console", status: "connected" },
        ],
      },
    },
  }),
}));

vi.mock("../api/terminal", () => ({
  useTerminalSession: () => ({
    sessionId: "session-1",
    events: [],
    presence: {
      attached: mocks.attached,
      agent: mocks.attached
        ? {
            agentId: "agent-1",
            label: "Claude Code",
            harness: "mcp",
            attachedAt: "",
            lastSeenAt: "",
          }
        : null,
      busy: mocks.busy,
    },
    connection: "live",
    error: null,
    sending: false,
    send: mocks.send,
    cancel: mocks.cancel,
  }),
}));

import { AppShell, routeTitleForPathname } from "../components/app-shell";

function renderShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<AppShell />, { wrapper });
}

describe("AppShell accessibility", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.attached = false;
    mocks.busy = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.title = "";
  });

  it("marks the active section and announces and focuses route changes", async () => {
    const view = renderShell();

    expect(document.title).toBe("Dashboard | Marketingovo");
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    mocks.pathname = "/monitoring";
    view.rerender(<AppShell />);

    await waitFor(() => {
      expect(document.title).toBe("Alerts | Marketingovo");
      expect(screen.getByText("Alerts page loaded.")).toBeInTheDocument();
      expect(document.getElementById("main-content")).toHaveFocus();
    });
    expect(screen.getByRole("link", { name: /Alerts/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("exposes the section rail as a labelled expandable control", async () => {
    const user = userEvent.setup();
    renderShell();

    const toggle = screen.getByRole("button", { name: /sections/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("labels the agent prompt and keeps send disabled until there is a message", async () => {
    const user = userEvent.setup();
    renderShell();

    const input = screen.getByLabelText("Send a message to the attached agent");
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    await user.type(input, "audit the blog");
    expect(send).toBeEnabled();

    await user.click(send);
    expect(mocks.send).toHaveBeenCalledWith("audit the blog");
  });

  it("states agent presence in the top bar rather than implying one is listening", () => {
    renderShell();
    expect(screen.getByText("no agent attached")).toBeInTheDocument();

    cleanup();
    mocks.attached = true;
    renderShell();
    expect(screen.getByText("agent online")).toBeInTheDocument();
  });

  it("reports connector state in the boot log", () => {
    renderShell();
    expect(screen.getByText("google analytics [ OK ]")).toBeInTheDocument();
    expect(screen.getByText("data sync complete ✓")).toBeInTheDocument();
  });

  it("keeps every working page reachable from the shell", () => {
    renderShell();

    // The ten headline sections are the product's map, but six more pages exist
    // and a page with no link into it is, from the operator's side, a page that
    // does not exist. This asserts the whole reachable set, so removing a link
    // fails here rather than silently stranding a workbench.
    const reachable = new Set(
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => Boolean(href)),
    );

    for (const href of [
      "/",
      "/audits",
      "/social",
      "/content",
      "/competitors",
      "/keywords",
      "/backlinks",
      "/reports",
      "/monitoring",
      "/context",
      "/actions",
      "/issues",
      "/pages",
      "/integrations",
      "/settings",
      "/system",
      "/onboarding",
      "/setup-checklist",
    ]) {
      expect(reachable, `${href} is not linked from the shell`).toContain(href);
    }
  });

  it("switches the active site from the command line", async () => {
    const user = userEvent.setup();
    renderShell();

    const selector = screen.getByLabelText("Active site");
    expect(selector).toHaveValue("project-1");
    await user.selectOptions(selector, "project-2");
    expect(mocks.setSiteId).toHaveBeenCalledWith("project-2");
  });

  it("keeps the active caret out of the accessible name", () => {
    renderShell();

    // The caret is a real aria-hidden element rather than ::before content:
    // generated content folds into the accessible name, which would make the
    // active link announce and match as "> Dashboard".
    // A string name already matches exactly, so a caret folded into the
    // accessible name would make this fail rather than quietly pass.
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("maps every rail route and nested detail route to a title", () => {
    expect(routeTitleForPathname("/")).toBe("Dashboard");
    expect(routeTitleForPathname("/audits")).toBe("SEO analytics");
    expect(routeTitleForPathname("/audits/run-1")).toBe("Audit details");
    expect(routeTitleForPathname("/context")).toBe("Notes");
    expect(routeTitleForPathname("/nowhere")).toBe("Page not found");
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  setSiteId: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
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
    sites: [{ id: "project-1", name: "Example", url: "https://example.com" }],
    siteId: "project-1",
    setSiteId: mocks.setSiteId,
    isLoading: false,
  }),
}));

import { AppShell } from "../components/app-shell";

function setMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("AppShell accessibility", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    setMobileViewport(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.title = "";
    document.body.style.overflow = "";
  });

  it("keeps the closed mobile drawer inert and traps focus until Escape restores the trigger", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    const drawer = document.getElementById("mobile-navigation");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(drawer).not.toHaveAttribute("aria-hidden");
    expect(drawer).not.toHaveAttribute("inert");
    expect(drawer).toHaveAttribute("role", "dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const closeButton = screen.getByRole("button", {
      name: "Close navigation",
    });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const setupLink = screen.getByRole("link", { name: /Setup guide/i });
    setupLink.focus();
    await user.tab();
    expect(screen.getByRole("link", { name: "AGENTseo home" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the active route and announces and focuses client-side route changes", async () => {
    setMobileViewport(false);
    const view = render(<AppShell />);

    expect(document.title).toBe("Overview | AGENTseo");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    mocks.pathname = "/monitoring";
    view.rerender(<AppShell />);

    await waitFor(() => {
      expect(document.title).toBe("Monitoring | AGENTseo");
      expect(screen.getByText("Monitoring page loaded.")).toBeInTheDocument();
      expect(document.getElementById("main-content")).toHaveFocus();
    });
    expect(screen.getByRole("link", { name: "Monitoring" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

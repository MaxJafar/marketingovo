import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/router.js", () => ({
  AppRouter: () => <div>Evidence workspace ready</div>,
}));

vi.mock("../api/client-context.js", () => ({
  IntelClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  dashboardFetch: function (this: any, ...args: Parameters<typeof fetch>) {
    return fetch.apply(window, args);
  },
}));

const ticket = "abcdefghijklmnopqrstuvwxyzABCDEFGH012345678";
const session = {
  csrf: "csrf_abcdefghijklmnopqrstuvwxyz0123456789AB",
  expires_at: "2026-07-16T20:00:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dashboard session lifecycle", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("restores the HttpOnly session after bootstrap and a full reload", async () => {
    const bootstrapFetch = vi.fn<typeof fetch>().mockImplementation(function (
      this: any,
      ...args
    ) {
      if (this !== window && this !== globalThis)
        throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse(session));
    });
    vi.stubGlobal("fetch", bootstrapFetch);
    window.history.replaceState(null, "", `/#token=${ticket}`);

    const firstModule = await import("../app/App.js");
    const first = render(<firstModule.App />);
    expect(
      await screen.findByText("Evidence workspace ready"),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(bootstrapFetch).toHaveBeenCalledTimes(1);
    expect(
      String(bootstrapFetch.mock.calls[0]?.[0]).endsWith(
        "/v1/session/bootstrap",
      ),
    ).toBe(true);
    first.unmount();

    vi.resetModules();
    const restoreFetch = vi.fn<typeof fetch>().mockImplementation(function (
      this: any,
      ...args
    ) {
      if (this !== window && this !== globalThis)
        throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse(session));
    });
    vi.stubGlobal("fetch", restoreFetch);
    const reloadedModule = await import("../app/App.js");
    render(<reloadedModule.App />);

    expect(
      await screen.findByText("Evidence workspace ready"),
    ).toBeInTheDocument();
    expect(restoreFetch).toHaveBeenCalledTimes(1);
    expect(
      String(restoreFetch.mock.calls[0]?.[0]).endsWith("/v1/session"),
    ).toBe(true);
    expect(restoreFetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: "same-origin",
      redirect: "error",
    });
  });

  it("shows the ticket gate only after session restoration returns 401", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(function (
      this: any,
      ...args
    ) {
      if (this !== window && this !== globalThis)
        throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse({ code: "unauthorized" }, 401));
    });
    vi.stubGlobal("fetch", fetcher);
    const module = await import("../app/App.js");
    render(<module.App />);

    expect(
      await screen.findByText("Open the command center"),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

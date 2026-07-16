import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/site-context", () => ({
  useSite: () => ({ siteId: "project-1" }),
}));

vi.mock("../api/queries", () => ({
  useReports: () => ({
    data: {
      data: {
        items: [
          {
            id: "run/with spaces",
            name: "Weekly audit",
            type: "audit",
            status: "ready",
            generatedAt: "2026-07-16T08:00:00.000Z",
            downloadUrl: "/api/v1/runs/run%2Fwith%20spaces/report?format=html",
          },
        ],
        total: 1,
      },
      meta: { state: "fresh" },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { ReportsPage } from "../pages/reports";

describe("ReportsPage", () => {
  afterEach(() => cleanup());

  it("exposes every generated report format through the authenticated local API", () => {
    render(<ReportsPage />);

    for (const format of ["HTML", "PDF", "CSV", "JSON"]) {
      const link = screen.getByRole("link", {
        name: `Download ${format} report: Weekly audit`,
      });
      expect(link).toHaveAttribute("download");
      expect(link.getAttribute("href")).toMatch(
        new RegExp(`format=${format.toLowerCase()}$`, "u"),
      );
    }

    expect(
      screen.getByRole("group", { name: "Download Weekly audit" }),
    ).toBeInTheDocument();
  });
});

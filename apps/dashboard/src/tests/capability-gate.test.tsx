import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceCapabilities } from "../api/contracts";
import { CapabilityGate, QueryState } from "../components/data-state";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

function capabilities(
  available: WorkspaceCapabilities["available"],
): WorkspaceCapabilities {
  return {
    projectId: "project-1",
    available,
    states: [
      {
        capability: "website",
        available: available.includes("website"),
        reason: "This workspace has no website, so there is nothing to crawl.",
        remedy: { label: "Add a website", href: "/settings" },
      },
      {
        capability: "search-console",
        available: available.includes("search-console"),
        reason: "Search Console is not connected and mapped to a property.",
        remedy: { label: "Connect Search Console", href: "/integrations" },
      },
    ],
  };
}

describe("CapabilityGate", () => {
  it("names the missing input and its remedy instead of hiding the surface", () => {
    render(
      <CapabilityGate capabilities={capabilities([])} requires={["website"]}>
        <p>Crawl results</p>
      </CapabilityGate>,
    );

    expect(screen.queryByText("Crawl results")).not.toBeInTheDocument();
    expect(screen.getByText(/nothing to crawl/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add a website/i }),
    ).toHaveAttribute("href", "/settings");
  });

  it("renders when any one of several accepted sources is present", () => {
    render(
      <CapabilityGate
        capabilities={capabilities(["search-console"])}
        requires={["website", "search-console"]}
      >
        <p>Keyword positions</p>
      </CapabilityGate>,
    );

    expect(screen.getByText("Keyword positions")).toBeInTheDocument();
  });

  it("stays optimistic while the answer is still loading", () => {
    render(
      <CapabilityGate capabilities={undefined} requires={["website"]}>
        <p>Crawl results</p>
      </CapabilityGate>,
    );

    expect(screen.getByText("Crawl results")).toBeInTheDocument();
  });
});

// This suite has no global testing-library cleanup, so each case renders
// distinct content rather than relying on the DOM being reset between them.
describe("QueryState", () => {
  it("renders a website-less workspace rather than blocking it", () => {
    render(
      <QueryState isLoading={false} error={null} siteId="project-1">
        <p>Selected workspace body</p>
      </QueryState>,
    );

    expect(screen.getByText("Selected workspace body")).toBeInTheDocument();
  });

  it("still asks for a workspace when there is none at all", () => {
    render(
      <QueryState isLoading={false} error={null} siteId="">
        <p>Unselected workspace body</p>
      </QueryState>,
    );

    expect(
      screen.queryByText("Unselected workspace body"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/create a workspace/i)).toBeInTheDocument();
  });
});

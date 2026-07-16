import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MetricCard } from "../components/ui";

describe("MetricCard evidence note", () => {
  afterEach(cleanup);

  it("shows the API evidence note when no product-specific help overrides it", () => {
    render(
      <MetricCard
        label="Indexable coverage"
        metric={{
          value: 50,
          unit: "percent",
          status: "fresh",
          coverage: 50,
          note: "Classified 2 of 4 crawled pages; 2 remain unknown.",
        }}
      />,
    );

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(
      screen.getByText("Classified 2 of 4 crawled pages; 2 remain unknown."),
    ).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { getConnectorManifest } from "./index.js";

describe("connector economics", () => {
  it("declares DataForSEO as provider-metered with provider-reported cost", () => {
    expect(getConnectorManifest("dataforseo")?.economics).toEqual({
      usage: "provider-metered",
      perRequestCost: "provider-reported",
    });
  });

  it("does not claim a per-request SerpAPI cost that the connector cannot observe", () => {
    expect(getConnectorManifest("serpapi")?.economics).toEqual({
      usage: "provider-quota",
      perRequestCost: "not-reported",
    });
  });
});

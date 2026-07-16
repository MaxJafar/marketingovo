export type ProviderCostSource = "free" | "provider-reported" | "not-reported";

export interface ResearchProviderUsage {
  /** Whether a network request reached the dispatch path. */
  requestMade: boolean;
  /** Whether the provider may charge the connected account for this request. */
  billable: boolean;
  /** Exact USD cost returned by the provider, zero for a known-free source. */
  actualCostUsd: number | null;
  costSource: ProviderCostSource;
}

export interface ResearchProviderPayload<T> {
  value: T;
  actualCostUsd: number | null;
}

export function providerUsage(
  kind: "free" | "billable",
  requestMade: boolean,
  actualCostUsd: number | null = null,
): ResearchProviderUsage {
  if (kind === "free") {
    return {
      requestMade,
      billable: false,
      actualCostUsd: requestMade ? 0 : null,
      costSource: "free",
    };
  }
  return {
    requestMade,
    billable: true,
    actualCostUsd,
    costSource: actualCostUsd === null ? "not-reported" : "provider-reported",
  };
}

/** Sum finite, non-negative task costs from a DataForSEO response. */
export function extractDataForSeoCost(payload: unknown): number | null {
  if (!isRecord(payload) || !Array.isArray(payload.tasks)) return null;
  const costs = payload.tasks.flatMap((task) => {
    if (!isRecord(task)) return [];
    return typeof task.cost === "number" &&
      Number.isFinite(task.cost) &&
      task.cost >= 0
      ? [task.cost]
      : [];
  });
  return costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

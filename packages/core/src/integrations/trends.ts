// Google Trends integration. Wraps `google-trends-api` (an unofficial
// client for the public Google Trends UI endpoints). ToS-grey: the
// API is not officially documented, but it's the only way to get
// real search-interest data without paying for SimilarWeb/Trends
// APIs. We degrade gracefully — failures are surfaced in the
// report, not crashed.
//
// Like the lighthouse integration, we use async dynamic `import()`
// because the build is ESM. Bare `require()` throws in ESM context.

export interface TrendsPoint {
  /** Unix seconds. */
  time: number;
  /** Human-readable date. */
  formattedTime: string;
  /** Search interest 0-100. */
  value: number;
  /** True if there's real data (false = all zeros). */
  hasData: boolean;
}

export interface TrendsReport {
  keyword: string;
  startTime: string;
  endTime: string;
  points: TrendsPoint[];
  /** Average interest across the window. */
  average: number;
  /** Last-quarter average vs prior-quarter average. Positive = growing. */
  momentum: number;
  /** Slope (points/month) from linear regression. Positive = growing. */
  slope: number;
  /** "growing" | "steady" | "declining" — derived from momentum. */
  verdict: "growing" | "steady" | "declining";
  /** Populated on failure so the operator knows. */
  error: string | null;
}

// Minimal shape we actually need from google-trends-api. The package
// has no @types and its ESM exports nest the actual functions under
// `.default`. We keep a hand-rolled interface so a broken install
// can't take the rest of the report down.
interface TrendsApi {
  interestOverTime(opts: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
}

interface TrendsApiModule {
  default?: TrendsApi;
  // Legacy CJS interop: some bundlers expose the functions as named
  // exports on the namespace itself rather than under `.default`.
  interestOverTime?: TrendsApi["interestOverTime"];
}

let cachedTrendsApi: TrendsApi | null = null;

async function loadDeps(): Promise<
  { ok: true; api: TrendsApi } | { ok: false; reason: string }
> {
  if (cachedTrendsApi) return { ok: true, api: cachedTrendsApi };
  try {
    // No @types available for google-trends-api; the cast hides the
    // missing declaration file from the type-checker. The package's
    // ESM build nests functions under `.default`, but the legacy
    // CJS shape puts them on the namespace itself. Handle both.
    const mod = (await import(
      "google-trends-api" as string
    )) as unknown as TrendsApiModule;
    const api: TrendsApi = mod.default ?? (mod as unknown as TrendsApi);
    if (typeof api.interestOverTime !== "function") {
      return {
        ok: false,
        reason: "interestOverTime is not exported by google-trends-api",
      };
    }
    cachedTrendsApi = api;
    return { ok: true, api };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export function isAvailable(): boolean {
  return !!cachedTrendsApi;
}

export async function preloadDeps(): Promise<{ ok: boolean; reason?: string }> {
  const r = await loadDeps();
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}

export interface TrendsOptions {
  keyword: string;
  /** Days back from now. Default 90. */
  days?: number;
  /** Geo filter, e.g. "US". Default "" (worldwide). */
  geo?: string;
}

export async function trendsInterest(
  opts: TrendsOptions,
): Promise<TrendsReport> {
  const days = opts.days ?? 90;
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  const empty = (err: string): TrendsReport => ({
    keyword: opts.keyword,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    points: [],
    average: 0,
    momentum: 0,
    slope: 0,
    verdict: "steady",
    error: err,
  });
  const deps = await loadDeps();
  if (!deps.ok) return empty(`google-trends-api missing: ${deps.reason}`);
  try {
    const raw = await deps.api.interestOverTime({
      keyword: opts.keyword,
      startTime,
      endTime: opts.geo ? new Date() : endTime,
      geo: opts.geo || "",
    });
    const json = JSON.parse(raw) as {
      default?: {
        timelineData: Array<{
          time: string;
          formattedTime: string;
          value: number[];
          hasData: boolean[];
        }>;
      };
    };
    const points: TrendsPoint[] = (json.default?.timelineData ?? []).map(
      (p) => ({
        time: Number(p.time),
        formattedTime: p.formattedTime,
        value: p.value?.[0] ?? 0,
        hasData: p.hasData?.[0] ?? false,
      }),
    );
    return analyze(opts.keyword, points, startTime, endTime);
  } catch (err) {
    return empty((err as Error).message);
  }
}

function analyze(
  keyword: string,
  points: TrendsPoint[],
  startTime: Date,
  endTime: Date,
): TrendsReport {
  if (points.length === 0) {
    return {
      keyword,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      points,
      average: 0,
      momentum: 0,
      slope: 0,
      verdict: "steady",
      error: "no data points returned",
    };
  }
  // Drop points with no data (Google uses these to fill sparse regions).
  const real = points.filter((p) => p.hasData && p.value > 0);
  if (real.length === 0) {
    return {
      keyword,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      points,
      average: 0,
      momentum: 0,
      slope: 0,
      verdict: "steady",
      error: "all points have zero data",
    };
  }
  const average = real.reduce((a, b) => a + b.value, 0) / real.length;
  // Quarter over quarter: compare last quarter of points to prior quarter
  const half = Math.floor(real.length / 2);
  const prior = real.slice(0, half);
  const recent = real.slice(half);
  const priorAvg =
    prior.length > 0
      ? prior.reduce((a, b) => a + b.value, 0) / prior.length
      : 0;
  const recentAvg =
    recent.length > 0
      ? recent.reduce((a, b) => a + b.value, 0) / recent.length
      : 0;
  // Momentum as percent change, bounded.
  const momentum = priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : 0;
  // Linear regression slope (per day, multiplied by 30 for monthly).
  const slope = linearSlope(real) * 30;
  let verdict: TrendsReport["verdict"] = "steady";
  if (momentum > 0.2 || slope > 1) verdict = "growing";
  else if (momentum < -0.2 || slope < -1) verdict = "declining";
  return {
    keyword,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    points: real,
    average,
    momentum,
    slope,
    verdict,
    error: null,
  };
}

function linearSlope(points: TrendsPoint[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const first = points[0]!.time;
  const xs = points.map((p) => (p.time - first) / 86400); // days
  const ys = points.map((p) => p.value);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  return den > 0 ? num / den : 0;
}

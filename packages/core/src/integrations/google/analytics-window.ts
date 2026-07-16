const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Search and analytics comparisons use two adjacent four-week windows.
 * The three-day lag avoids treating incomplete Search Console days as final.
 */
export const PERFORMANCE_WINDOW_DAYS = 28 as const;
export const PERFORMANCE_COMPLETE_DATA_LAG_DAYS = 3 as const;

export interface PerformanceDateWindow {
  startDate: string;
  endDate: string;
  days: typeof PERFORMANCE_WINDOW_DAYS;
}

export interface ComparablePerformanceWindows {
  /** UTC date used to derive both provider-neutral date ranges. */
  asOfDate: string;
  calendarTimeZone: "UTC";
  completeDataLagDays: typeof PERFORMANCE_COMPLETE_DATA_LAG_DAYS;
  windowDays: typeof PERFORMANCE_WINDOW_DAYS;
  current: PerformanceDateWindow;
  previous: PerformanceDateWindow;
}

function isoDateFromUtcDay(utcDay: number): string {
  return new Date(utcDay * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Build deterministic, inclusive date ranges for search/analytics comparison.
 *
 * Example for 2026-07-15 UTC:
 * - current:  2026-06-15 through 2026-07-12 (28 complete days)
 * - previous: 2026-05-18 through 2026-06-14 (the adjacent 28 days)
 *
 * Date-only provider APIs interpret the returned values in their own reporting
 * calendar. UTC is used only to derive stable boundaries independent of the
 * machine's locale and daylight-saving transitions.
 */
export function buildComparablePerformanceWindows(
  now: Date = new Date(),
): ComparablePerformanceWindows {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new TypeError("performance comparison requires a valid date");
  }

  const asOfUtcDay = Math.floor(nowMs / MILLISECONDS_PER_DAY);
  const currentEndUtcDay = asOfUtcDay - PERFORMANCE_COMPLETE_DATA_LAG_DAYS;
  const currentStartUtcDay = currentEndUtcDay - (PERFORMANCE_WINDOW_DAYS - 1);
  const previousEndUtcDay = currentStartUtcDay - 1;
  const previousStartUtcDay = previousEndUtcDay - (PERFORMANCE_WINDOW_DAYS - 1);

  return {
    asOfDate: isoDateFromUtcDay(asOfUtcDay),
    calendarTimeZone: "UTC",
    completeDataLagDays: PERFORMANCE_COMPLETE_DATA_LAG_DAYS,
    windowDays: PERFORMANCE_WINDOW_DAYS,
    current: {
      startDate: isoDateFromUtcDay(currentStartUtcDay),
      endDate: isoDateFromUtcDay(currentEndUtcDay),
      days: PERFORMANCE_WINDOW_DAYS,
    },
    previous: {
      startDate: isoDateFromUtcDay(previousStartUtcDay),
      endDate: isoDateFromUtcDay(previousEndUtcDay),
      days: PERFORMANCE_WINDOW_DAYS,
    },
  };
}

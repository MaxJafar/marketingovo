// Ambient type for google-trends-api (no @types available).
declare module "google-trends-api" {
  export function interestOverTime(opts: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
  export function relatedQueries(opts: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
  export function relatedTopics(opts: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
  export function dailyTrends(opts: { geo?: string }): Promise<string>;
  export function realtimeTrends(opts: {
    geo?: string;
    trendDate?: string;
  }): Promise<string>;
  export function autoComplete(opts: { keyword: string }): Promise<string>;
  const _default: {
    interestOverTime: typeof interestOverTime;
    relatedQueries: typeof relatedQueries;
    relatedTopics: typeof relatedTopics;
    dailyTrends: typeof dailyTrends;
    realtimeTrends: typeof realtimeTrends;
    autoComplete: typeof autoComplete;
  };
  export default _default;
}

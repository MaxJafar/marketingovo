// Meta Marketing API client — Facebook and Instagram ads.
//
// The runtime supplies a vault-backed System User token for the duration of an
// invocation. This client never reads token files, env secrets, or a client
// secret; Meta's token exchange is not used at all.
//
// Every read is bounded. Meta will happily paginate an ad account into tens of
// thousands of rows, and an unbounded sync on a large cabinet is how a local
// tool becomes something an operator has to babysit.

import {
  classifyMetaGraphFailure,
  MetaGraphError,
  metaGraphUrl,
  normalizeGraphVersion,
  parseMetaNumber,
  parseMetaTokenDebug,
  safeMetaGraphFetch,
  type MetaTokenDebug,
} from "@marketingovo/integrations";

const MAX_PAGES = 25;
const MAX_ROWS = 5_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** One ad cabinet as Meta describes it. */
export interface MetaAdAccount {
  id: string;
  name: string;
  /** Meta returns an ISO 4217 code, or omits it on an incomplete account. */
  currency: string | null;
  /** Numeric account state, mapped to Meta's documented vocabulary. */
  status: string | null;
  timezoneName: string | null;
  /** Provider-side caps, in the account currency. Null when none is set. */
  dailySpendLimit: number | null;
  spendCap: number | null;
  amountSpent: number | null;
}

/** One daily insight row, at whichever level it was requested. */
export interface MetaInsightRow {
  date: string;
  entityId: string;
  entityName: string | null;
  /** Verbatim from Meta's `publisher_platform` breakdown, or null. */
  publisherPlatform: string | null;
  impressions: number | null;
  clicks: number | null;
  linkClicks: number | null;
  spend: number | null;
  reach: number | null;
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  conversionValue: number | null;
  videoPlays: number | null;
}

/** Delivery state for one campaign, ad set or ad. */
export interface MetaDeliveryRecord {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad";
  /** Meta's `effective_status`, e.g. ACTIVE, PAUSED, DISAPPROVED. */
  effectiveStatus: string;
  /** Ad-review outcome when Meta supplied one. */
  reviewFeedback: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  /** Campaign only; whether Meta is optimizing budget across its ad sets. */
  campaignId: string | null;
}

export type MetaInsightLevel = "account" | "campaign" | "adset" | "ad";

export interface MetaAdsClientOptions {
  accessToken: string;
  graphVersion?: string;
  providerFetch?: typeof fetch;
  /** Limits the discovery call to one Business Manager when supplied. */
  businessId?: string;
}

interface GraphPage<Row> {
  data?: Row[];
  paging?: { next?: string; cursors?: { after?: string } };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MetaGraphError(
      "meta_response_invalid",
      "Meta returned a response that was not an object",
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Meta reports conversions inside an `actions` array keyed by action type
 * rather than as a column. Which type counts as "a conversion" is a real
 * modelling choice, and this picks the purchase-shaped ones rather than
 * summing every action — summing would count a link click, a page view and a
 * purchase as three conversions and inflate the number by an order of
 * magnitude.
 */
const CONVERSION_ACTION_TYPES = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
]);

function sumActions(value: unknown, types: ReadonlySet<string>): number | null {
  if (!Array.isArray(value)) return null;
  let total: number | null = null;
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const actionType = record.action_type;
    if (typeof actionType !== "string" || !types.has(actionType)) continue;
    const parsed = parseMetaNumber(record.value);
    if (parsed === null) continue;
    total = (total ?? 0) + parsed;
  }
  // Null rather than zero: an insight row with no matching action entry means
  // Meta reported no conversion of a type we count, which is genuinely zero —
  // but a row with no `actions` field at all means Meta did not break them out.
  return total;
}

function accountStatusLabel(value: unknown): string | null {
  const code = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(code)) return null;
  // Meta's documented account_status enumeration. Reported verbatim rather
  // than collapsed to active/inactive: "pending closure" and "disabled" call
  // for different operator actions.
  const labels: Record<number, string> = {
    1: "ACTIVE",
    2: "DISABLED",
    3: "UNSETTLED",
    7: "PENDING_RISK_REVIEW",
    8: "PENDING_SETTLEMENT",
    9: "IN_GRACE_PERIOD",
    100: "PENDING_CLOSURE",
    101: "CLOSED",
    201: "ANY_ACTIVE",
    202: "ANY_CLOSED",
  };
  return labels[code] ?? `UNKNOWN_${code}`;
}

export class MetaAdsClient {
  private readonly accessToken: string;
  private readonly graphVersion: string;
  private readonly providerFetch: typeof fetch;
  private readonly businessId: string | undefined;

  constructor(options: MetaAdsClientOptions) {
    const token = options.accessToken.trim();
    if (!token) {
      throw new MetaGraphError(
        "meta_token_invalid",
        "A Meta System User access token is required",
      );
    }
    this.accessToken = token;
    this.graphVersion = normalizeGraphVersion(options.graphVersion);
    this.providerFetch = options.providerFetch ?? safeMetaGraphFetch;
    this.businessId = options.businessId?.trim() || undefined;
  }

  private async request(url: URL): Promise<Record<string, unknown>> {
    const response = await this.providerFetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        // Header rather than query string, so no credential can be lifted out
        // of a URL that an error, a log line or a diagnostic copies verbatim.
        authorization: `Bearer ${this.accessToken}`,
      },
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      void response.body?.cancel().catch(() => undefined);
      throw new MetaGraphError(
        "meta_response_invalid",
        "Meta returned a response larger than this client will read",
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new MetaGraphError(
        "meta_response_invalid",
        "Meta returned a response larger than this client will read",
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw response.ok
        ? new MetaGraphError(
            "meta_response_invalid",
            "Meta returned a body that was not JSON",
          )
        : classifyMetaGraphFailure(response.status, null);
    }
    if (!response.ok) throw classifyMetaGraphFailure(response.status, payload);
    return asObject(payload);
  }

  /**
   * Walks a Graph edge with cursor paging.
   *
   * Meta's `paging.next` is an absolute URL that already carries the cursor,
   * but it is rebuilt here from the cursor instead of being followed, so a
   * response cannot redirect this client to a host outside the egress policy
   * by returning a `next` that points somewhere else.
   */
  private async collect<Row>(
    path: string,
    query: Record<string, string>,
    maxRows = MAX_ROWS,
  ): Promise<{ rows: Row[]; truncated: boolean }> {
    const rows: Row[] = [];
    let after: string | undefined;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = metaGraphUrl(this.graphVersion, path, {
        ...query,
        ...(after ? { after } : {}),
      });
      const payload = (await this.request(url)) as GraphPage<Row>;
      const batch = Array.isArray(payload.data) ? payload.data : [];
      for (const row of batch) {
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
        rows.push(row);
      }
      after = payload.paging?.cursors?.after;
      if (truncated || !after || !payload.paging?.next || batch.length === 0) {
        if (after && payload.paging?.next && rows.length >= maxRows) {
          truncated = true;
        }
        break;
      }
      if (page === MAX_PAGES - 1 && payload.paging.next) truncated = true;
    }
    return { rows, truncated };
  }

  /** The token's own expiry and granted scopes. */
  async debugToken(): Promise<MetaTokenDebug> {
    // `input_token` has no header form in Meta's API — it is the subject of
    // the inspection, not the authorization for it. The request still travels
    // over the pinned exact-host TLS transport and is never logged.
    const url = metaGraphUrl(this.graphVersion, "debug_token", {
      input_token: this.accessToken,
    });
    return parseMetaTokenDebug(await this.request(url));
  }

  /** Every ad cabinet this credential can reach. */
  async listAdAccounts(): Promise<MetaAdAccount[]> {
    const fields = [
      "id",
      "name",
      "currency",
      "account_status",
      "timezone_name",
      "daily_spend_limit",
      "spend_cap",
      "amount_spent",
    ].join(",");
    const path = this.businessId
      ? `${this.businessId}/owned_ad_accounts`
      : "me/adaccounts";
    const { rows } = await this.collect<Record<string, unknown>>(
      path,
      { fields, limit: "100" },
      500,
    );
    return rows
      .map((row) => ({
        id: typeof row.id === "string" ? row.id : "",
        name: typeof row.name === "string" ? row.name : "",
        currency: typeof row.currency === "string" ? row.currency : null,
        status: accountStatusLabel(row.account_status),
        timezoneName:
          typeof row.timezone_name === "string" ? row.timezone_name : null,
        // Meta reports these in the account's minor unit (cents for USD), and
        // dividing by 100 here keeps every downstream number in one unit.
        dailySpendLimit: minorToMajor(parseMetaNumber(row.daily_spend_limit)),
        spendCap: minorToMajor(parseMetaNumber(row.spend_cap)),
        amountSpent: minorToMajor(parseMetaNumber(row.amount_spent)),
      }))
      .filter((account) => account.id !== "");
  }

  /**
   * Daily insights for one cabinet.
   *
   * `time_increment=1` is not optional for this product: a single aggregated
   * row cannot answer "when did this start going wrong", and re-deriving daily
   * values from a total is exactly the kind of invention the evidence rules
   * forbid.
   */
  async insights(options: {
    accountId: string;
    since: string;
    until: string;
    level: MetaInsightLevel;
    /** Splits every row by Facebook, Instagram and the other placements. */
    byPlatform?: boolean;
    limit?: number;
  }): Promise<{ rows: MetaInsightRow[]; truncated: boolean }> {
    const fields = [
      "date_start",
      "impressions",
      "clicks",
      "inline_link_clicks",
      "spend",
      "reach",
      "frequency",
      "ctr",
      "cpc",
      "cpm",
      "actions",
      "action_values",
      "video_play_actions",
      ...levelFields(options.level),
    ].join(",");

    const query: Record<string, string> = {
      fields,
      level: options.level,
      time_increment: "1",
      time_range: JSON.stringify({
        since: options.since,
        until: options.until,
      }),
      limit: "500",
    };
    if (options.byPlatform) {
      query.breakdowns = "publisher_platform";
    }

    const { rows, truncated } = await this.collect<Record<string, unknown>>(
      `${options.accountId}/insights`,
      query,
      options.limit ?? MAX_ROWS,
    );
    return {
      rows: rows.map((row) => toInsightRow(row, options.level)),
      truncated,
    };
  }

  /**
   * Delivery state for the cabinet's campaigns, ad sets and ads.
   *
   * Insights alone cannot see a disapproved ad: a rejected ad simply stops
   * appearing in spend, which reads as "this creative went quiet" rather than
   * "Meta refused to run it".
   */
  async delivery(options: {
    accountId: string;
    level: "campaign" | "adset" | "ad";
    limit?: number;
  }): Promise<{ records: MetaDeliveryRecord[]; truncated: boolean }> {
    const edge = { campaign: "campaigns", adset: "adsets", ad: "ads" }[
      options.level
    ];
    const fields = [
      "id",
      "name",
      "effective_status",
      ...(options.level === "ad"
        ? ["ad_review_feedback", "campaign_id"]
        : ["daily_budget", "lifetime_budget"]),
      ...(options.level === "adset" ? ["campaign_id"] : []),
    ].join(",");

    const { rows, truncated } = await this.collect<Record<string, unknown>>(
      `${options.accountId}/${edge}`,
      { fields, limit: "200" },
      options.limit ?? 1_000,
    );
    return {
      records: rows
        .map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          name: typeof row.name === "string" ? row.name : "",
          level: options.level,
          effectiveStatus:
            typeof row.effective_status === "string"
              ? row.effective_status
              : "UNKNOWN",
          reviewFeedback: reviewFeedbackSummary(row.ad_review_feedback),
          dailyBudget: minorToMajor(parseMetaNumber(row.daily_budget)),
          lifetimeBudget: minorToMajor(parseMetaNumber(row.lifetime_budget)),
          campaignId:
            typeof row.campaign_id === "string" ? row.campaign_id : null,
        }))
        .filter((record) => record.id !== ""),
      truncated,
    };
  }
}

function levelFields(level: MetaInsightLevel): string[] {
  switch (level) {
    case "account":
      return ["account_id", "account_name"];
    case "campaign":
      return ["campaign_id", "campaign_name"];
    case "adset":
      return ["adset_id", "adset_name"];
    case "ad":
      return ["ad_id", "ad_name"];
  }
}

function entityIdentity(
  row: Record<string, unknown>,
  level: MetaInsightLevel,
): { id: string; name: string | null } {
  const key = {
    account: ["account_id", "account_name"],
    campaign: ["campaign_id", "campaign_name"],
    adset: ["adset_id", "adset_name"],
    ad: ["ad_id", "ad_name"],
  }[level] as [string, string];
  const id = row[key[0]];
  const name = row[key[1]];
  return {
    id: typeof id === "string" ? id : String(id ?? ""),
    name: typeof name === "string" ? name : null,
  };
}

/**
 * Meta is inconsistent about money, and the inconsistency is expensive to get
 * wrong: budget and cap fields on campaign, ad set and account objects come in
 * the account's minor unit (cents for USD), while `spend`, `cpc` and `cpm` on
 * an insights row already arrive in the major unit. Only the former are passed
 * through here. Applying this to insights spend, or omitting it on a budget,
 * is a hundredfold error in a figure an operator sets budgets from.
 */
function minorToMajor(value: number | null): number | null {
  return value === null ? null : value / 100;
}

function reviewFeedbackSummary(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const global = record.global;
  if (global && typeof global === "object") {
    const reasons = Object.values(global as Record<string, unknown>)
      .filter((reason): reason is string => typeof reason === "string")
      .slice(0, 3);
    if (reasons.length > 0) return reasons.join("; ").slice(0, 400);
  }
  return null;
}

function toInsightRow(
  row: Record<string, unknown>,
  level: MetaInsightLevel,
): MetaInsightRow {
  const identity = entityIdentity(row, level);
  return {
    date: typeof row.date_start === "string" ? row.date_start : "",
    entityId: identity.id,
    entityName: identity.name,
    publisherPlatform:
      typeof row.publisher_platform === "string"
        ? row.publisher_platform
        : null,
    impressions: parseMetaNumber(row.impressions),
    clicks: parseMetaNumber(row.clicks),
    linkClicks: parseMetaNumber(row.inline_link_clicks),
    spend: parseMetaNumber(row.spend),
    reach: parseMetaNumber(row.reach),
    frequency: parseMetaNumber(row.frequency),
    ctr: parseMetaNumber(row.ctr),
    cpc: parseMetaNumber(row.cpc),
    cpm: parseMetaNumber(row.cpm),
    conversions: sumActions(row.actions, CONVERSION_ACTION_TYPES),
    conversionValue: sumActions(row.action_values, CONVERSION_ACTION_TYPES),
    videoPlays: sumActions(row.video_play_actions, new Set(["video_view"])),
  };
}

export { CONVERSION_ACTION_TYPES };

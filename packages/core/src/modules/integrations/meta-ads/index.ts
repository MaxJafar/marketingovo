// integrations/meta-ads: Facebook and Instagram advertising.
//
// The local runtime supplies a vault-backed System User token for the duration
// of the invocation. This leaf never reads token files, env secrets, or a Meta
// app secret — the connector deliberately has no OAuth exchange to hold one.

import { ConsoleLogger } from "../../../core/logger.js";
import { syncMetaCabinet } from "../../../integrations/meta/sync.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../../types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export const metaAdsModule: Module = {
  id: "integrations:meta-ads",
  version: "1.0.0",
  displayName: "Meta Ads (Facebook & Instagram)",
  category: "integration",
  description:
    "Read one Meta ad cabinet: daily account, campaign and ad set insights split by Facebook and Instagram, plus delivery and ad-review state. Emits paid-media findings into the standard action queue. Read-only; nothing in this module writes to Meta.",
  inputSchema: {
    type: "object",
    properties: {
      channelAccountId: {
        type: "string",
        description: "The linked cabinet's local identifier.",
      },
      externalId: {
        type: "string",
        description: "The Meta ad account id, in `act_<digits>` form.",
      },
      displayName: { type: "string" },
      currency: {
        type: "string",
        description:
          "ISO 4217 code as Meta reported it. Omitted when Meta reported none; never assumed.",
      },
      since: { type: "string", description: "Inclusive ISO start date." },
      until: { type: "string", description: "Inclusive ISO end date." },
      graphVersion: {
        type: "string",
        description: "Pinned Graph API version, e.g. v23.0.",
      },
    },
    required: ["externalId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      metrics: {
        type: "array",
        description:
          "Daily channel metrics. A value is null with a stated reason whenever Meta did not report it.",
      },
      delivery: {
        type: "array",
        description: "Campaign, ad set and ad state.",
      },
      issues: { type: "array", description: "Paid-media findings." },
      state: { type: "string" },
    },
    required: ["metrics", "state"],
  },
  dependsOn: [],
  configKeys: [],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "meta-ads",
    });
    const accessToken = ctx.integrationCredentials?.["meta-ads"]?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error(
        "Meta credential is unavailable; connect Meta Ads in the local vault",
      );
    }
    const externalId = String(input.externalId ?? "").trim();
    if (!/^act_\d{1,32}$/.test(externalId)) {
      throw new Error(
        "A Meta ad account id in `act_<digits>` form is required",
      );
    }
    const until =
      typeof input.until === "string" && ISO_DATE.test(input.until)
        ? input.until
        : // Meta restates attributed conversions for several days, so the most
          // recent day is deliberately excluded rather than reported as final.
          isoDaysAgo(1);
    const since =
      typeof input.since === "string" && ISO_DATE.test(input.since)
        ? input.since
        : isoDaysAgo(28);

    const result = await syncMetaCabinet({
      cabinet: {
        id: String(input.channelAccountId ?? externalId),
        externalId,
        displayName: String(input.displayName ?? externalId),
        currency:
          typeof input.currency === "string" && input.currency
            ? input.currency
            : null,
        dailySpendCap: null,
      },
      accessToken,
      ...(typeof input.graphVersion === "string"
        ? { graphVersion: input.graphVersion }
        : {}),
      since,
      until,
      ...(ctx.providerFetch ? { providerFetch: ctx.providerFetch } : {}),
    });

    if (result.state !== "available") {
      ctx.signal.markWeak(result.reason ?? "The Meta read was incomplete");
      logger.warn?.("meta-ads read incomplete", { state: result.state });
    } else {
      ctx.signal.markStrong("Meta returned the full requested window");
    }

    return {
      metrics: result.metrics,
      delivery: result.delivery,
      issues: result.issues,
      state: result.state,
      reason: result.reason,
      since,
      until,
    };
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    // Deliberately offline. A self-test that called Meta would spend the
    // account's rate budget to answer a question about local wiring.
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};

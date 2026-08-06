// Turning four channels' evidence into one client-facing document.
//
// Pure and side-effect free, so the interesting question — "what does this
// report claim, and what does it refuse to claim" — is answerable from a unit
// test rather than from a month of live connectors.
//
// Everything here descends from ADR 0007. The document leaves the building: it
// goes to someone who did not run the audit, cannot see the connector states,
// and will not ask why one section is thinner than another. Every gap is an
// invitation to fill it, and every fill is invisible to the only person who
// could have caught it. So the composer's job is as much about what it
// declines to compute as what it produces.

import type {
  MarketingReport,
  ReportAvailability,
  ReportMetric,
  ReportRefusal,
  ReportSection,
  ReportSource,
} from "./types.js";

export interface PeriodTotals {
  /** Null means not measured. Zero means measured and zero. */
  value: number | null;
  state: ReportAvailability;
  note?: string | null;
}

export interface PaidCabinetInput {
  name: string;
  /**
   * Which advertising platform measured this.
   *
   * Load-bearing rather than descriptive: two providers counting conversions
   * on their own attribution models cannot be added together, and this is what
   * lets the composer notice.
   */
  provider: string;
  currency: string | null;
  /** Keyed by metric: spend, impressions, clicks, conversions. */
  current: Record<string, PeriodTotals>;
  previous?: Record<string, PeriodTotals> | undefined;
  /** Per-platform rows, already totalled by the caller. */
  platforms: Array<{ platform: string; current: Record<string, PeriodTotals> }>;
}

/** Human labels for the providers a paid section can hold. */
const PROVIDER_LABELS: Record<string, string> = {
  "meta-ads": "Meta",
  "google-ads": "Google Ads",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export interface OrganicInput {
  clicks: PeriodTotals;
  impressions: PeriodTotals;
  position: PeriodTotals;
  sessions: PeriodTotals;
  keyEvents: PeriodTotals;
  seoHealth: PeriodTotals;
  previous?:
    | Partial<
        Record<
          "clicks" | "impressions" | "position" | "sessions" | "keyEvents",
          PeriodTotals
        >
      >
    | undefined;
  sources: ReportSource[];
}

export interface SocialInput {
  /** Successful sends in the period, by platform. */
  publishedByPlatform: Array<{
    platform: string;
    published: number;
    failed: number;
  }>;
  /** Sends whose outcome was never established. */
  indeterminate: number;
  /** True when no social account is linked at all. */
  notConnected: boolean;
}

export interface EmailInput {
  templatesBuilt: number;
  revisionsSaved: number;
  /** Revisions saved carrying an error-level finding. */
  withBlockingFindings: number;
}

export interface ActionsInput {
  opened: number;
  resolved: number;
  verified: number;
  /** True when no audit ran in the period, so the counts mean nothing. */
  noAuditInPeriod: boolean;
}

export interface ComposeReportInput {
  projectId: string;
  title: string;
  period: MarketingReport["period"];
  narrative?: string | null;
  paid: { cabinets: PaidCabinetInput[]; notConnected: boolean };
  organic: OrganicInput;
  social: SocialInput;
  email: EmailInput;
  actions: ActionsInput;
  brandRevision: number | null;
  generatedAt: string;
}

const UNAVAILABLE_RANK: Record<ReportAvailability, number> = {
  available: 0,
  partial: 1,
  unavailable: 2,
  failed: 3,
};

/** The worst state among several, which is what a section reports. */
export function worstState(
  states: readonly ReportAvailability[],
): ReportAvailability {
  if (states.length === 0) return "unavailable";
  return states.reduce((worst, state) =>
    UNAVAILABLE_RANK[state] > UNAVAILABLE_RANK[worst] ? state : worst,
  );
}

/**
 * Builds one figure, including its change.
 *
 * The change rule is the important part and is the most common way a marketing
 * report lies: a percentage is only computed when *both* periods produced a
 * real reading. A 400% increase over a month whose connector was down is not a
 * result, and showing one is worse than showing nothing, because it looks like
 * an achievement.
 */
export function metric(input: {
  key: string;
  label: string;
  unit: string;
  currency?: string | null;
  current: PeriodTotals;
  previous?: PeriodTotals | undefined;
}): ReportMetric {
  const measured =
    (input.current.state === "available" ||
      input.current.state === "partial") &&
    input.current.value !== null;

  let change: number | null = null;
  let changeNote: string | null = null;
  if (measured && input.previous) {
    const priorMeasured =
      (input.previous.state === "available" ||
        input.previous.state === "partial") &&
      input.previous.value !== null;
    if (!priorMeasured) {
      changeNote =
        "No comparison: the previous period was not measured, so a change would be against nothing.";
    } else if (input.previous.value === 0) {
      // Growth from zero is infinite, and "+∞%" is not a sentence a client can
      // act on. The absolute values are already both present.
      changeNote =
        "No comparison: the previous period was zero, so a percentage change has no meaning.";
    } else {
      change =
        (input.current.value! - input.previous.value!) /
        Math.abs(input.previous.value!);
    }
  } else if (measured && !input.previous) {
    changeNote = null;
  }

  return {
    key: input.key,
    label: input.label,
    value: measured ? input.current.value : null,
    unit: input.unit,
    currency: input.currency ?? null,
    state: input.current.state,
    change,
    note: measured
      ? changeNote
      : (input.current.note ??
        "This was not measured in the reporting period."),
  };
}

/** Sums across cabinets, declining when they disagree about currency. */
function totalSpend(cabinets: readonly PaidCabinetInput[]): {
  totals: PeriodTotals;
  currency: string | null;
  refusal: ReportRefusal | null;
} {
  const currencies = new Set(
    cabinets
      .map((cabinet) => cabinet.currency)
      .filter((value): value is string => Boolean(value)),
  );
  const readings = cabinets.map((cabinet) => cabinet.current.spend);
  const measured = readings.filter(
    (reading) =>
      reading &&
      reading.value !== null &&
      (reading.state === "available" || reading.state === "partial"),
  );

  if (currencies.size > 1) {
    return {
      totals: { value: null, state: "unavailable" },
      currency: null,
      refusal: {
        expected: "Total spend",
        explanation: `Spend is reported in ${[...currencies].join(" and ")}. No exchange rate was recorded at the time the money was spent, so adding these figures would produce a number that looks like money and is not. Each account's own spend is below.`,
      },
    };
  }
  if (measured.length === 0) {
    return {
      totals: {
        value: null,
        state: readings.some((reading) => reading?.state === "failed")
          ? "failed"
          : "unavailable",
      },
      currency: [...currencies][0] ?? null,
      refusal: null,
    };
  }
  return {
    totals: {
      value: measured.reduce((sum, reading) => sum + (reading!.value ?? 0), 0),
      state: measured.length === readings.length ? "available" : "partial",
    },
    currency: [...currencies][0] ?? null,
    refusal: null,
  };
}

function paidSection(input: ComposeReportInput): ReportSection {
  const { cabinets, notConnected } = input.paid;

  if (notConnected || cabinets.length === 0) {
    return {
      id: "paid",
      title: "Paid advertising",
      state: "unavailable",
      // Present with an explanation rather than omitted. An absent section
      // reads as "nothing happened here", which is the same untruth.
      summary:
        "No ad account was connected during this period, so paid delivery could not be measured. This is not a report of zero spend.",
      metrics: [],
      sources: [
        {
          id: "meta-ads",
          label: "Meta Ads",
          state: "unavailable",
          reason: "No ad account is linked to this workspace.",
          observedAt: null,
        },
      ],
      refusals: [],
      breakdown: [],
    };
  }

  const spend = totalSpend(cabinets);
  const sum = (key: string): PeriodTotals => {
    const readings = cabinets.map((cabinet) => cabinet.current[key]);
    const measured = readings.filter(
      (reading) =>
        reading &&
        reading.value !== null &&
        reading.state !== "unavailable" &&
        reading.state !== "failed",
    );
    if (measured.length === 0) {
      return {
        value: null,
        state: readings.some((reading) => reading?.state === "failed")
          ? "failed"
          : "unavailable",
      };
    }
    return {
      value: measured.reduce(
        (total, reading) => total + (reading!.value ?? 0),
        0,
      ),
      state: measured.length === readings.length ? "available" : "partial",
    };
  };
  const priorSum = (key: string): PeriodTotals | undefined => {
    const readings = cabinets.map((cabinet) => cabinet.previous?.[key]);
    if (readings.some((reading) => reading === undefined)) return undefined;
    const measured = readings.filter(
      (reading) =>
        reading!.value !== null &&
        reading!.state !== "unavailable" &&
        reading!.state !== "failed",
    );
    if (measured.length === 0) return { value: null, state: "unavailable" };
    return {
      value: measured.reduce(
        (total, reading) => total + (reading!.value ?? 0),
        0,
      ),
      state: measured.length === readings.length ? "available" : "partial",
    };
  };

  /**
   * Sums one metric within a single provider's accounts.
   *
   * Two accounts on the same platform share an attribution model, so adding
   * them is arithmetic. Two accounts on different platforms do not.
   */
  const sumFor = (key: string, provider: string): PeriodTotals => {
    const readings = cabinets
      .filter((cabinet) => cabinet.provider === provider)
      .map((cabinet) => cabinet.current[key]);
    const measured = readings.filter(
      (reading) =>
        reading &&
        reading.value !== null &&
        reading.state !== "unavailable" &&
        reading.state !== "failed",
    );
    if (measured.length === 0) {
      return {
        value: null,
        state: readings.some((reading) => reading?.state === "failed")
          ? "failed"
          : "unavailable",
      };
    }
    return {
      value: measured.reduce(
        (total, reading) => total + (reading!.value ?? 0),
        0,
      ),
      state: measured.length === readings.length ? "available" : "partial",
    };
  };

  const providers = [...new Set(cabinets.map((cabinet) => cabinet.provider))];
  const singleProvider = providers.length === 1;

  const refusals: ReportRefusal[] = [
    ...(spend.refusal ? [spend.refusal] : []),
    {
      expected: "Total reach",
      explanation:
        "Reach counts unique people, and nothing in the data says which people saw ads on more than one platform. Adding the figures would count the same person more than once, so no combined reach is reported.",
    },
  ];

  const metrics: ReportMetric[] = [
    metric({
      // Money spent is money spent — no platform can double-count another's
      // budget, so this total is arithmetic rather than a claim.
      key: "spend",
      label: "Spend",
      unit: "currency",
      currency: spend.currency,
      current: spend.totals,
      previous: priorSum("spend"),
    }),
    metric({
      key: "impressions",
      label: "Impressions",
      unit: "count",
      current: sum("impressions"),
      previous: priorSum("impressions"),
    }),
    metric({
      key: "clicks",
      label: "Clicks",
      unit: "count",
      current: sum("clicks"),
      previous: priorSum("clicks"),
    }),
  ];

  if (singleProvider) {
    const provider = providers[0]!;
    metrics.push(
      metric({
        key: "conversions",
        label: `Conversions reported by ${providerLabel(provider)}`,
        unit: "count",
        current: sum("conversions"),
        previous: priorSum("conversions"),
      }),
    );
  } else {
    // Each platform's own figure, and no total. Meta attributes on its own
    // click-and-view window; Google credits conversions to the click that
    // preceded them on its own model. The same purchase can appear in both,
    // so a combined figure would be larger than what happened — the identical
    // reasoning ADR 0007 applies across channels, which turns out to apply
    // just as strictly between two paid platforms.
    for (const provider of providers) {
      metrics.push(
        metric({
          key: `conversions_${provider}`,
          label: `Conversions reported by ${providerLabel(provider)}`,
          unit: "count",
          current: sumFor("conversions", provider),
        }),
      );
    }
    refusals.push({
      expected: "Total paid conversions",
      explanation: `Conversions are not totalled across ${providers.map(providerLabel).join(" and ")}. Each platform counts conversions it takes credit for, on its own attribution model and its own window, so one purchase can be counted by more than one of them. Each platform's own figure is reported above; a combined number would be larger than what actually happened.`,
    });
  }

  if (providers.includes("google-ads")) {
    // Not a refusal — the figures are reported — but a caveat a client needs
    // in order to read them correctly, and the reason a report regenerated a
    // week later will disagree with this one.
    refusals.push({
      expected: "Final figures for the most recent days",
      explanation:
        "Google Ads dates a conversion to the click that led to it rather than to the day it happened, so a purchase made today can be added to a day several weeks earlier. Figures for recent days are still filling in and will rise after this report was made. Nothing has changed when they do.",
    });
  }

  const states = cabinets.flatMap((cabinet) =>
    Object.values(cabinet.current).map((reading) => reading.state),
  );

  return {
    id: "paid",
    title: "Paid advertising",
    state: worstState(states),
    summary: `${cabinets.length} ad account${cabinets.length === 1 ? "" : "s"} measured across ${providers.map(providerLabel).join(" and ")}.`,
    metrics,
    sources: cabinets.map((cabinet) => ({
      id: `cabinet:${cabinet.name}`,
      label: cabinet.name,
      state: worstState(
        Object.values(cabinet.current).map((reading) => reading.state),
      ),
      reason:
        worstState(Object.values(cabinet.current).map((r) => r.state)) ===
        "available"
          ? ""
          : `Some days in this period could not be read from ${providerLabel(cabinet.provider)}.`,
      observedAt: null,
    })),
    refusals,
    breakdown: cabinets.flatMap((cabinet) =>
      cabinet.platforms.map((platform) => ({
        label: `${cabinet.name} — ${platform.platform}`,
        metrics: [
          metric({
            key: "spend",
            label: "Spend",
            unit: "currency",
            currency: cabinet.currency,
            current: platform.current.spend ?? {
              value: null,
              state: "unavailable",
            },
          }),
          metric({
            key: "clicks",
            label: "Clicks",
            unit: "count",
            current: platform.current.clicks ?? {
              value: null,
              state: "unavailable",
            },
          }),
        ],
      })),
    ),
  };
}

function organicSection(input: ComposeReportInput): ReportSection {
  const organic = input.organic;
  const metrics: ReportMetric[] = [
    metric({
      key: "clicks",
      label: "Organic clicks",
      unit: "count",
      current: organic.clicks,
      previous: organic.previous?.clicks,
    }),
    metric({
      key: "impressions",
      label: "Organic impressions",
      unit: "count",
      current: organic.impressions,
      previous: organic.previous?.impressions,
    }),
    metric({
      key: "position",
      label: "Average position",
      unit: "position",
      current: organic.position,
      previous: organic.previous?.position,
    }),
    metric({
      key: "sessions",
      label: "Organic sessions",
      unit: "count",
      current: organic.sessions,
      previous: organic.previous?.sessions,
    }),
    metric({
      key: "keyEvents",
      label: "Key events from organic",
      unit: "count",
      current: organic.keyEvents,
      previous: organic.previous?.keyEvents,
    }),
    metric({
      key: "seoHealth",
      label: "SEO health",
      unit: "percent",
      current: organic.seoHealth,
    }),
  ];

  return {
    id: "organic",
    title: "Organic search",
    state: worstState(organic.sources.map((source) => source.state)),
    summary: organic.sources.every((source) => source.state === "available")
      ? "Search Console and Analytics both reported for the full period."
      : "Some search or analytics evidence was unavailable; the affected figures say so rather than showing zero.",
    metrics,
    sources: organic.sources,
    refusals: [],
    breakdown: [],
  };
}

function socialSection(input: ComposeReportInput): ReportSection {
  const social = input.social;
  if (social.notConnected) {
    return {
      id: "social",
      title: "Social publishing",
      state: "unavailable",
      summary:
        "No social channel was connected during this period, so nothing was published from here. Posts made directly on the platforms are not visible to this report.",
      metrics: [],
      sources: [],
      refusals: [],
      breakdown: [],
    };
  }

  const published = social.publishedByPlatform.reduce(
    (total, row) => total + row.published,
    0,
  );
  const failed = social.publishedByPlatform.reduce(
    (total, row) => total + row.failed,
    0,
  );

  return {
    id: "social",
    title: "Social publishing",
    state: social.indeterminate > 0 ? "partial" : "available",
    summary:
      social.indeterminate > 0
        ? `${published} posts published. ${social.indeterminate} send(s) were interrupted with an unknown outcome and may or may not have gone out.`
        : `${published} posts published across ${social.publishedByPlatform.length} channel(s).`,
    metrics: [
      metric({
        key: "published",
        label: "Posts published",
        unit: "count",
        current: { value: published, state: "available" },
      }),
      metric({
        key: "failed",
        label: "Sends refused by the platform",
        unit: "count",
        current: { value: failed, state: "available" },
      }),
    ],
    sources: social.publishedByPlatform.map((row) => ({
      id: `social:${row.platform}`,
      label: row.platform,
      state: "available" as const,
      reason: "",
      observedAt: null,
    })),
    refusals: [
      {
        expected: "Post engagement",
        explanation:
          "This product publishes but does not read back likes, shares or comments, so no engagement figures are reported. They are visible in each platform's own analytics.",
      },
    ],
    breakdown: social.publishedByPlatform.map((row) => ({
      label: row.platform,
      metrics: [
        metric({
          key: "published",
          label: "Published",
          unit: "count",
          current: { value: row.published, state: "available" },
        }),
      ],
    })),
  };
}

function emailSection(input: ComposeReportInput): ReportSection {
  const email = input.email;
  return {
    id: "email",
    title: "Email",
    state: "available",
    summary: `${email.revisionsSaved} email revision(s) built across ${email.templatesBuilt} template(s).`,
    metrics: [
      metric({
        key: "templates",
        label: "Templates worked on",
        unit: "count",
        current: { value: email.templatesBuilt, state: "available" },
      }),
      metric({
        key: "revisions",
        label: "Revisions saved",
        unit: "count",
        current: { value: email.revisionsSaved, state: "available" },
      }),
      metric({
        key: "withFindings",
        label: "Saved with unresolved client defects",
        unit: "count",
        current: {
          value: email.withBlockingFindings,
          state: "available",
        },
      }),
    ],
    sources: [],
    refusals: [
      {
        expected: "Opens, clicks and unsubscribes",
        // The most important refusal in the document. Email is where a client
        // most expects a number, and it is the one channel this product has
        // no visibility into at all.
        explanation:
          "This product builds email HTML and does not send it, so it has no delivery, open, click or unsubscribe data. Those figures live in the email service the campaign was sent from, and any number here would be invented.",
      },
    ],
    breakdown: [],
  };
}

function actionsSection(input: ComposeReportInput): ReportSection {
  const actions = input.actions;
  if (actions.noAuditInPeriod) {
    return {
      id: "actions",
      title: "Work completed",
      state: "unavailable",
      summary:
        "No audit ran during this period, so changes to the site could not be verified. Work may still have been done; this report cannot speak to it.",
      metrics: [],
      sources: [],
      refusals: [],
      breakdown: [],
    };
  }
  return {
    id: "actions",
    title: "Work completed",
    state: "available",
    summary: `${actions.resolved} issue(s) resolved, ${actions.verified} confirmed by a re-check.`,
    metrics: [
      metric({
        key: "opened",
        label: "New issues found",
        unit: "count",
        current: { value: actions.opened, state: "available" },
      }),
      metric({
        key: "resolved",
        label: "Issues resolved",
        unit: "count",
        current: { value: actions.resolved, state: "available" },
      }),
      metric({
        key: "verified",
        label: "Verified by re-audit",
        unit: "count",
        current: { value: actions.verified, state: "available" },
      }),
    ],
    sources: [],
    refusals: [],
    breakdown: [],
  };
}

/**
 * The refusal that gives the whole document its character.
 *
 * Every reporting tool puts a combined conversion figure at the top. Meta
 * counts attributed conversions on a window it chooses; Analytics counts key
 * events on a last-click session model. The same purchase appears in both, so
 * the sum is larger than the number of things that happened.
 */
const CROSS_CHANNEL_REFUSAL: ReportRefusal = {
  expected: "Total conversions across all channels",
  explanation:
    "Conversions are not totalled across channels. Meta counts conversions it attributes on its own click and view window; Analytics counts key events on a last-click session model. The same purchase can appear in both, so a combined figure would be larger than what actually happened. Each channel's own figure is reported in its section.",
};

export function composeReport(input: ComposeReportInput): MarketingReport {
  const sections: ReportSection[] = [
    paidSection(input),
    organicSection(input),
    socialSection(input),
    emailSection(input),
    actionsSection(input),
  ];

  // Attached to paid, where a reader looking for the combined number will be.
  const paid = sections.find((section) => section.id === "paid")!;
  paid.refusals = [CROSS_CHANNEL_REFUSAL, ...paid.refusals];

  const coverageGaps = sections.flatMap((section) =>
    section.sources
      .filter((source) => source.state !== "available")
      .map((source) => ({
        source: `${section.title} — ${source.label}`,
        reason: source.reason || "This source could not be read.",
        remedy: null,
      })),
  );
  for (const section of sections) {
    if (section.state === "unavailable" && section.sources.length === 0) {
      coverageGaps.push({
        source: section.title,
        reason: section.summary,
        remedy: null,
      });
    }
  }

  return {
    id: "",
    projectId: input.projectId,
    title: input.title,
    period: input.period,
    narrative: input.narrative ?? null,
    sections,
    coverageGaps,
    generatedAt: input.generatedAt,
    brandRevision: input.brandRevision,
  };
}

/** The worst state across every section, for a list view. */
export function reportState(report: MarketingReport): ReportAvailability {
  return worstState(report.sections.map((section) => section.state));
}

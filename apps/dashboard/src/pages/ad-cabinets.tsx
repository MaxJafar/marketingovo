import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSite } from "../context/site-context";
import {
  useApprovePublishIntent,
  useCabinetDiscovery,
  useCabinetPerformance,
  useCabinets,
  useIntegrations,
  useLinkCabinet,
  usePublishIntents,
  useRemoveCabinet,
  useSearchTerms,
  useStartWorkflow,
  useUpdateCabinet,
  useWithdrawPublishIntent,
} from "../api/queries";
import type {
  AdPlatform,
  ChannelAccount,
  ChannelMetricSummary,
  PublishIntent,
} from "../api/contracts";
import { fmt, useI18n, type Messages } from "../i18n";

/**
 * Ad Cabinets — Meta and Google Ads.
 *
 * Two things about this page are deliberate and worth stating, because both
 * cost something and both are the point.
 *
 * A metric that was not measured renders as a dash and its reason, never as
 * zero. That makes the page emptier than a paid dashboard normally looks, and
 * the alternative is a screen that says a campaign spent nothing when the truth
 * is that nobody could read it.
 *
 * The approval control is the only place in this product that a person can
 * consent to spending money, and it exists here rather than in the agent's
 * hands on purpose. Everything an attached agent drafts arrives in the review
 * queue below, unapproved, with the exact payload it would send.
 */

const PROVIDER_LABEL: Record<string, string> = {
  "meta-ads": "Meta",
  "google-ads": "Google Ads",
};

const HEADLINE_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "cost_per_conversion",
  "ctr",
] as const;

function formatMetric(summary: ChannelMetricSummary): string {
  if (summary.value === null) return "—";
  const value = summary.value;
  const rounded =
    Math.abs(value) >= 1000
      ? Math.round(value).toLocaleString()
      : (Math.round(value * 100) / 100).toLocaleString();
  if (summary.metricKey === "ctr") return `${rounded}%`;
  // A currency the rows disagreed on comes back null, and the total is then
  // shown without a symbol and flagged rather than silently mixed.
  return summary.currency ? `${rounded} ${summary.currency}` : rounded;
}

function stateLabel(summary: ChannelMetricSummary, t: Messages): string | null {
  switch (summary.state) {
    case "available":
      return null;
    case "partial":
      return fmt(t.adCabinets.state.partial, {
        observed: summary.observedDays,
        requested: summary.requestedDays,
      });
    case "failed":
      return t.adCabinets.state.failed;
    case "unavailable":
      return t.adCabinets.state.unavailable;
  }
}

function CabinetPerformance({ cabinetId }: { cabinetId: string }) {
  const { t } = useI18n();
  // Widened copy: metric keys arrive as free-form API strings, and unknown
  // ones fall back to the raw key rather than crashing the lookup's typing.
  const metricLabels: Record<string, string> = { ...t.adCabinets.metricLabel };
  const query = useCabinetPerformance(cabinetId);
  const performance = query.data?.data;

  if (query.isLoading) {
    return <p className="pixel-hero-sub">{t.adCabinets.performance.loading}</p>;
  }
  if (!performance) {
    return (
      <p className="pixel-hero-sub">{t.adCabinets.performance.unreadable}</p>
    );
  }
  if (performance.lastSyncedAt === null) {
    return (
      <p className="pixel-hero-sub">{t.adCabinets.performance.neverSynced}</p>
    );
  }

  const byPlatform = new Map<AdPlatform, ChannelMetricSummary[]>();
  for (const summary of performance.summaries) {
    if (!HEADLINE_METRICS.includes(summary.metricKey as never)) continue;
    const bucket = byPlatform.get(summary.platform) ?? [];
    bucket.push(summary);
    byPlatform.set(summary.platform, bucket);
  }
  // Account totals first, then each platform. Facebook and Instagram are
  // different auctions with different costs, and the split is the reason a
  // marketer opens this page rather than Meta's own overview.
  const order: AdPlatform[] = [
    "all",
    "facebook",
    "instagram",
    "messenger",
    "audience_network",
    "google_search",
    "google_search_partners",
    "google_display",
    "google_youtube",
    "google_performance_max",
    "unknown",
  ];

  return (
    <>
      <p className="pixel-hero-sub">
        {fmt(t.adCabinets.performance.syncedRange, {
          start: performance.start,
          end: performance.end,
          date: new Date(performance.lastSyncedAt).toLocaleString(),
        })}
      </p>
      {order
        .filter((platform) => byPlatform.has(platform))
        .map((platform) => (
          <div key={platform} className="pixel-subsection">
            <h4>{t.adCabinets.platformLabel[platform]}</h4>
            <table className="pixel-table">
              <thead>
                <tr>
                  <th scope="col">{t.adCabinets.performance.metricHeader}</th>
                  <th scope="col">{t.adCabinets.performance.valueHeader}</th>
                  <th scope="col">{t.adCabinets.performance.coverageHeader}</th>
                </tr>
              </thead>
              <tbody>
                {HEADLINE_METRICS.map((key) => {
                  const summary = byPlatform
                    .get(platform)!
                    .find((entry) => entry.metricKey === key);
                  if (!summary) return null;
                  const state = stateLabel(summary, t);
                  return (
                    <tr key={key}>
                      <th scope="row">{metricLabels[key] ?? key}</th>
                      <td>{formatMetric(summary)}</td>
                      <td>
                        {state ? (
                          <span
                            className="pixel-hero-sub"
                            title={summary.note ?? undefined}
                          >
                            {state}
                          </span>
                        ) : (
                          t.adCabinets.performance.coverageComplete
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* The reason a number is missing is more useful than the gap. */}
            {byPlatform
              .get(platform)!
              .filter((entry) => entry.value === null && entry.note)
              .slice(0, 2)
              .map((entry) => (
                <p key={entry.metricKey} className="pixel-hero-sub">
                  {fmt(t.adCabinets.performance.metricNote, {
                    metric: metricLabels[entry.metricKey] ?? entry.metricKey,
                    note: entry.note ?? "",
                  })}
                </p>
              ))}
          </div>
        ))}
    </>
  );
}

/**
 * The queries that triggered ads, most expensive first.
 *
 * Google Ads only, and the reason an agency charges for an account review:
 * this is where money leaves without returning. Terms already added as
 * keywords or negatives are excluded, so what is listed is what is left to
 * decide about.
 *
 * The note under the table is not boilerplate. Performance Max reports no
 * queries at all, so a short list on an account dominated by it means very
 * little — and an operator reading "nothing wasted" from a blind spot is worse
 * off than one who was told the analysis has a limit.
 */
function WastedQueries({ cabinetId }: { cabinetId: string }) {
  const { t } = useI18n();
  const query = useSearchTerms(cabinetId, true, { actionableOnly: true });
  const terms = query.data?.data.items ?? [];

  return (
    <div className="pixel-subsection">
      <h4>{t.adCabinets.wasted.heading}</h4>
      {query.isLoading ? (
        <p className="pixel-hero-sub">{t.adCabinets.wasted.loading}</p>
      ) : terms.length === 0 ? (
        <p className="pixel-hero-sub">{t.adCabinets.wasted.empty}</p>
      ) : (
        <table className="pixel-table">
          <thead>
            <tr>
              <th scope="col">{t.adCabinets.wasted.queryHeader}</th>
              <th scope="col">{t.adCabinets.wasted.matchedHeader}</th>
              <th scope="col">{t.adCabinets.wasted.clicksHeader}</th>
              <th scope="col">{t.adCabinets.wasted.costHeader}</th>
              <th scope="col">{t.adCabinets.wasted.conversionsHeader}</th>
            </tr>
          </thead>
          <tbody>
            {terms.slice(0, 25).map((term) => (
              <tr key={`${term.campaignId}-${term.adGroupId}-${term.query}`}>
                <th scope="row">{term.query}</th>
                <td>
                  {term.matchedKeyword ?? "—"}
                  <span className="pixel-hero-sub"> · {term.matchType}</span>
                </td>
                <td>{term.clicks ?? "—"}</td>
                <td>
                  {term.cost === null
                    ? "—"
                    : `${Math.round(term.cost * 100) / 100}${term.currency ? ` ${term.currency}` : ""}`}
                </td>
                {/* Fractional on purpose: Google divides one conversion
                    across the clicks it credits, and rounding 0.5 to zero
                    would turn a converting query into a wasteful one. */}
                <td>{term.conversions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="pixel-hero-sub">{t.adCabinets.wasted.footnote}</p>
    </div>
  );
}

function ApprovalQueue({ siteId }: { siteId: string }) {
  const { t } = useI18n();
  const intents = usePublishIntents(siteId);
  const approve = useApprovePublishIntent(siteId);
  const withdraw = useWithdrawPublishIntent(siteId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = intents.data?.data.items ?? [];

  if (items.length === 0) {
    return <p className="pixel-hero-sub">{t.adCabinets.queue.empty}</p>;
  }

  const budgetLine = (intent: PublishIntent): string => {
    const { dailyBudget, lifetimeBudget, currency } = intent.budget;
    const parts: string[] = [];
    if (dailyBudget !== null)
      parts.push(
        fmt(t.adCabinets.queue.perDay, {
          amount: `${dailyBudget}${currency ? ` ${currency}` : ""}`,
        }),
      );
    if (lifetimeBudget !== null)
      parts.push(
        fmt(t.adCabinets.queue.lifetime, {
          amount: `${lifetimeBudget}${currency ? ` ${currency}` : ""}`,
        }),
      );
    return parts.length > 0 ? parts.join(", ") : t.adCabinets.queue.noBudget;
  };

  return (
    <>
      <p className="pixel-hero-sub">
        {items.length === 1
          ? fmt(t.adCabinets.queue.stagedOne, { count: items.length })
          : fmt(t.adCabinets.queue.stagedMany, { count: items.length })}
      </p>
      <ul className="pixel-list">
        {items.map((intent) => (
          <li key={intent.id}>
            <div>
              <strong>{budgetLine(intent)}</strong>
              <p className="pixel-hero-sub">
                {fmt(t.adCabinets.queue.stagedBy, {
                  name: intent.stagedBy,
                  date: new Date(intent.stagedAt).toLocaleString(),
                  hash: intent.payloadHash.slice(0, 12),
                })}
              </p>
            </div>
            <button
              type="button"
              className="pixel-button"
              aria-expanded={expanded === intent.id}
              onClick={() =>
                setExpanded(expanded === intent.id ? null : intent.id)
              }
            >
              {expanded === intent.id
                ? t.adCabinets.queue.hidePayload
                : t.adCabinets.queue.readPayload}
            </button>
            {expanded === intent.id ? (
              <pre className="pixel-code">
                {JSON.stringify(intent.payload, null, 2)}
              </pre>
            ) : null}
            <div className="pixel-row-actions">
              <button
                type="button"
                className="pixel-button pixel-button-primary"
                disabled={approve.isPending || expanded !== intent.id}
                title={
                  expanded === intent.id
                    ? undefined
                    : t.adCabinets.queue.readBeforeApproving
                }
                onClick={() =>
                  approve.mutate({
                    id: intent.id,
                    payloadHash: intent.payloadHash,
                  })
                }
              >
                {t.adCabinets.queue.approveExact}
              </button>
              <button
                type="button"
                className="pixel-button"
                disabled={withdraw.isPending}
                onClick={() =>
                  withdraw.mutate({
                    id: intent.id,
                    note: "Withdrawn by the operator from the review queue.",
                  })
                }
              >
                {t.adCabinets.queue.withdraw}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {approve.isError ? (
        <p className="pixel-hero-sub" role="alert">
          {approve.error instanceof Error
            ? approve.error.message
            : t.adCabinets.queue.approvalRefused}
        </p>
      ) : null}
      <p className="pixel-hero-sub">{t.adCabinets.queue.footnote}</p>
    </>
  );
}

export function AdCabinetsPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const integrations = useIntegrations(siteId);
  const cabinets = useCabinets(siteId);
  const linkCabinet = useLinkCabinet(siteId);
  const updateCabinet = useUpdateCabinet(siteId);
  const removeCabinet = useRemoveCabinet(siteId);
  const startWorkflow = useStartWorkflow();
  const [discovering, setDiscovering] = useState(false);
  const [discoverProvider, setDiscoverProvider] = useState("meta-ads");
  const discovery = useCabinetDiscovery(siteId, discovering, discoverProvider);
  const [openCabinet, setOpenCabinet] = useState<string | null>(null);

  const items = integrations.data?.data.items ?? [];
  const meta = useMemo(
    () => items.find((integration) => integration.id === "meta-ads"),
    [items],
  );
  const google = useMemo(
    () => items.find((integration) => integration.id === "google-ads"),
    [items],
  );
  const isLive = (status?: string) =>
    status === "connected" || status === "degraded";
  const metaConnected = isLive(meta?.status);
  const googleConnected = isLive(google?.status);
  const connected = metaConnected || googleConnected;
  const providerConnected =
    discoverProvider === "google-ads" ? googleConnected : metaConnected;
  const linked = cabinets.data?.data.items ?? [];

  return (
    <>
      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.adCabinets.connections.heading}</h2>
        </div>
        <div className="pixel-panel-body">
          {meta?.status === "expired" ? (
            <p className="pixel-hero-sub" role="alert">
              {t.adCabinets.connections.metaExpiredBefore}{" "}
              <Link to="/integrations" className="pixel-linklike">
                {t.adCabinets.connections.integrationsLink}
              </Link>
              {t.adCabinets.connections.metaExpiredAfter}
            </p>
          ) : metaConnected ? (
            <p className="pixel-hero-sub">
              {meta?.expiresAt
                ? fmt(t.adCabinets.connections.metaConnectedExpiry, {
                    date: new Date(meta.expiresAt).toLocaleDateString(),
                  })
                : t.adCabinets.connections.metaConnected}
            </p>
          ) : (
            <p className="pixel-hero-sub">
              {t.adCabinets.connections.metaMissingBefore}{" "}
              <Link to="/integrations" className="pixel-linklike">
                {t.adCabinets.connections.integrationsLink}
              </Link>
              {t.adCabinets.connections.metaMissingAfter}
            </p>
          )}

          {google?.status === "expired" ? (
            <p className="pixel-hero-sub" role="alert">
              {t.adCabinets.connections.googleExpiredBefore}{" "}
              <Link to="/integrations" className="pixel-linklike">
                {t.adCabinets.connections.integrationsLink}
              </Link>
              {t.adCabinets.connections.googleExpiredAfter}
            </p>
          ) : googleConnected ? (
            <p className="pixel-hero-sub">
              {t.adCabinets.connections.googleConnected}
            </p>
          ) : (
            <p className="pixel-hero-sub">
              {t.adCabinets.connections.googleMissingBefore}{" "}
              <Link to="/integrations" className="pixel-linklike">
                {t.adCabinets.connections.integrationsLink}
              </Link>
              {t.adCabinets.connections.googleMissingAfter}
            </p>
          )}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.adCabinets.cabinets.heading}</h2>
          <div className="pixel-row-actions">
            <select
              className="pixel-input"
              aria-label={t.adCabinets.cabinets.providerSelectLabel}
              value={discoverProvider}
              onChange={(event) => {
                setDiscoverProvider(event.target.value);
                setDiscovering(false);
              }}
            >
              <option value="meta-ads">Meta</option>
              <option value="google-ads">Google Ads</option>
            </select>
            <button
              type="button"
              className="pixel-button"
              disabled={!providerConnected || discovery.isFetching}
              onClick={() => setDiscovering(true)}
            >
              {discovery.isFetching
                ? fmt(t.adCabinets.cabinets.asking, {
                    provider:
                      PROVIDER_LABEL[discoverProvider] ?? discoverProvider,
                  })
                : t.adCabinets.cabinets.findAccounts}
            </button>
            <button
              type="button"
              className="pixel-button pixel-button-primary"
              disabled={linked.length === 0 || startWorkflow.isPending}
              onClick={() =>
                startWorkflow.mutate({
                  projectId: siteId,
                  workflowId: "ads-audit",
                  options: {},
                })
              }
            >
              {startWorkflow.isPending
                ? t.adCabinets.cabinets.starting
                : t.adCabinets.cabinets.runPaidAudit}
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          {linked.length > 0 ? (
            <p className="pixel-hero-sub">
              {t.adCabinets.cabinets.auditCheckBefore}{" "}
              <Link to="/actions" className="pixel-linklike">
                {t.adCabinets.cabinets.actionsLink}
              </Link>
              {t.adCabinets.cabinets.auditCheckAfter}
            </p>
          ) : null}
          {linked.length === 0 ? (
            <p className="pixel-hero-sub">{t.adCabinets.cabinets.empty}</p>
          ) : (
            <ul className="pixel-list">
              {linked.map((cabinet: ChannelAccount) => (
                <li key={cabinet.id}>
                  <div>
                    <strong>{cabinet.displayName}</strong>
                    <p className="pixel-hero-sub">
                      {cabinet.externalId}
                      {` · ${PROVIDER_LABEL[cabinet.provider] ?? cabinet.provider}`}
                      {cabinet.currency
                        ? ` · ${fmt(t.adCabinets.cabinets.billsIn, {
                            currency: cabinet.currency,
                          })}`
                        : ` · ${t.adCabinets.cabinets.noCurrency}`}
                      {cabinet.dailySpendCap !== null
                        ? ` · ${fmt(t.adCabinets.cabinets.dailyCap, {
                            cap: cabinet.dailySpendCap,
                          })}`
                        : ` · ${t.adCabinets.cabinets.noDailyCap}`}
                    </p>
                  </div>
                  <div className="pixel-row-actions">
                    <button
                      type="button"
                      className="pixel-button"
                      aria-expanded={openCabinet === cabinet.id}
                      onClick={() =>
                        setOpenCabinet(
                          openCabinet === cabinet.id ? null : cabinet.id,
                        )
                      }
                    >
                      {openCabinet === cabinet.id
                        ? t.adCabinets.cabinets.hidePerformance
                        : t.adCabinets.cabinets.showPerformance}
                    </button>
                    <button
                      type="button"
                      className="pixel-button"
                      disabled={updateCabinet.isPending}
                      onClick={() =>
                        updateCabinet.mutate({
                          id: cabinet.id,
                          input: { archived: true },
                        })
                      }
                    >
                      {t.adCabinets.cabinets.archive}
                    </button>
                    <button
                      type="button"
                      className="pixel-button"
                      disabled={removeCabinet.isPending}
                      onClick={() => removeCabinet.mutate(cabinet.id)}
                      title={t.adCabinets.cabinets.removeTitle}
                    >
                      {t.adCabinets.cabinets.remove}
                    </button>
                  </div>
                  {openCabinet === cabinet.id ? (
                    <>
                      <CabinetPerformance cabinetId={cabinet.id} />
                      {cabinet.provider === "google-ads" ? (
                        <WastedQueries cabinetId={cabinet.id} />
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {discovery.isError ? (
            <p className="pixel-hero-sub" role="alert">
              {discovery.error instanceof Error
                ? discovery.error.message
                : fmt(t.adCabinets.cabinets.discoveryFailed, {
                    provider:
                      PROVIDER_LABEL[discoverProvider] ?? discoverProvider,
                  })}
            </p>
          ) : null}

          {discovery.data ? (
            <div className="pixel-subsection">
              <h4>{t.adCabinets.cabinets.discoveredHeading}</h4>
              <ul className="pixel-list">
                {discovery.data.data.items.map((candidate) => (
                  <li key={candidate.externalId}>
                    <div>
                      <strong>{candidate.displayName}</strong>
                      <p className="pixel-hero-sub">
                        {candidate.externalId}
                        {candidate.currency ? ` · ${candidate.currency}` : ""}
                        {candidate.status ? ` · ${candidate.status}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="pixel-button"
                      disabled={candidate.linked || linkCabinet.isPending}
                      onClick={() =>
                        linkCabinet.mutate({
                          projectId: siteId,
                          provider: discoverProvider,
                          kind: "ads",
                          externalId: candidate.externalId,
                          displayName: candidate.displayName,
                          currency: candidate.currency,
                        })
                      }
                    >
                      {candidate.linked
                        ? t.adCabinets.cabinets.linked
                        : t.adCabinets.cabinets.linkToWorkspace}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>{t.adCabinets.queue.heading}</h2>
        </div>
        <div className="pixel-panel-body">
          <ApprovalQueue siteId={siteId} />
        </div>
      </section>
    </>
  );
}

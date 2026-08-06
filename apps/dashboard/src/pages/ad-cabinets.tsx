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

const PLATFORM_LABEL: Record<AdPlatform, string> = {
  all: "All placements",
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
  google_search: "Google Search",
  google_search_partners: "Search Partners",
  google_display: "Google Display",
  google_youtube: "YouTube",
  google_performance_max: "Performance Max",
  unknown: "Other placement",
};

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

const METRIC_LABEL: Record<string, string> = {
  spend: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  link_clicks: "Link clicks",
  conversions: "Conversions",
  conversion_value: "Conversion value",
  cost_per_conversion: "Cost per conversion",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  reach: "Reach",
  frequency: "Frequency",
  video_plays: "Video plays",
};

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

function stateLabel(summary: ChannelMetricSummary): string | null {
  switch (summary.state) {
    case "available":
      return null;
    case "partial":
      return `partial — ${summary.observedDays}/${summary.requestedDays} days`;
    case "failed":
      return "could not read";
    case "unavailable":
      return "not measured";
  }
}

function CabinetPerformance({ cabinetId }: { cabinetId: string }) {
  const query = useCabinetPerformance(cabinetId);
  const performance = query.data?.data;

  if (query.isLoading) {
    return <p className="pixel-hero-sub">Reading stored measurements…</p>;
  }
  if (!performance) {
    return (
      <p className="pixel-hero-sub">
        This cabinet's measurements could not be read.
      </p>
    );
  }
  if (performance.lastSyncedAt === null) {
    return (
      <p className="pixel-hero-sub">
        Never synced. Run a paid audit to read this cabinet's spend and
        delivery. Nothing is shown until something is measured.
      </p>
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
        {performance.start} to {performance.end}. Last synced{" "}
        {new Date(performance.lastSyncedAt).toLocaleString()}.
      </p>
      {order
        .filter((platform) => byPlatform.has(platform))
        .map((platform) => (
          <div key={platform} className="pixel-subsection">
            <h4>{PLATFORM_LABEL[platform]}</h4>
            <table className="pixel-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Value</th>
                  <th scope="col">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {HEADLINE_METRICS.map((key) => {
                  const summary = byPlatform
                    .get(platform)!
                    .find((entry) => entry.metricKey === key);
                  if (!summary) return null;
                  const state = stateLabel(summary);
                  return (
                    <tr key={key}>
                      <th scope="row">{METRIC_LABEL[key] ?? key}</th>
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
                          "complete"
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
                  {METRIC_LABEL[entry.metricKey] ?? entry.metricKey}:{" "}
                  {entry.note}
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
  const query = useSearchTerms(cabinetId, true, { actionableOnly: true });
  const terms = query.data?.data.items ?? [];

  return (
    <div className="pixel-subsection">
      <h4>Queries worth a decision</h4>
      {query.isLoading ? (
        <p className="pixel-hero-sub">Reading stored search terms…</p>
      ) : terms.length === 0 ? (
        <p className="pixel-hero-sub">
          No search terms stored for this account yet. Run a paid audit.
        </p>
      ) : (
        <table className="pixel-table">
          <thead>
            <tr>
              <th scope="col">Query</th>
              <th scope="col">Matched</th>
              <th scope="col">Clicks</th>
              <th scope="col">Cost</th>
              <th scope="col">Conversions</th>
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
      <p className="pixel-hero-sub">
        Search and Shopping only. Performance Max and Demand Gen report no
        queries at all, and Google withholds terms too rare to anonymise, so
        this never accounts for all of an account's clicks. A short list is not
        evidence that nothing is being wasted.
      </p>
    </div>
  );
}

function ApprovalQueue({ siteId }: { siteId: string }) {
  const intents = usePublishIntents(siteId);
  const approve = useApprovePublishIntent(siteId);
  const withdraw = useWithdrawPublishIntent(siteId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = intents.data?.data.items ?? [];

  if (items.length === 0) {
    return (
      <p className="pixel-hero-sub">
        Nothing is waiting for approval. An attached agent can draft a campaign
        and stage it here; it cannot approve one, and neither can this product
        send anything to an ad platform yet. Google Ads is read-only by design —
        see ADR 0008.
      </p>
    );
  }

  const budgetLine = (intent: PublishIntent): string => {
    const { dailyBudget, lifetimeBudget, currency } = intent.budget;
    const parts: string[] = [];
    if (dailyBudget !== null)
      parts.push(`${dailyBudget}${currency ? ` ${currency}` : ""} per day`);
    if (lifetimeBudget !== null)
      parts.push(`${lifetimeBudget}${currency ? ` ${currency}` : ""} lifetime`);
    return parts.length > 0 ? parts.join(", ") : "No budget named";
  };

  return (
    <>
      <p className="pixel-hero-sub">
        {items.length} staged payload{items.length === 1 ? "" : "s"}. Read the
        exact request before approving — approval binds to this version, and a
        payload edited afterwards has to be approved again.
      </p>
      <ul className="pixel-list">
        {items.map((intent) => (
          <li key={intent.id}>
            <div>
              <strong>{budgetLine(intent)}</strong>
              <p className="pixel-hero-sub">
                Staged by {intent.stagedBy} on{" "}
                {new Date(intent.stagedAt).toLocaleString()}. Payload{" "}
                {intent.payloadHash.slice(0, 12)}…
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
              {expanded === intent.id ? "Hide payload" : "Read payload"}
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
                    : "Read the payload before approving it."
                }
                onClick={() =>
                  approve.mutate({
                    id: intent.id,
                    payloadHash: intent.payloadHash,
                  })
                }
              >
                Approve this exact payload
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
                Withdraw
              </button>
            </div>
          </li>
        ))}
      </ul>
      {approve.isError ? (
        <p className="pixel-hero-sub" role="alert">
          {approve.error instanceof Error
            ? approve.error.message
            : "The approval was refused."}
        </p>
      ) : null}
      <p className="pixel-hero-sub">
        Approving records your consent to this exact payload. It does not send
        anything: this build has no outbound write path to Meta, by design.
      </p>
    </>
  );
}

export function AdCabinetsPage() {
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
          <h2>Connections</h2>
        </div>
        <div className="pixel-panel-body">
          {meta?.status === "expired" ? (
            <p className="pixel-hero-sub" role="alert">
              The Meta access token expired. Meta System User tokens have a
              fixed lifetime and do not refresh — generate a new one in Business
              Manager and paste it in{" "}
              <Link to="/integrations" className="pixel-linklike">
                Integrations
              </Link>
              . Until then, spend and delivery are unreadable rather than zero.
            </p>
          ) : metaConnected ? (
            <p className="pixel-hero-sub">
              Meta is connected
              {meta?.expiresAt
                ? `. The token expires ${new Date(meta.expiresAt).toLocaleDateString()} — rotate it before then.`
                : "."}
            </p>
          ) : (
            <p className="pixel-hero-sub">
              Meta is not connected, so Facebook and Instagram spend cannot be
              read. Generate a System User token in Meta Business Manager and
              paste it in{" "}
              <Link to="/integrations" className="pixel-linklike">
                Integrations
              </Link>
              .
            </p>
          )}

          {google?.status === "expired" ? (
            <p className="pixel-hero-sub" role="alert">
              The Google sign-in for Google Ads expired. Reconnect it in{" "}
              <Link to="/integrations" className="pixel-linklike">
                Integrations
              </Link>
              . Until then, Google spend is unreadable rather than zero.
            </p>
          ) : googleConnected ? (
            <p className="pixel-hero-sub">Google Ads is connected.</p>
          ) : (
            <p className="pixel-hero-sub">
              Google Ads is not connected. It needs two things: a Google
              sign-in, and a developer token of your own from the API Center of
              a Google Ads manager account. Marketingovo ships no developer
              token — one compiled into the app would make every install a
              single identity to Google, and its rate limits and terms attach to
              whoever holds it. Google approves new tokens by hand, so apply
              before you need it. Both go in{" "}
              <Link to="/integrations" className="pixel-linklike">
                Integrations
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="pixel-panel-head">
          <h2>Ad cabinets</h2>
          <div className="pixel-row-actions">
            <select
              className="pixel-input"
              aria-label="Provider to search for accounts"
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
                ? `Asking ${PROVIDER_LABEL[discoverProvider] ?? discoverProvider}…`
                : "Find my accounts"}
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
              {startWorkflow.isPending ? "Starting…" : "Run paid audit"}
            </button>
          </div>
        </div>
        <div className="pixel-panel-body">
          {linked.length > 0 ? (
            <p className="pixel-hero-sub">
              The paid audit also checks the pages these ads send people to —
              destinations that 404, redirects that drop the click identifier,
              and landing pages that never mention what is being bid on.
              Findings appear in{" "}
              <Link to="/actions" className="pixel-linklike">
                Actions
              </Link>
              . Running an SEO audit first makes the check cheaper and adds page
              speed to it; without one, every destination is fetched directly.
            </p>
          ) : null}
          {linked.length === 0 ? (
            <p className="pixel-hero-sub">
              No ad account is linked to this workspace. One login usually
              reaches several accounts, and which of them this workspace reads
              is your decision — connecting a provider links nothing on its own.
            </p>
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
                        ? ` · bills in ${cabinet.currency}`
                        : " · no currency reported for this account"}
                      {cabinet.dailySpendCap !== null
                        ? ` · daily cap ${cabinet.dailySpendCap}`
                        : " · no local daily cap set"}
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
                        ? "Hide performance"
                        : "Show performance"}
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
                      Archive
                    </button>
                    <button
                      type="button"
                      className="pixel-button"
                      disabled={removeCabinet.isPending}
                      onClick={() => removeCabinet.mutate(cabinet.id)}
                      title="Removes the cabinet and every measurement recorded against it."
                    >
                      Remove
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
                : `${PROVIDER_LABEL[discoverProvider] ?? discoverProvider} could not be reached for account discovery.`}
            </p>
          ) : null}

          {discovery.data ? (
            <div className="pixel-subsection">
              <h4>Accounts this credential can reach</h4>
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
                      {candidate.linked ? "Linked" : "Link to this workspace"}
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
          <h2>Waiting for your approval</h2>
        </div>
        <div className="pixel-panel-body">
          <ApprovalQueue siteId={siteId} />
        </div>
      </section>
    </>
  );
}

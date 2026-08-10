import { useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { KeywordOpportunity } from "../api/contracts";
import { useKeywords, useStartWorkflow } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
import { DataTable } from "../components/data-table";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import {
  NEEDS_WEBSITE_OR_SEARCH_CONSOLE,
  useWorkspaceCapabilities,
} from "../lib/capabilities";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";

export function KeywordsPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const query = useKeywords(siteId);
  const start = useStartWorkflow();
  const [seed, setSeed] = useState("");
  const [planSeeds, setPlanSeeds] = useState("");
  const workspace = query.data?.data;
  const opportunities = workspace?.opportunities ?? [];
  const clusters = workspace?.clusters ?? [];
  const columns = useMemo<ColumnDef<KeywordOpportunity, unknown>[]>(
    () => [
      {
        id: "keyword",
        header: t.keywords.opportunities.columns.keyword,
        cell: ({ row }) => (
          <div className="keyword-cell">
            <strong>{row.original.keyword}</strong>
            <small>
              {row.original.cluster ?? t.keywords.opportunities.noCluster}
            </small>
          </div>
        ),
      },
      {
        id: "intent",
        header: t.keywords.opportunities.columns.intent,
        cell: ({ row }) => (
          <StatusBadge status={row.original.intent ?? "unknown"} />
        ),
      },
      {
        id: "position",
        header: t.keywords.opportunities.columns.position,
        cell: ({ row }) => formatNumber(row.original.position),
      },
      {
        id: "volume",
        header: t.keywords.opportunities.columns.volume,
        cell: ({ row }) => formatNumber(row.original.volume),
      },
      {
        id: "difficulty",
        header: t.keywords.opportunities.columns.difficulty,
        cell: ({ row }) =>
          row.original.difficulty === null ||
          row.original.difficulty === undefined
            ? t.common.unavailable
            : `${formatNumber(row.original.difficulty)}/100`,
      },
      {
        id: "opportunity",
        header: t.keywords.opportunities.columns.opportunity,
        cell: ({ row }) =>
          row.original.opportunityScore === null ||
          row.original.opportunityScore === undefined
            ? t.common.unavailable
            : `${formatNumber(row.original.opportunityScore)}/100`,
      },
      {
        id: "target",
        header: t.keywords.opportunities.columns.target,
        cell: ({ row }) => {
          const url = safeExternalUrl(row.original.targetUrl);
          return url ? (
            <a
              className="table-link"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {t.keywords.opportunities.openPage}
            </a>
          ) : row.original.targetUrl ? (
            t.keywords.opportunities.invalidUrl
          ) : (
            t.keywords.opportunities.unassigned
          );
        },
      },
    ],
    [t],
  );

  function startKeywordResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = seed.trim();
    if (!value) return;
    start.mutate({
      projectId: siteId,
      workflowId: "keyword-research",
      options: {
        seed: value,
        includeTrends: true,
        includePaa: true,
        includeRelated: true,
      },
    });
  }

  function startContentPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seeds = planSeeds
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (seeds.length === 0) return;
    start.mutate({
      projectId: siteId,
      workflowId: "content-plan",
      options: { seeds },
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.keywords.eyebrow}
        title={t.keywords.title}
        description={t.keywords.description}
      />
      <div className="two-column-grid">
        <Card className="schedule-editor">
          <form onSubmit={startKeywordResearch}>
            <SectionHeading
              title={t.keywords.research.title}
              description={t.keywords.research.description}
            />
            <label>
              {t.keywords.research.seedLabel}
              <input
                value={seed}
                onChange={(event) => setSeed(event.currentTarget.value)}
                placeholder="technical seo software"
                required
              />
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={!siteId || start.isPending}>
                {start.isPending
                  ? t.keywords.starting
                  : t.keywords.research.start}
              </Button>
            </div>
          </form>
        </Card>
        <Card className="schedule-editor">
          <form onSubmit={startContentPlan}>
            <SectionHeading
              title={t.keywords.plan.title}
              description={t.keywords.plan.description}
            />
            <label>
              {t.keywords.plan.seedsLabel}
              <textarea
                value={planSeeds}
                onChange={(event) => setPlanSeeds(event.currentTarget.value)}
                placeholder={"technical seo\nsite migrations\ncore web vitals"}
                rows={4}
                required
              />
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={!siteId || start.isPending}>
                {start.isPending
                  ? t.keywords.starting
                  : t.keywords.plan.generate}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {start.isError ? (
        <InlineNotice tone="danger" title={t.keywords.notStartedTitle}>
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title={t.keywords.queuedTitle}>
          {t.keywords.queuedBody}
        </InlineNotice>
      ) : null}
      {workspace?.providerUsage ? (
        <InlineNotice tone="info" title={t.keywords.usage.title}>
          {fmt(t.keywords.usage.reported, {
            cost: workspace.providerUsage.actualCostUsd.toFixed(4),
            billable: workspace.providerUsage.billableRequests,
          })}
          {workspace.providerUsage.unreportedBillableRequests > 0
            ? ` ${fmt(t.keywords.usage.unreported, {
                count: workspace.providerUsage.unreportedBillableRequests,
              })}`
            : ` ${t.keywords.usage.allReported}`}
          {workspace.providerUsage.freeRequests > 0
            ? ` ${fmt(t.keywords.usage.free, {
                count: workspace.providerUsage.freeRequests,
              })}`
            : ""}
        </InlineNotice>
      ) : null}
      <CapabilityGate
        capabilities={capabilities}
        requires={NEEDS_WEBSITE_OR_SEARCH_CONSOLE}
      >
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          <section>
            <SectionHeading
              title={t.keywords.clusters.title}
              description={t.keywords.clusters.description}
            />
            {clusters.length > 0 ? (
              <div className="cluster-grid">
                {clusters.map((cluster) => (
                  <Card key={cluster.id} className="cluster-card">
                    <span className="cluster-count">
                      {fmt(t.keywords.clusters.keywordCount, {
                        count: formatNumber(cluster.keywords),
                      })}
                    </span>
                    <h3>{cluster.name}</h3>
                    <div className="progress-row">
                      <span>{t.keywords.clusters.coverage}</span>
                      <strong>
                        {cluster.contentCoverage === null ||
                        cluster.contentCoverage === undefined
                          ? t.common.unavailable
                          : `${formatNumber(cluster.contentCoverage)}%`}
                      </strong>
                    </div>
                    {cluster.contentCoverage !== null &&
                    cluster.contentCoverage !== undefined ? (
                      <div className="progress-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, cluster.contentCoverage))}%`,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="progress-unavailable">
                        {t.keywords.clusters.coverageUnavailable}
                      </div>
                    )}
                    <p>
                      {cluster.recommendedBrief ?? t.keywords.clusters.noBrief}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t.keywords.clusters.emptyTitle}
                description={t.keywords.clusters.emptyBody}
              />
            )}
          </section>
          <section>
            <SectionHeading
              title={t.keywords.opportunities.title}
              description={t.keywords.opportunities.description}
            />
            {opportunities.length > 0 ? (
              <DataTable
                data={opportunities}
                columns={columns}
                label={t.keywords.opportunities.tableLabel}
              />
            ) : (
              <EmptyState
                title={t.keywords.opportunities.emptyTitle}
                description={t.keywords.opportunities.emptyBody}
              />
            )}
          </section>
        </QueryState>
      </CapabilityGate>
    </div>
  );
}

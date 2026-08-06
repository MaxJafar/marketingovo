import { useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { KeywordOpportunity } from "../api/contracts";
import { useKeywords, useStartWorkflow } from "../api/queries";
import { useSite } from "../context/site-context";
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
        header: "Keyword",
        cell: ({ row }) => (
          <div className="keyword-cell">
            <strong>{row.original.keyword}</strong>
            <small>{row.original.cluster ?? "No cluster"}</small>
          </div>
        ),
      },
      {
        id: "intent",
        header: "Intent",
        cell: ({ row }) => (
          <StatusBadge status={row.original.intent ?? "unknown"} />
        ),
      },
      {
        id: "position",
        header: "Position",
        cell: ({ row }) => formatNumber(row.original.position),
      },
      {
        id: "volume",
        header: "Volume",
        cell: ({ row }) => formatNumber(row.original.volume),
      },
      {
        id: "difficulty",
        header: "Difficulty",
        cell: ({ row }) =>
          row.original.difficulty === null ||
          row.original.difficulty === undefined
            ? "Unavailable"
            : `${formatNumber(row.original.difficulty)}/100`,
      },
      {
        id: "opportunity",
        header: "Opportunity",
        cell: ({ row }) =>
          row.original.opportunityScore === null ||
          row.original.opportunityScore === undefined
            ? "Unavailable"
            : `${formatNumber(row.original.opportunityScore)}/100`,
      },
      {
        id: "target",
        header: "Target page",
        cell: ({ row }) => {
          const url = safeExternalUrl(row.original.targetUrl);
          return url ? (
            <a
              className="table-link"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open page
            </a>
          ) : row.original.targetUrl ? (
            "Invalid URL"
          ) : (
            "Unassigned"
          );
        },
      },
    ],
    [],
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
        eyebrow="Demand intelligence"
        title="Keywords & content"
        description="Find query opportunities, group intent, and turn search demand into a focused content plan."
      />
      <div className="two-column-grid">
        <Card className="schedule-editor">
          <form onSubmit={startKeywordResearch}>
            <SectionHeading
              title="Research one market"
              description="Expand a seed across suggestions, intent, Trends, PAA, and related searches."
            />
            <label>
              Seed keyword
              <input
                value={seed}
                onChange={(event) => setSeed(event.currentTarget.value)}
                placeholder="technical seo software"
                required
              />
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={!siteId || start.isPending}>
                {start.isPending ? "Starting…" : "Start keyword research"}
              </Button>
            </div>
          </form>
        </Card>
        <Card className="schedule-editor">
          <form onSubmit={startContentPlan}>
            <SectionHeading
              title="Build a content plan"
              description="Enter up to ten seed topics, separated by commas or new lines."
            />
            <label>
              Seed topics
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
                {start.isPending ? "Starting…" : "Generate content plan"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {start.isError ? (
        <InlineNotice tone="danger" title="Research could not start">
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title="Research queued">
          The durable run is visible under Audits. This page will show the
          latest completed research result.
        </InlineNotice>
      ) : null}
      {workspace?.providerUsage ? (
        <InlineNotice tone="info" title="Latest research provider usage">
          ${workspace.providerUsage.actualCostUsd.toFixed(4)} was reported by
          metered providers across {workspace.providerUsage.billableRequests}{" "}
          billable request(s).
          {workspace.providerUsage.unreportedBillableRequests > 0
            ? ` ${workspace.providerUsage.unreportedBillableRequests} billable request(s) did not report a per-call cost and are not shown as zero.`
            : " All billable calls in this result reported their cost."}
          {workspace.providerUsage.freeRequests > 0
            ? ` ${workspace.providerUsage.freeRequests} completed request(s) used known-free sources.`
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
              title="Content clusters"
              description="Coverage and brief guidance from the connected keyword source."
            />
            {clusters.length > 0 ? (
              <div className="cluster-grid">
                {clusters.map((cluster) => (
                  <Card key={cluster.id} className="cluster-card">
                    <span className="cluster-count">
                      {formatNumber(cluster.keywords)} keywords
                    </span>
                    <h3>{cluster.name}</h3>
                    <div className="progress-row">
                      <span>Content coverage</span>
                      <strong>
                        {cluster.contentCoverage === null ||
                        cluster.contentCoverage === undefined
                          ? "Unavailable"
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
                        Coverage measurement unavailable
                      </div>
                    )}
                    <p>
                      {cluster.recommendedBrief ??
                        "No brief recommendation available."}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No content clusters"
                description="Connect a keyword provider or import keyword data to build topic clusters."
              />
            )}
          </section>
          <section>
            <SectionHeading
              title="Keyword opportunities"
              description="Prioritize demand using position, search volume, difficulty, and opportunity score."
            />
            {opportunities.length > 0 ? (
              <DataTable
                data={opportunities}
                columns={columns}
                label="Keyword opportunities"
              />
            ) : (
              <EmptyState
                title="No keyword opportunities"
                description="The API returned a valid empty opportunity set."
              />
            )}
          </section>
        </QueryState>
      </CapabilityGate>
    </div>
  );
}

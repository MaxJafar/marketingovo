import { useState, type FormEvent } from "react";
import { useCompetitors, useStartWorkflow } from "../api/queries";
import { useSite } from "../context/site-context";
import { FreshnessNotice, QueryState } from "../components/data-state";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  formatDate,
  formatNumber,
} from "../components/ui";

export function CompetitorsPage() {
  const { siteId } = useSite();
  const query = useCompetitors(siteId);
  const start = useStartWorkflow();
  const [domains, setDomains] = useState("");
  const competitors = query.data?.data.items ?? [];
  const gapTerms = query.data?.data.contentGapTerms ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const competitorUrls = domains
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((value) =>
        /^https?:\/\//iu.test(value) ? value : `https://${value}`,
      );
    if (competitorUrls.length === 0) return;
    start.mutate({
      projectId: siteId,
      workflowId: "compare",
      options: { competitorUrls, maxUrls: 30, renderMode: "static" },
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Market context"
        title="Competitors"
        description="Crawl evidence, publishing cadence and content gaps, all gathered from each rival's own site — no provider key required. Keyword-level gaps stay explicitly unavailable until a supporting provider supplies them."
      />
      <Card className="schedule-editor">
        <form onSubmit={submit}>
          <SectionHeading
            title="Run a reproducible comparison"
            description="Enter one or two competitor domains. Every site is crawled with the same limits; this view reports technical evidence, not invented visibility data."
          />
          <label>
            Competitor domains
            <textarea
              value={domains}
              onChange={(event) => setDomains(event.currentTarget.value)}
              placeholder={"competitor-one.com\ncompetitor-two.com"}
              rows={3}
              required
            />
          </label>
          <div className="form-actions">
            <Button type="submit" disabled={!siteId || start.isPending}>
              {start.isPending ? "Starting…" : "Compare sites"}
            </Button>
          </div>
        </form>
      </Card>
      {start.isError ? (
        <InlineNotice tone="danger" title="Comparison could not start">
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title="Comparison queued">
          The durable run is visible under Audits. This page will show the
          latest completed comparison.
        </InlineNotice>
      ) : null}
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        siteId={siteId}
        onRetry={() => void query.refetch()}
      >
        <FreshnessNotice meta={query.data?.meta} />
        {competitors.length > 0 ? (
          <div className="competitor-grid">
            {competitors.map((competitor) => (
              <Card key={competitor.id} className="competitor-card">
                <div className="competitor-heading">
                  <div className="domain-avatar">
                    {competitor.domain.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h2>{competitor.domain}</h2>
                    <small>
                      Updated {formatDate(competitor.lastUpdatedAt, true)}
                    </small>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Publishes every</dt>
                    <dd>
                      {typeof competitor.cadenceDays === "number" ? (
                        `${competitor.cadenceDays.toFixed(1)} days`
                      ) : (
                        <span title="No feed was found, or the feed carried too few dated posts to measure an interval.">
                          Unavailable
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Last published</dt>
                    <dd>
                      {typeof competitor.freshnessSeconds === "number"
                        ? `${Math.round(competitor.freshnessSeconds / 86400)} days ago`
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Technical health</dt>
                    <dd>
                      {competitor.technicalHealth === null ||
                      competitor.technicalHealth === undefined
                        ? "Unavailable"
                        : `${formatNumber(competitor.technicalHealth)}/100`}
                    </dd>
                  </div>
                  <div>
                    <dt>Change</dt>
                    <dd>
                      {competitor.technicalHealthChange === null ||
                      competitor.technicalHealthChange === undefined ? (
                        <span title="No earlier comparison includes this site, so there is no baseline to move against.">
                          Unavailable
                        </span>
                      ) : (
                        // Health is a 0-100 score, so its movement is measured
                        // in points. Labelling it "%" would read as a relative
                        // change and overstate a move at the low end.
                        <StatusBadge
                          status={
                            competitor.technicalHealthChange === 0
                              ? "unknown"
                              : competitor.technicalHealthChange > 0
                                ? "healthy"
                                : "degraded"
                          }
                          label={
                            competitor.technicalHealthChange === 0
                              ? "No change"
                              : `${competitor.technicalHealthChange > 0 ? "+" : ""}${formatNumber(competitor.technicalHealthChange)} pts`
                          }
                        />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Shared keywords</dt>
                    <dd>{formatNumber(competitor.sharedKeywords)}</dd>
                  </div>
                  <div>
                    <dt>Keyword gaps</dt>
                    <dd>{formatNumber(competitor.keywordGaps)}</dd>
                  </div>
                  <div>
                    <dt>Covers gap topics</dt>
                    <dd>
                      {competitor.contentGaps === null ||
                      competitor.contentGaps === undefined
                        ? "Unavailable"
                        : formatNumber(competitor.contentGaps)}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No competitors configured"
            description="Add competitor domains through the API or setup flow to unlock market context."
          />
        )}
        {gapTerms.length > 0 ? (
          <Card>
            <SectionHeading
              title="Topics they cover that you do not"
              description="Derived from the pages themselves, so no keyword provider is required. Each term appears in the competitor pages at a materially higher density than on your site."
            />
            <ul className="gap-term-list">
              {gapTerms.map((gap) => (
                <li key={gap.term}>
                  <span className="gap-term">{gap.term}</span>
                  <small>
                    on {formatNumber(gap.referencesCovering)} of{" "}
                    {formatNumber(competitors.length)} compared{" "}
                    {competitors.length === 1 ? "site" : "sites"}
                  </small>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </QueryState>
    </div>
  );
}

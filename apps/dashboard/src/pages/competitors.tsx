import { useState, type FormEvent } from "react";
import { useCompetitors, useStartWorkflow } from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
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
  const { t } = useI18n();
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
        eyebrow={t.competitors.eyebrow}
        title={t.competitors.title}
        description={t.competitors.description}
      />
      <Card className="schedule-editor">
        <form onSubmit={submit}>
          <SectionHeading
            title={t.competitors.form.title}
            description={t.competitors.form.description}
          />
          <label>
            {t.competitors.form.domainsLabel}
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
              {start.isPending
                ? t.competitors.form.starting
                : t.competitors.form.submit}
            </Button>
          </div>
        </form>
      </Card>
      {start.isError ? (
        <InlineNotice tone="danger" title={t.competitors.notStartedTitle}>
          {start.error.message}
        </InlineNotice>
      ) : null}
      {start.isSuccess ? (
        <InlineNotice tone="success" title={t.competitors.queuedTitle}>
          {t.competitors.queuedBody}
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
                      {fmt(t.competitors.card.updated, {
                        date: formatDate(competitor.lastUpdatedAt, true),
                      })}
                    </small>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>{t.competitors.card.publishesEvery}</dt>
                    <dd>
                      {typeof competitor.cadenceDays === "number" ? (
                        fmt(t.competitors.card.cadenceDays, {
                          count: competitor.cadenceDays.toFixed(1),
                        })
                      ) : (
                        <span title={t.competitors.card.cadenceUnavailableHint}>
                          {t.common.unavailable}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.lastPublished}</dt>
                    <dd>
                      {typeof competitor.freshnessSeconds === "number"
                        ? fmt(t.competitors.card.daysAgo, {
                            count: Math.round(
                              competitor.freshnessSeconds / 86400,
                            ),
                          })
                        : t.common.unavailable}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.technicalHealth}</dt>
                    <dd>
                      {competitor.technicalHealth === null ||
                      competitor.technicalHealth === undefined
                        ? t.common.unavailable
                        : `${formatNumber(competitor.technicalHealth)}/100`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.change}</dt>
                    <dd>
                      {competitor.technicalHealthChange === null ||
                      competitor.technicalHealthChange === undefined ? (
                        <span title={t.competitors.card.changeUnavailableHint}>
                          {t.common.unavailable}
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
                              ? t.competitors.card.noChange
                              : fmt(t.competitors.card.changePts, {
                                  value: `${competitor.technicalHealthChange > 0 ? "+" : ""}${formatNumber(competitor.technicalHealthChange)}`,
                                })
                          }
                        />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.sharedKeywords}</dt>
                    <dd>{formatNumber(competitor.sharedKeywords)}</dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.keywordGaps}</dt>
                    <dd>{formatNumber(competitor.keywordGaps)}</dd>
                  </div>
                  <div>
                    <dt>{t.competitors.card.coversGapTopics}</dt>
                    <dd>
                      {competitor.contentGaps === null ||
                      competitor.contentGaps === undefined
                        ? t.common.unavailable
                        : formatNumber(competitor.contentGaps)}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t.competitors.emptyTitle}
            description={t.competitors.emptyBody}
          />
        )}
        {gapTerms.length > 0 ? (
          <Card>
            <SectionHeading
              title={t.competitors.gaps.title}
              description={t.competitors.gaps.description}
            />
            <ul className="gap-term-list">
              {gapTerms.map((gap) => (
                <li key={gap.term}>
                  <span className="gap-term">{gap.term}</span>
                  <small>
                    {competitors.length === 1
                      ? fmt(t.competitors.gaps.coverageOne, {
                          covering: formatNumber(gap.referencesCovering),
                          total: formatNumber(competitors.length),
                        })
                      : fmt(t.competitors.gaps.coverageMany, {
                          covering: formatNumber(gap.referencesCovering),
                          total: formatNumber(competitors.length),
                        })}
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

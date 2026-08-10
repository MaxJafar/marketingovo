import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "@tanstack/react-router";
import type {
  CrawlPathEvidence,
  ExtractionPageEvidence,
  HreflangPageEvidence,
  RedirectPathEvidence,
  RunEvidencePage,
  RunEvidenceSection,
  SitemapEvidence,
} from "../api/contracts";
import { useReplayRun, useRun, useRunEvidence } from "../api/queries";
import { fmt, useI18n } from "../i18n";
import { FreshnessNotice, QueryState } from "../components/data-state";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";

const EVIDENCE_PAGE_SIZE = 50;
const evidenceTabs: Array<{ id: RunEvidenceSection }> = [
  { id: "crawl" },
  { id: "redirects" },
  { id: "hreflang" },
  { id: "extractions" },
];

function ExternalUrl({ value, label }: { value: string; label?: string }) {
  const url = safeExternalUrl(value);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" title={value}>
      {label ?? value}
    </a>
  ) : (
    <span title={value}>{label ?? value}</span>
  );
}

function SampleList({
  title,
  sample,
}: {
  title: string;
  sample: SitemapEvidence["missingIndexable"];
}) {
  const { t } = useI18n();
  if (sample.total === 0) return null;
  return (
    <section className="evidence-sample">
      <h3>
        {title} <span>{formatNumber(sample.total)}</span>
      </h3>
      {sample.total === null ? (
        <p>{t.auditDetail.sitemap.sampleUnavailable}</p>
      ) : (
        <>
          <ul>
            {sample.urls.map((url) => (
              <li key={url}>
                <ExternalUrl value={url} />
              </li>
            ))}
          </ul>
          {!sample.complete ? (
            <small>
              {fmt(t.auditDetail.sitemap.sampleTruncated, {
                shown: formatNumber(sample.urls.length),
                total: formatNumber(sample.total),
              })}
            </small>
          ) : null}
        </>
      )}
    </section>
  );
}

function SitemapPanel({ sitemap }: { sitemap: SitemapEvidence }) {
  const { t } = useI18n();
  const coverage =
    sitemap.coverage === null
      ? t.common.unavailable
      : `${formatNumber(sitemap.coverage * 100)}%`;
  return (
    <Card className="evidence-sitemap" aria-labelledby="sitemap-evidence-title">
      <div className="evidence-panel-heading">
        <div>
          <p className="eyebrow">{t.auditDetail.sitemap.eyebrow}</p>
          <h2 id="sitemap-evidence-title">{t.auditDetail.sitemap.title}</h2>
          <p>{t.auditDetail.sitemap.description}</p>
        </div>
        <StatusBadge status={sitemap.state} />
      </div>
      <div className="evidence-metric-grid">
        <div>
          <span>{t.auditDetail.sitemap.declaredUrls}</span>
          <strong>{formatNumber(sitemap.declaredUrls)}</strong>
        </div>
        <div>
          <span>{t.auditDetail.sitemap.indexableDiscovered}</span>
          <strong>{formatNumber(sitemap.discoveredIndexableUrls)}</strong>
        </div>
        <div>
          <span>{t.auditDetail.sitemap.matched}</span>
          <strong>{formatNumber(sitemap.matchedIndexableUrls)}</strong>
        </div>
        <div>
          <span>{t.auditDetail.sitemap.coverage}</span>
          <strong>{coverage}</strong>
        </div>
      </div>
      {sitemap.sourceUrl ? (
        <p className="evidence-source-link">
          {t.auditDetail.sitemap.snapshotBefore}{" "}
          <ExternalUrl value={sitemap.sourceUrl} />
          {sitemap.fetchStatusCode !== null
            ? fmt(t.auditDetail.sitemap.httpStatusSuffix, {
                status: sitemap.fetchStatusCode,
              })
            : ""}
        </p>
      ) : null}
      {sitemap.files.length > 0 ? (
        <div className="table-shell evidence-file-table">
          <table aria-label={t.auditDetail.sitemap.filesLabel}>
            <thead>
              <tr>
                <th scope="col">{t.auditDetail.sitemap.fileColumn}</th>
                <th scope="col">{t.auditDetail.sitemap.typeColumn}</th>
                <th scope="col">{t.auditDetail.sitemap.httpColumn}</th>
                <th scope="col">{t.auditDetail.sitemap.locationsColumn}</th>
              </tr>
            </thead>
            <tbody>
              {sitemap.files.map((file) => (
                <tr key={file.url}>
                  <td className="evidence-url-cell">
                    <ExternalUrl value={file.url} />
                  </td>
                  <td>{file.kind}</td>
                  <td>{formatNumber(file.statusCode)}</td>
                  <td>{formatNumber(file.locCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="evidence-sample-grid">
        <SampleList
          title={t.auditDetail.sitemap.missingIndexable}
          sample={sitemap.missingIndexable}
        />
        <SampleList
          title={t.auditDetail.sitemap.declaredNotCrawled}
          sample={sitemap.declaredNotCrawled}
        />
        <SampleList
          title={t.auditDetail.sitemap.brokenDeclared}
          sample={sitemap.brokenDeclared}
        />
      </div>
      {sitemap.warnings.length > 0 ? (
        <ul className="evidence-warning-list">
          {sitemap.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function CrawlEvidenceTable({ items }: { items: CrawlPathEvidence[] }) {
  const { t } = useI18n();
  return (
    <div className="table-shell evidence-table">
      <table aria-label={t.auditDetail.crawl.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.auditDetail.crawl.pageColumn}</th>
            <th scope="col">{t.auditDetail.crawl.depthColumn}</th>
            <th scope="col">{t.auditDetail.crawl.referrerColumn}</th>
            <th scope="col">{t.auditDetail.crawl.httpColumn}</th>
            <th scope="col">{t.auditDetail.crawl.indexableColumn}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sourceUrl}>
              <td className="url-cell">
                <ExternalUrl
                  value={item.finalUrl}
                  label={item.title ?? item.finalUrl}
                />
                <small>{item.sourceUrl}</small>
              </td>
              <td>{formatNumber(item.crawlDepth)}</td>
              <td className="evidence-url-cell">
                {item.discoveredFrom ? (
                  <ExternalUrl value={item.discoveredFrom} />
                ) : item.crawlDepth === 0 ? (
                  t.auditDetail.crawl.seed
                ) : (
                  t.common.unavailable
                )}
              </td>
              <td>{formatNumber(item.statusCode)}</td>
              <td>
                <StatusBadge
                  status={
                    item.indexable === null
                      ? "unknown"
                      : item.indexable
                        ? "indexable"
                        : "blocked"
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RedirectEvidenceTable({ items }: { items: RedirectPathEvidence[] }) {
  const { t } = useI18n();
  return (
    <div className="table-shell evidence-table">
      <table aria-label={t.auditDetail.redirects.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.auditDetail.redirects.requestedColumn}</th>
            <th scope="col">{t.auditDetail.redirects.pathColumn}</th>
            <th scope="col">{t.auditDetail.redirects.hopsColumn}</th>
            <th scope="col">{t.auditDetail.redirects.finalHttpColumn}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sourceUrl}>
              <td className="evidence-url-cell">
                <ExternalUrl value={item.sourceUrl} />
              </td>
              <td>
                <ol className="redirect-path-list">
                  {item.chain.map((url, index) => (
                    <li key={`${url}-${index}`}>
                      <ExternalUrl value={url} />
                    </li>
                  ))}
                </ol>
              </td>
              <td>{formatNumber(item.hopCount)}</td>
              <td>{formatNumber(item.finalStatusCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HreflangEvidenceTable({ items }: { items: HreflangPageEvidence[] }) {
  const { t } = useI18n();
  const rows = items.flatMap((item) =>
    item.alternates.map((alternate, index) => ({ item, alternate, index })),
  );
  return (
    <div className="table-shell evidence-table hreflang-matrix">
      <table aria-label={t.auditDetail.hreflang.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.auditDetail.hreflang.sourceColumn}</th>
            <th scope="col">{t.auditDetail.hreflang.languageColumn}</th>
            <th scope="col">{t.auditDetail.hreflang.alternateColumn}</th>
            <th scope="col">{t.auditDetail.hreflang.targetColumn}</th>
            <th scope="col">{t.auditDetail.hreflang.reciprocalColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, alternate, index }) => (
            <tr key={`${item.sourceUrl}-${alternate.lang}-${index}`}>
              <td className="evidence-url-cell">
                <ExternalUrl value={item.sourceUrl} />
              </td>
              <td>
                {item.htmlLang ?? t.common.unavailable} /{" "}
                {item.selfLanguage ?? t.auditDetail.hreflang.missing}
              </td>
              <td>
                <strong>{alternate.lang}</strong>
                {alternate.selfReference ? (
                  <small> {t.auditDetail.hreflang.selfReference}</small>
                ) : null}
              </td>
              <td className="evidence-url-cell">
                {alternate.resolvedUrl ? (
                  <ExternalUrl value={alternate.resolvedUrl} />
                ) : (
                  alternate.declaredUrl
                )}
                <StatusBadge status={alternate.targetState} />
              </td>
              <td>
                <StatusBadge status={alternate.reciprocal} />
                {alternate.reciprocal === "language_mismatch" ? (
                  <small>
                    {fmt(t.auditDetail.hreflang.mismatch, {
                      expected:
                        alternate.expectedReturnLanguage ??
                        t.auditDetail.hreflang.sourceFallback,
                      observed:
                        alternate.observedReturnLanguages.join(", ") ||
                        t.auditDetail.hreflang.noneFallback,
                    })}
                  </small>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExtractionEvidenceTable({
  items,
}: {
  items: ExtractionPageEvidence[];
}) {
  const { t } = useI18n();
  return (
    <div className="table-shell evidence-table extraction-table">
      <table aria-label={t.auditDetail.extractions.tableLabel}>
        <thead>
          <tr>
            <th scope="col">{t.auditDetail.extractions.pageColumn}</th>
            <th scope="col">{t.auditDetail.extractions.fieldsColumn}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sourceUrl}>
              <td className="evidence-url-cell">
                <ExternalUrl value={item.sourceUrl} />
              </td>
              <td>
                <dl className="extraction-field-list">
                  {item.fields.map((field, index) => (
                    <div key={`${field.label}-${index}`}>
                      <dt>{field.label}</dt>
                      <dd>
                        {field.value ?? t.auditDetail.extractions.noMatch}
                        {field.truncated
                          ? t.auditDetail.extractions.truncatedSuffix
                          : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceResults({ evidence }: { evidence: RunEvidencePage }) {
  const { t } = useI18n();
  if (evidence.items.length === 0) {
    const tab = evidenceTabs.find(
      (candidate) => candidate.id === evidence.section,
    );
    const label = tab ? t.auditDetail.tabs[tab.id].label : undefined;
    return (
      <EmptyState
        title={fmt(t.auditDetail.emptyTitle, {
          section: label?.toLowerCase() ?? t.auditDetail.fallbackEvidence,
        })}
        description={
          evidence.state === "unavailable"
            ? t.auditDetail.emptyUnavailable
            : fmt(t.auditDetail.emptyFiltered, {
                section: label?.toLowerCase() ?? t.auditDetail.fallbackRecords,
              })
        }
      />
    );
  }
  if (evidence.section === "crawl")
    return (
      <CrawlEvidenceTable
        items={evidence.items.filter(
          (item): item is CrawlPathEvidence => item.kind === "crawl",
        )}
      />
    );
  if (evidence.section === "redirects")
    return (
      <RedirectEvidenceTable
        items={evidence.items.filter(
          (item): item is RedirectPathEvidence => item.kind === "redirect",
        )}
      />
    );
  if (evidence.section === "hreflang")
    return (
      <HreflangEvidenceTable
        items={evidence.items.filter(
          (item): item is HreflangPageEvidence => item.kind === "hreflang",
        )}
      />
    );
  return (
    <ExtractionEvidenceTable
      items={evidence.items.filter(
        (item): item is ExtractionPageEvidence => item.kind === "extraction",
      )}
    />
  );
}

export function AuditDetailPage() {
  const { t } = useI18n();
  const params = useParams({ strict: false }) as { runId?: string };
  const runId = params.runId ?? "";
  const [section, setSection] = useState<RunEvidenceSection>("crawl");
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const query = useRun(runId);
  const replay = useReplayRun(runId);
  const run = query.data?.data;
  const runIsTerminal = Boolean(
    run && run.status !== "queued" && run.status !== "running",
  );
  const evidenceQuery = useRunEvidence(runId, {
    section,
    offset,
    limit: EVIDENCE_PAGE_SIZE,
    search,
    enabled: runIsTerminal,
  });
  const evidence = evidenceQuery.data?.data;

  useEffect(() => {
    replay.reset();
    setOffset(0);
    setSearchInput("");
    setSearch("");
  }, [runId]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  return (
    <div className="page-stack">
      <Link to="/audits" className="back-link">
        <Icon name="arrow" /> {t.auditDetail.backToAudits}
      </Link>
      <PageHeader
        eyebrow={t.auditDetail.eyebrow}
        title={
          run
            ? fmt(t.auditDetail.runTitle, { id: run.id })
            : t.auditDetail.fallbackTitle
        }
        description={t.auditDetail.description}
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              !run ||
              run.status === "queued" ||
              run.status === "running" ||
              replay.isPending
            }
            onClick={() => replay.mutate()}
          >
            <Icon name="audits" />
            {replay.isPending
              ? t.auditDetail.queuingReplay
              : t.auditDetail.replayConfiguration}
          </Button>
        }
      />
      {replay.isError ? (
        <InlineNotice tone="danger" title={t.auditDetail.replayErrorTitle}>
          {replay.error.message}
        </InlineNotice>
      ) : null}
      {replay.data ? (
        <InlineNotice tone="success" title={t.auditDetail.replayQueuedTitle}>
          {fmt(t.auditDetail.replayQueuedBefore, {
            version: replay.data.data.configurationVersion,
          })}{" "}
          <Link to="/audits/$runId" params={{ runId: replay.data.data.run.id }}>
            {t.auditDetail.replayQueuedLink}
          </Link>
          {t.auditDetail.replayQueuedAfter}
        </InlineNotice>
      ) : null}
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {run ? (
          <>
            <FreshnessNotice meta={query.data?.meta} />
            <InlineNotice tone="info" title={t.auditDetail.boundaryTitle}>
              {t.auditDetail.boundaryBody}
            </InlineNotice>
            <div className="detail-summary-grid">
              <Card>
                <span className="detail-label">
                  {t.auditDetail.summary.status}
                </span>
                <StatusBadge status={run.status} />
              </Card>
              <Card>
                <span className="detail-label">
                  {t.auditDetail.summary.started}
                </span>
                <strong>{formatDate(run.startedAt, true)}</strong>
              </Card>
              <Card>
                <span className="detail-label">
                  {t.auditDetail.summary.completed}
                </span>
                <strong>{formatDate(run.completedAt, true)}</strong>
              </Card>
              <Card>
                <span className="detail-label">
                  {t.auditDetail.summary.issueInstances}
                </span>
                <strong>{formatNumber(run.issuesFound)}</strong>
              </Card>
            </div>

            <div className="two-column-grid">
              <Card>
                <h2>{t.auditDetail.breakdownTitle}</h2>
                {(run.issueBreakdown ?? []).length > 0 ? (
                  <ul className="breakdown-list">
                    {run.issueBreakdown?.map((item) => (
                      <li key={item.severity}>
                        <StatusBadge status={item.severity} />
                        <strong>{formatNumber(item.count)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title={t.auditDetail.breakdownEmptyTitle}
                    description={t.auditDetail.breakdownEmptyBody}
                  />
                )}
              </Card>
              <Card>
                <h2>{t.auditDetail.runLogTitle}</h2>
                {(run.log ?? []).length > 0 ? (
                  <ol className="run-log">
                    {run.log?.map((entry, index) => (
                      <li key={`${entry.at}-${index}`}>
                        <time>{formatDate(entry.at, true)}</time>
                        <span>{entry.message}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    title={t.auditDetail.runLogEmptyTitle}
                    description={t.auditDetail.runLogEmptyBody}
                  />
                )}
              </Card>
            </div>

            <QueryState
              isLoading={evidenceQuery.isLoading}
              error={evidenceQuery.error}
              onRetry={() => void evidenceQuery.refetch()}
            >
              {evidence ? (
                <>
                  <FreshnessNotice meta={evidenceQuery.data?.meta} />
                  <SitemapPanel sitemap={evidence.sitemap} />
                  <Card
                    className="evidence-workbench"
                    aria-labelledby="evidence-workbench-title"
                  >
                    <div className="evidence-panel-heading">
                      <div>
                        <p className="eyebrow">
                          {t.auditDetail.workbench.eyebrow}
                        </p>
                        <h2 id="evidence-workbench-title">
                          {t.auditDetail.workbench.title}
                        </h2>
                        <p>{t.auditDetail.workbench.description}</p>
                      </div>
                      <StatusBadge status={evidence.state} />
                    </div>
                    <div
                      className="evidence-tabs"
                      role="tablist"
                      aria-label={t.auditDetail.workbench.tablistLabel}
                    >
                      {evidenceTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={section === tab.id}
                          title={t.auditDetail.tabs[tab.id].description}
                          onClick={() => {
                            setSection(tab.id);
                            setOffset(0);
                          }}
                        >
                          {t.auditDetail.tabs[tab.id].label}
                        </button>
                      ))}
                    </div>
                    <form className="evidence-toolbar" onSubmit={applySearch}>
                      <div className="search-field">
                        <Icon name="search" />
                        <label className="sr-only" htmlFor="evidence-search">
                          {t.auditDetail.workbench.searchLabel}
                        </label>
                        <input
                          id="evidence-search"
                          type="search"
                          value={searchInput}
                          maxLength={160}
                          placeholder={
                            t.auditDetail.workbench.searchPlaceholder
                          }
                          onChange={(event) =>
                            setSearchInput(event.currentTarget.value)
                          }
                        />
                      </div>
                      <Button type="submit" variant="secondary">
                        {t.auditDetail.workbench.search}
                      </Button>
                      {search ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setSearchInput("");
                            setSearch("");
                            setOffset(0);
                          }}
                        >
                          {t.auditDetail.workbench.clear}
                        </Button>
                      ) : null}
                    </form>
                    <EvidenceResults evidence={evidence} />
                    <nav
                      className="pagination-controls"
                      aria-label={t.auditDetail.workbench.paginationLabel}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={evidence.pageInfo.offset === 0}
                        onClick={() =>
                          setOffset(
                            Math.max(
                              0,
                              evidence.pageInfo.offset -
                                evidence.pageInfo.limit,
                            ),
                          )
                        }
                      >
                        {t.auditDetail.workbench.previous}
                      </Button>
                      <span>
                        {fmt(t.auditDetail.workbench.pageIndicator, {
                          page: formatNumber(
                            Math.floor(
                              evidence.pageInfo.offset /
                                evidence.pageInfo.limit,
                            ) + 1,
                          ),
                          pages: formatNumber(
                            Math.max(
                              1,
                              Math.ceil(
                                evidence.pageInfo.total /
                                  evidence.pageInfo.limit,
                              ),
                            ),
                          ),
                          records: formatNumber(evidence.pageInfo.total),
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={evidence.pageInfo.nextOffset === null}
                        onClick={() =>
                          setOffset(evidence.pageInfo.nextOffset ?? offset)
                        }
                      >
                        {t.auditDetail.workbench.next}
                      </Button>
                    </nav>
                  </Card>
                </>
              ) : null}
            </QueryState>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

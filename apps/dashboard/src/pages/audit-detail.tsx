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
const evidenceTabs: Array<{
  id: RunEvidenceSection;
  label: string;
  description: string;
}> = [
  {
    id: "crawl",
    label: "Crawl paths",
    description: "Shortest captured discovery path and first referrer.",
  },
  {
    id: "redirects",
    label: "Redirects",
    description: "Requested URL, every redirect hop, and the final response.",
  },
  {
    id: "hreflang",
    label: "Hreflang",
    description: "Language targets, self-references, and reciprocal evidence.",
  },
  {
    id: "extractions",
    label: "Extractions",
    description: "Custom fields captured by the configured extractor rules.",
  },
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
  if (sample.total === 0) return null;
  return (
    <section className="evidence-sample">
      <h3>
        {title} <span>{formatNumber(sample.total)}</span>
      </h3>
      {sample.total === null ? (
        <p>Unavailable because no verified sitemap snapshot was captured.</p>
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
              Showing the first {formatNumber(sample.urls.length)} of{" "}
              {formatNumber(sample.total)} URLs. The JSON report preserves the
              complete captured cohort.
            </small>
          ) : null}
        </>
      )}
    </section>
  );
}

function SitemapPanel({ sitemap }: { sitemap: SitemapEvidence }) {
  const coverage =
    sitemap.coverage === null
      ? "Unavailable"
      : `${formatNumber(sitemap.coverage * 100)}%`;
  return (
    <Card className="evidence-sitemap" aria-labelledby="sitemap-evidence-title">
      <div className="evidence-panel-heading">
        <div>
          <p className="eyebrow">Captured source</p>
          <h2 id="sitemap-evidence-title">Sitemap coverage</h2>
          <p>
            Coverage compares captured indexable crawl URLs with the sitemap
            snapshot used by this exact run.
          </p>
        </div>
        <StatusBadge status={sitemap.state} />
      </div>
      <div className="evidence-metric-grid">
        <div>
          <span>Declared URLs</span>
          <strong>{formatNumber(sitemap.declaredUrls)}</strong>
        </div>
        <div>
          <span>Indexable discovered</span>
          <strong>{formatNumber(sitemap.discoveredIndexableUrls)}</strong>
        </div>
        <div>
          <span>Matched</span>
          <strong>{formatNumber(sitemap.matchedIndexableUrls)}</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{coverage}</strong>
        </div>
      </div>
      {sitemap.sourceUrl ? (
        <p className="evidence-source-link">
          Snapshot: <ExternalUrl value={sitemap.sourceUrl} />
          {sitemap.fetchStatusCode !== null
            ? ` · HTTP ${sitemap.fetchStatusCode}`
            : ""}
        </p>
      ) : null}
      {sitemap.files.length > 0 ? (
        <div className="table-shell evidence-file-table">
          <table aria-label="Captured sitemap files">
            <thead>
              <tr>
                <th scope="col">Sitemap file</th>
                <th scope="col">Type</th>
                <th scope="col">HTTP</th>
                <th scope="col">Locations</th>
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
          title="Indexable but absent"
          sample={sitemap.missingIndexable}
        />
        <SampleList
          title="Declared but not crawled"
          sample={sitemap.declaredNotCrawled}
        />
        <SampleList
          title="Declared HTTP errors"
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
  return (
    <div className="table-shell evidence-table">
      <table aria-label="Crawl path evidence">
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Depth</th>
            <th scope="col">First referrer</th>
            <th scope="col">HTTP</th>
            <th scope="col">Indexable</th>
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
                  "Seed"
                ) : (
                  "Unavailable"
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
  return (
    <div className="table-shell evidence-table">
      <table aria-label="Redirect path evidence">
        <thead>
          <tr>
            <th scope="col">Requested URL</th>
            <th scope="col">Captured path</th>
            <th scope="col">Hops</th>
            <th scope="col">Final HTTP</th>
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
  const rows = items.flatMap((item) =>
    item.alternates.map((alternate, index) => ({ item, alternate, index })),
  );
  return (
    <div className="table-shell evidence-table hreflang-matrix">
      <table aria-label="Hreflang evidence matrix">
        <thead>
          <tr>
            <th scope="col">Source page</th>
            <th scope="col">HTML / self language</th>
            <th scope="col">Alternate</th>
            <th scope="col">Target</th>
            <th scope="col">Reciprocal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, alternate, index }) => (
            <tr key={`${item.sourceUrl}-${alternate.lang}-${index}`}>
              <td className="evidence-url-cell">
                <ExternalUrl value={item.sourceUrl} />
              </td>
              <td>
                {item.htmlLang ?? "Unavailable"} /{" "}
                {item.selfLanguage ?? "Missing"}
              </td>
              <td>
                <strong>{alternate.lang}</strong>
                {alternate.selfReference ? (
                  <small> Self-reference</small>
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
                    Expected {alternate.expectedReturnLanguage ?? "source"};
                    observed{" "}
                    {alternate.observedReturnLanguages.join(", ") || "none"}
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
  return (
    <div className="table-shell evidence-table extraction-table">
      <table aria-label="Custom extraction evidence">
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Captured fields</th>
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
                        {field.value ?? "No match"}
                        {field.truncated ? " (truncated)" : ""}
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
  if (evidence.items.length === 0) {
    const tab = evidenceTabs.find(
      (candidate) => candidate.id === evidence.section,
    );
    return (
      <EmptyState
        title={`No ${tab?.label.toLowerCase() ?? "evidence"} captured`}
        description={
          evidence.state === "unavailable"
            ? "This run does not contain versioned page evidence. Run a new audit to populate the workbench."
            : `The selected run has no matching ${tab?.label.toLowerCase() ?? "records"}. This is a measured empty state, not a failed query.`
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
        <Icon name="arrow" /> Back to audits
      </Link>
      <PageHeader
        eyebrow="Audit run"
        title={run ? `Run ${run.id}` : "Audit details"}
        description="Inspect source coverage and exact evidence, or replay the stored run configuration against the site's current state."
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
            {replay.isPending ? "Queuing replay…" : "Replay configuration"}
          </Button>
        }
      />
      {replay.isError ? (
        <InlineNotice tone="danger" title="Replay could not start">
          {replay.error.message}
        </InlineNotice>
      ) : null}
      {replay.data ? (
        <InlineNotice tone="success" title="Independent replay queued">
          Stored configuration v{replay.data.data.configurationVersion} was
          copied without changing this run. The replay reads the current site
          and provider state.{" "}
          <Link to="/audits/$runId" params={{ runId: replay.data.data.run.id }}>
            Open replay
          </Link>
          .
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
            <InlineNotice tone="info" title="Replay boundary">
              Replay creates a new run from this stored workflow and its exact
              options. It never edits this result; live pages and integrations
              are queried again so changes remain measurable.
            </InlineNotice>
            <div className="detail-summary-grid">
              <Card>
                <span className="detail-label">Status</span>
                <StatusBadge status={run.status} />
              </Card>
              <Card>
                <span className="detail-label">Started</span>
                <strong>{formatDate(run.startedAt, true)}</strong>
              </Card>
              <Card>
                <span className="detail-label">Completed</span>
                <strong>{formatDate(run.completedAt, true)}</strong>
              </Card>
              <Card>
                <span className="detail-label">Issue instances</span>
                <strong>{formatNumber(run.issuesFound)}</strong>
              </Card>
            </div>

            <div className="two-column-grid">
              <Card>
                <h2>Issue breakdown</h2>
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
                    title="Breakdown unavailable"
                    description="The run did not return severity totals."
                  />
                )}
              </Card>
              <Card>
                <h2>Run log</h2>
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
                    title="No log entries"
                    description="The API did not return a run log."
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
                        <p className="eyebrow">Versioned audit evidence</p>
                        <h2 id="evidence-workbench-title">
                          Evidence workbench
                        </h2>
                        <p>
                          The UI paginates stored evidence; it never truncates a
                          cohort without showing the total.
                        </p>
                      </div>
                      <StatusBadge status={evidence.state} />
                    </div>
                    <div
                      className="evidence-tabs"
                      role="tablist"
                      aria-label="Evidence sections"
                    >
                      {evidenceTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={section === tab.id}
                          title={tab.description}
                          onClick={() => {
                            setSection(tab.id);
                            setOffset(0);
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <form className="evidence-toolbar" onSubmit={applySearch}>
                      <div className="search-field">
                        <Icon name="search" />
                        <label className="sr-only" htmlFor="evidence-search">
                          Search evidence by page URL or title
                        </label>
                        <input
                          id="evidence-search"
                          type="search"
                          value={searchInput}
                          maxLength={160}
                          placeholder="Search page URL or title"
                          onChange={(event) =>
                            setSearchInput(event.currentTarget.value)
                          }
                        />
                      </div>
                      <Button type="submit" variant="secondary">
                        Search
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
                          Clear
                        </Button>
                      ) : null}
                    </form>
                    <EvidenceResults evidence={evidence} />
                    <nav
                      className="pagination-controls"
                      aria-label="Evidence pages"
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
                        Previous
                      </Button>
                      <span>
                        Page{" "}
                        {formatNumber(
                          Math.floor(
                            evidence.pageInfo.offset / evidence.pageInfo.limit,
                          ) + 1,
                        )}{" "}
                        of{" "}
                        {formatNumber(
                          Math.max(
                            1,
                            Math.ceil(
                              evidence.pageInfo.total / evidence.pageInfo.limit,
                            ),
                          ),
                        )}{" "}
                        · {formatNumber(evidence.pageInfo.total)} records
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={evidence.pageInfo.nextOffset === null}
                        onClick={() =>
                          setOffset(evidence.pageInfo.nextOffset ?? offset)
                        }
                      >
                        Next
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

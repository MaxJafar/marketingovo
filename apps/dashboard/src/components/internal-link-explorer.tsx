import { useState } from "react";
import type {
  InternalLinkDirection,
  InternalLinkEdge,
  PageRecord,
} from "../api/contracts";
import { useRunLinks } from "../api/queries";
import { fmt, useI18n } from "../i18n";
import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  StatusBadge,
  formatNumber,
  safeExternalUrl,
} from "./ui";

function linkedPage(edge: InternalLinkEdge, direction: InternalLinkDirection) {
  return direction === "inlinks"
    ? { title: edge.sourceTitle, url: edge.sourceUrl }
    : { title: edge.targetTitle, url: edge.targetUrl };
}

export function InternalLinkExplorer({
  page,
  onClose,
}: {
  page: PageRecord;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [direction, setDirection] = useState<InternalLinkDirection>("inlinks");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const query = useRunLinks(page.runId ?? "", page.url, {
    direction,
    offset,
    limit: 25,
    search,
    enabled: page.linkGraphState === "available",
  });
  const explorer = query.data?.data;
  const title = page.title ?? page.url;

  const selectDirection = (next: InternalLinkDirection) => {
    setDirection(next);
    setOffset(0);
  };

  return (
    <Card
      className="internal-link-explorer"
      role="region"
      aria-label={fmt(t.internalLinkExplorer.regionLabel, { title })}
    >
      <header className="link-explorer-header">
        <div>
          <p className="eyebrow">{t.internalLinkExplorer.eyebrow}</p>
          <h2>{title}</h2>
          <p className="link-explorer-url">{page.url}</p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t.internalLinkExplorer.closeExplorer}
        </Button>
      </header>

      {page.linkGraphState !== "available" || !page.runId ? (
        <InlineNotice
          tone="warning"
          title={t.internalLinkExplorer.unavailableTitle}
        >
          {t.internalLinkExplorer.unavailableBody}
        </InlineNotice>
      ) : (
        <>
          <div
            className="link-explorer-tabs"
            aria-label={t.internalLinkExplorer.directionTabsLabel}
          >
            <button
              type="button"
              aria-pressed={direction === "inlinks"}
              className={direction === "inlinks" ? "is-active" : ""}
              onClick={() => selectDirection("inlinks")}
            >
              {fmt(t.internalLinkExplorer.inlinksTab, {
                count: formatNumber(page.inlinkSources),
              })}
            </button>
            <button
              type="button"
              aria-pressed={direction === "outlinks"}
              className={direction === "outlinks" ? "is-active" : ""}
              onClick={() => selectDirection("outlinks")}
            >
              {fmt(t.internalLinkExplorer.outlinksTab, {
                count: formatNumber(page.outlinkTargets),
              })}
            </button>
          </div>

          <form
            className="link-explorer-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draftSearch.trim());
              setOffset(0);
            }}
          >
            <label htmlFor="link-explorer-search">
              {t.internalLinkExplorer.searchLabel}
              <input
                id="link-explorer-search"
                type="search"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.currentTarget.value)}
                placeholder={t.internalLinkExplorer.searchPlaceholder}
                maxLength={160}
              />
            </label>
            <Button type="submit" variant="secondary">
              {t.internalLinkExplorer.search}
            </Button>
          </form>

          {query.isLoading ? (
            <p className="link-explorer-loading" role="status">
              {t.internalLinkExplorer.loading}
            </p>
          ) : null}
          {query.isError ? (
            <InlineNotice
              tone="danger"
              title={t.internalLinkExplorer.graphUnavailableTitle}
            >
              {query.error.message}
            </InlineNotice>
          ) : null}

          {explorer ? (
            <>
              <dl className="link-summary-grid">
                <div>
                  <dt>{t.internalLinkExplorer.summary.inlinkSources}</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.inlinkSources)}
                    </strong>
                    <small>
                      {fmt(t.internalLinkExplorer.summary.totalOccurrences, {
                        count: formatNumber(explorer.summary.inlinkOccurrences),
                      })}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t.internalLinkExplorer.summary.outlinkTargets}</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.outlinkTargets)}
                    </strong>
                    <small>
                      {fmt(t.internalLinkExplorer.summary.totalOccurrences, {
                        count: formatNumber(
                          explorer.summary.outlinkOccurrences,
                        ),
                      })}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t.internalLinkExplorer.summary.redirectedTargets}</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.redirectedOutlinkTargets)}
                    </strong>
                    <small>
                      {t.internalLinkExplorer.summary.redirectedHelp}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t.internalLinkExplorer.summary.brokenTargets}</dt>
                  <dd>
                    <strong>
                      {formatNumber(explorer.summary.brokenOutlinkTargets)}
                    </strong>
                    <small>{t.internalLinkExplorer.summary.brokenHelp}</small>
                  </dd>
                </div>
              </dl>

              {explorer.warnings.length > 0 ? (
                <InlineNotice
                  tone="warning"
                  title={t.internalLinkExplorer.coverageLimitationTitle}
                >
                  <ul>
                    {explorer.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </InlineNotice>
              ) : null}

              {explorer.items.length > 0 ? (
                <div className="link-evidence-table-wrap">
                  <table
                    aria-label={fmt(t.internalLinkExplorer.table.label, {
                      direction,
                      title,
                    })}
                  >
                    <caption>
                      {direction === "inlinks"
                        ? t.internalLinkExplorer.table.captionInlinks
                        : t.internalLinkExplorer.table.captionOutlinks}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          {direction === "inlinks"
                            ? t.internalLinkExplorer.table.sourcePageColumn
                            : t.internalLinkExplorer.table.destinationColumn}
                        </th>
                        <th scope="col">
                          {t.internalLinkExplorer.table.stateColumn}
                        </th>
                        <th scope="col">
                          {t.internalLinkExplorer.table.anchorColumn}
                        </th>
                        <th scope="col">
                          {t.internalLinkExplorer.table.followColumn}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {explorer.items.map((edge) => {
                        const linked = linkedPage(edge, direction);
                        const href = safeExternalUrl(linked.url);
                        return (
                          <tr key={`${edge.sourceUrl}:${edge.targetUrl}`}>
                            <td>
                              <div className="url-cell">
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {linked.title ?? linked.url}
                                  </a>
                                ) : (
                                  <strong>{linked.title ?? linked.url}</strong>
                                )}
                                <small>{linked.url}</small>
                                {direction === "outlinks" &&
                                edge.targetPageUrl &&
                                edge.targetPageUrl !== edge.targetUrl ? (
                                  <small>
                                    {fmt(
                                      t.internalLinkExplorer.table.finalUrl,
                                      { url: edge.targetPageUrl },
                                    )}
                                  </small>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <StatusBadge status={edge.targetState} />
                              <small className="link-http-state">
                                {fmt(t.internalLinkExplorer.table.httpStatus, {
                                  status: formatNumber(edge.targetStatusCode),
                                })}
                              </small>
                            </td>
                            <td>
                              {edge.anchorTexts.length > 0 ? (
                                <ul className="anchor-text-list">
                                  {edge.anchorTexts.map((anchor) => (
                                    <li key={anchor}>{anchor}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="muted-value">
                                  {t.internalLinkExplorer.table.noTextCaptured}
                                </span>
                              )}
                              <small>
                                {edge.placements.join(", ") ||
                                  t.internalLinkExplorer.table
                                    .placementUnavailable}
                              </small>
                            </td>
                            <td>
                              <strong>{formatNumber(edge.occurrences)}</strong>
                              <small>
                                {fmt(
                                  t.internalLinkExplorer.table.followSummary,
                                  {
                                    follow: formatNumber(
                                      edge.followOccurrences,
                                    ),
                                    nofollow: formatNumber(
                                      edge.nofollowOccurrences,
                                    ),
                                  },
                                )}
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={
                    search
                      ? t.internalLinkExplorer.empty.noLinksMatch
                      : fmt(t.internalLinkExplorer.empty.noDirectionCaptured, {
                          direction,
                        })
                  }
                  description={
                    search
                      ? t.internalLinkExplorer.empty.searchHint
                      : direction === "inlinks"
                        ? t.internalLinkExplorer.empty.inlinksHint
                        : t.internalLinkExplorer.empty.outlinksHint
                  }
                />
              )}

              <nav
                className="link-explorer-pagination"
                aria-label={t.internalLinkExplorer.paginationLabel}
              >
                <Button
                  type="button"
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() =>
                    setOffset(Math.max(0, offset - explorer.pageInfo.limit))
                  }
                >
                  {t.internalLinkExplorer.previous}
                </Button>
                <span>
                  {explorer.pageInfo.total === 0
                    ? t.internalLinkExplorer.zeroResults
                    : fmt(t.internalLinkExplorer.resultsRange, {
                        from: formatNumber(explorer.pageInfo.offset + 1),
                        to: formatNumber(
                          explorer.pageInfo.offset + explorer.items.length,
                        ),
                        total: formatNumber(explorer.pageInfo.total),
                      })}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={explorer.pageInfo.nextOffset === null}
                  onClick={() =>
                    setOffset(
                      explorer.pageInfo.nextOffset ?? explorer.pageInfo.offset,
                    )
                  }
                >
                  {t.internalLinkExplorer.next}
                </Button>
              </nav>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

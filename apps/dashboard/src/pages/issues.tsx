import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { IssueReviewItem, IssueStatus, Severity } from "../api/contracts";
import {
  useIssues,
  useUpdateIssueAdjudication,
  type IssueReviewFilters,
} from "../api/queries";
import { useSite } from "../context/site-context";
import { fmt, useI18n } from "../i18n";
import {
  CapabilityGate,
  FreshnessNotice,
  QueryState,
} from "../components/data-state";
import { NEEDS_WEBSITE, useWorkspaceCapabilities } from "../lib/capabilities";
import { Icon } from "../components/icon";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
  safeExternalUrl,
} from "../components/ui";

const PAGE_SIZE = 50;

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function evidenceValue(value: unknown, fallback: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 500
      ? `${serialized.slice(0, 497)}…`
      : serialized;
  } catch {
    return fallback;
  }
}

function IssueReviewEditor({
  item,
  siteId,
  onClose,
}: {
  item: IssueReviewItem;
  siteId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const mutation = useUpdateIssueAdjudication(siteId);
  const originalStatus = item.adjudication?.status ?? "open";
  const originalNote = item.adjudication?.note ?? "";
  const [status, setStatus] = useState<"open" | "ignored" | "false_positive">(
    originalStatus,
  );
  const [note, setNote] = useState(originalNote);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setStatus(item.adjudication?.status ?? "open");
    setNote(item.adjudication?.note ?? "");
    setConfirmed(false);
  }, [item.adjudication, item.issue.fingerprint]);

  const noteRequired = status !== "open";
  const changed = status !== originalStatus || note.trim() !== originalNote;
  const canSave =
    changed &&
    !mutation.isPending &&
    (!noteRequired || (note.trim().length >= 3 && confirmed));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    mutation.mutate({
      fingerprint: item.issue.fingerprint,
      status,
      note: noteRequired ? note.trim() : null,
    });
  }

  return (
    <Card className="issue-review-editor" aria-labelledby="issue-review-title">
      <div className="issue-review-editor-heading">
        <div>
          <p className="eyebrow">{t.issues.editor.eyebrow}</p>
          <h2 id="issue-review-title">{item.issue.title}</h2>
          <p>{item.issue.description}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.issues.editor.close}
        </Button>
      </div>

      <dl className="issue-review-facts">
        <div>
          <dt>{t.issues.editor.rule}</dt>
          <dd>{item.issue.ruleId}</dd>
        </div>
        <div>
          <dt>{t.issues.editor.module}</dt>
          <dd>{item.issue.moduleId}</dd>
        </div>
        <div>
          <dt>{t.issues.editor.firstSeen}</dt>
          <dd>{formatDate(item.issue.firstSeenAt, true)}</dd>
        </div>
        <div>
          <dt>{t.issues.editor.occurrences}</dt>
          <dd>{formatNumber(item.occurrenceCount)}</dd>
        </div>
      </dl>

      {item.issue.evidence.length > 0 ? (
        <section aria-labelledby="issue-evidence-title">
          <h3 id="issue-evidence-title">{t.issues.editor.evidenceTitle}</h3>
          <ul className="issue-evidence-list">
            {item.issue.evidence.map((evidence, index) => {
              const value = evidenceValue(
                evidence.value,
                t.issues.editor.structuredEvidence,
              );
              return (
                <li key={`${evidence.kind}-${evidence.label}-${index}`}>
                  <div>
                    <strong>{evidence.label}</strong>
                    <small>
                      {evidence.source ?? evidence.kind}
                      {evidence.observedAt
                        ? ` · ${formatDate(evidence.observedAt, true)}`
                        : ""}
                    </small>
                  </div>
                  {value ? <code>{value}</code> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="muted-copy">{t.issues.editor.noEvidence}</p>
      )}

      <form className="issue-adjudication-form" onSubmit={submit}>
        <fieldset>
          <legend>{t.issues.editor.decision}</legend>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="open"
              checked={status === "open"}
              onChange={() => {
                setStatus("open");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>{t.issues.editor.keepTitle}</strong>
              <small>{t.issues.editor.keepBody}</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="ignored"
              checked={status === "ignored"}
              onChange={() => {
                setStatus("ignored");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>{t.issues.editor.ignoreTitle}</strong>
              <small>{t.issues.editor.ignoreBody}</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name={`issue-status-${item.issue.fingerprint}`}
              value="false_positive"
              checked={status === "false_positive"}
              onChange={() => {
                setStatus("false_positive");
                setConfirmed(false);
              }}
            />
            <span>
              <strong>{t.issues.editor.falsePositiveTitle}</strong>
              <small>{t.issues.editor.falsePositiveBody}</small>
            </span>
          </label>
        </fieldset>

        <label htmlFor={`issue-note-${item.issue.fingerprint}`}>
          {t.issues.editor.reasonLabel}{" "}
          {noteRequired
            ? t.issues.editor.reasonRequired
            : t.issues.editor.reasonOptional}
          <textarea
            id={`issue-note-${item.issue.fingerprint}`}
            value={note}
            minLength={noteRequired ? 3 : undefined}
            maxLength={2_000}
            required={noteRequired}
            rows={4}
            placeholder={t.issues.editor.reasonPlaceholder}
            onChange={(event) => {
              setNote(event.currentTarget.value);
              setConfirmed(false);
            }}
          />
          <small>
            {fmt(t.issues.editor.charCount, {
              count: formatNumber(note.length),
            })}
          </small>
        </label>

        {noteRequired ? (
          <label className="issue-review-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <span>{t.issues.editor.confirmation}</span>
          </label>
        ) : null}

        {mutation.isError ? (
          <p className="form-error" role="alert">
            {mutation.error.message}
          </p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="form-success" role="status">
            {t.issues.editor.saved}
          </p>
        ) : null}

        <div className="form-actions">
          <Button type="submit" disabled={!canSave}>
            {mutation.isPending ? t.issues.editor.saving : t.issues.editor.save}
          </Button>
          <span className="muted-copy">{t.issues.editor.retention}</span>
        </div>
      </form>
    </Card>
  );
}

export function IssuesPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState<IssueStatus | "all">("open");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [offset, setOffset] = useState(0);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(
    null,
  );

  useEffect(() => setOffset(0), [deferredSearch, severity, status, siteId]);

  const filters = useMemo<IssueReviewFilters>(
    () => ({
      limit: PAGE_SIZE,
      offset,
      ...(status === "all" ? {} : { status }),
      ...(severity === "all" ? {} : { severity }),
      ...(deferredSearch ? { search: deferredSearch } : {}),
    }),
    [deferredSearch, offset, severity, status],
  );
  const query = useIssues(siteId, filters);
  const page = query.data?.data;
  const items = page?.items ?? [];
  const selected =
    items.find((item) => item.issue.fingerprint === selectedFingerprint) ??
    null;
  const end = page ? Math.min(page.offset + page.items.length, page.total) : 0;
  const filtersActive =
    search.length > 0 || status !== "open" || severity !== "all";

  function resetFilters() {
    setSearch("");
    setStatus("open");
    setSeverity("all");
    setOffset(0);
    setSelectedFingerprint(null);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.issues.eyebrow}
        title={t.issues.title}
        description={t.issues.description}
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          <section
            className="workbench-controls"
            aria-labelledby="issue-filter-title"
          >
            <div className="workbench-control-heading">
              <div>
                <h2 id="issue-filter-title">{t.issues.filters.title}</h2>
                <p>{t.issues.filters.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                disabled={!filtersActive}
              >
                {t.issues.filters.reset}
              </Button>
            </div>
            <div className="workbench-filter-grid issue-filter-grid">
              <label className="workbench-search">
                <span>{t.issues.filters.searchLabel}</span>
                <span className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={search}
                    maxLength={160}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder={t.issues.filters.searchPlaceholder}
                  />
                </span>
              </label>
              <label>
                {t.issues.filters.status}
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as IssueStatus | "all")
                  }
                >
                  <option value="all">{t.issues.filters.allStatuses}</option>
                  <option value="open">{t.issues.filters.statusOpen}</option>
                  <option value="resolved">
                    {t.issues.filters.statusResolved}
                  </option>
                  <option value="ignored">
                    {t.issues.filters.statusIgnored}
                  </option>
                  <option value="false_positive">
                    {t.issues.filters.statusFalsePositive}
                  </option>
                </select>
              </label>
              <label>
                {t.issues.filters.severity}
                <select
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.currentTarget.value as Severity | "all")
                  }
                >
                  <option value="all">{t.issues.filters.allSeverities}</option>
                  <option value="critical">
                    {t.issues.filters.severityCritical}
                  </option>
                  <option value="high">{t.issues.filters.severityHigh}</option>
                  <option value="medium">
                    {t.issues.filters.severityMedium}
                  </option>
                  <option value="low">{t.issues.filters.severityLow}</option>
                  <option value="info">{t.issues.filters.severityInfo}</option>
                </select>
              </label>
            </div>
          </section>

          {page && page.total > 0 ? (
            <>
              <p
                className="workbench-result-count"
                role="status"
                aria-live="polite"
              >
                {fmt(t.issues.showingRange, {
                  start: formatNumber(page.offset + 1),
                  end: formatNumber(end),
                  total: formatNumber(page.total),
                })}
              </p>
              <div className="table-shell issue-review-table">
                <table aria-label={t.issues.tableLabel}>
                  <thead>
                    <tr>
                      <th scope="col">{t.issues.columns.severity}</th>
                      <th scope="col">{t.issues.columns.issue}</th>
                      <th scope="col">{t.issues.columns.url}</th>
                      <th scope="col">{t.issues.columns.status}</th>
                      <th scope="col">{t.issues.columns.occurrences}</th>
                      <th scope="col">{t.issues.columns.lastSeen}</th>
                      <th scope="col">{t.issues.columns.review}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const url = safeExternalUrl(item.issue.canonicalUrl);
                      const active =
                        selectedFingerprint === item.issue.fingerprint;
                      return (
                        <tr key={item.issue.fingerprint}>
                          <td>
                            <StatusBadge status={item.issue.severity} />
                          </td>
                          <td>
                            <div className="issue-title-cell">
                              <strong>{item.issue.title}</strong>
                              <small>
                                {item.issue.ruleId} · {item.issue.moduleId}
                              </small>
                            </div>
                          </td>
                          <td>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="issue-url"
                              >
                                {item.issue.canonicalUrl}
                              </a>
                            ) : (
                              <span className="muted-copy">
                                {t.issues.siteWide}
                              </span>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              status={item.issue.status}
                              label={
                                t.issues.statusLabel[item.issue.status] ??
                                displayLabel(item.issue.status)
                              }
                            />
                          </td>
                          <td>{formatNumber(item.occurrenceCount)}</td>
                          <td>{formatDate(item.issue.lastSeenAt, true)}</td>
                          <td>
                            <Button
                              type="button"
                              variant={active ? "secondary" : "ghost"}
                              aria-expanded={active}
                              aria-controls="issue-review-panel"
                              onClick={() =>
                                setSelectedFingerprint(
                                  active ? null : item.issue.fingerprint,
                                )
                              }
                            >
                              {active ? t.issues.hide : t.issues.review}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <nav
                className="pagination-controls"
                aria-label={t.issues.paginationLabel}
              >
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page.offset === 0}
                  onClick={() => {
                    setOffset(Math.max(0, page.offset - page.limit));
                    setSelectedFingerprint(null);
                  }}
                >
                  {t.issues.previous}
                </Button>
                <span>
                  {fmt(t.issues.pageOf, {
                    page: formatNumber(
                      Math.floor(page.offset / page.limit) + 1,
                    ),
                    total: formatNumber(
                      Math.max(1, Math.ceil(page.total / page.limit)),
                    ),
                  })}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page.offset + page.limit >= page.total}
                  onClick={() => {
                    setOffset(page.offset + page.limit);
                    setSelectedFingerprint(null);
                  }}
                >
                  {t.issues.next}
                </Button>
              </nav>
            </>
          ) : (
            <EmptyState
              title={
                filtersActive
                  ? t.issues.emptyFilteredTitle
                  : t.issues.emptyOpenTitle
              }
              description={
                filtersActive
                  ? t.issues.emptyFilteredBody
                  : t.issues.emptyOpenBody
              }
            />
          )}

          {selected ? (
            <div id="issue-review-panel">
              <IssueReviewEditor
                key={selected.issue.fingerprint}
                item={selected}
                siteId={siteId}
                onClose={() => setSelectedFingerprint(null)}
              />
            </div>
          ) : null}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}

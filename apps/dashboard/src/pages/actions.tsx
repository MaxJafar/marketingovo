import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type {
  ActionEffort,
  ActionStatus,
  ActionVerification,
  PriorityLevel,
  SeoAction,
} from "../api/contracts";
import { useActions, useUpdateAction } from "../api/queries";
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
  EmptyState,
  InlineNotice,
  PageHeader,
  StatusBadge,
  formatDate,
  formatNumber,
} from "../components/ui";

type PriorityFilter = "all" | PriorityLevel;
type StatusFilter = "all" | ActionStatus;
type VerificationFilter = "all" | ActionVerification;
type EffortFilter = "all" | "low" | "medium" | "high";
type ActionSort = "priority" | "updated" | "affected" | "confidence";

const actionStatuses: readonly ActionStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];

const verificationStates: readonly ActionVerification[] = [
  "pending",
  "verified",
  "regressed",
];

function normalizedEffort(
  effort: ActionEffort | null | undefined,
): Exclude<EffortFilter, "all"> | null {
  if (effort === "small" || effort === "low") return "low";
  if (effort === "large" || effort === "high") return "high";
  return effort === "medium" ? "medium" : null;
}

function affectedCount(action: SeoAction): number | null {
  if (action.affectedUrlList) return action.affectedUrlList.length;
  return action.affectedUrls ?? null;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNumberDescending(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  return right - left;
}

export function ActionsPage() {
  const { t } = useI18n();
  const { siteId } = useSite();
  const { capabilities } = useWorkspaceCapabilities(siteId);
  const query = useActions(siteId);
  const updateAction = useUpdateAction(siteId);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [verification, setVerification] = useState<VerificationFilter>("all");
  const [effort, setEffort] = useState<EffortFilter>("all");
  const [sort, setSort] = useState<ActionSort>("priority");
  const actions = query.data?.data.items ?? [];

  const visibleActions = useMemo(() => {
    const filtered = actions.filter((action) => {
      const searchable = [
        action.title,
        action.summary,
        action.whyNow,
        action.moduleId,
        action.ruleId,
        action.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!deferredSearch || searchable.includes(deferredSearch)) &&
        (priority === "all" || action.priority === priority) &&
        (status === "all" || action.status === status) &&
        (verification === "all" || action.verification === verification) &&
        (effort === "all" || normalizedEffort(action.effort) === effort)
      );
    });

    return filtered.sort((left, right) => {
      if (sort === "updated")
        return timestamp(right.updatedAt) - timestamp(left.updatedAt);
      if (sort === "affected")
        return compareNumberDescending(
          affectedCount(left),
          affectedCount(right),
        );
      if (sort === "confidence")
        return compareNumberDescending(left.confidence, right.confidence);
      return compareNumberDescending(left.priorityScore, right.priorityScore);
    });
  }, [actions, deferredSearch, effort, priority, sort, status, verification]);

  const filtersActive =
    Boolean(search) ||
    priority !== "all" ||
    status !== "all" ||
    verification !== "all" ||
    effort !== "all" ||
    sort !== "priority";

  function resetFilters() {
    setSearch("");
    setPriority("all");
    setStatus("all");
    setVerification("all");
    setEffort("all");
    setSort("priority");
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={t.actions.eyebrow}
        title={t.actions.title}
        description={t.actions.description}
      />
      <CapabilityGate capabilities={capabilities} requires={NEEDS_WEBSITE}>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          siteId={siteId}
          onRetry={() => void query.refetch()}
        >
          <FreshnessNotice meta={query.data?.meta} />
          {updateAction.isError ? (
            <InlineNotice tone="danger" title={t.actions.statusNotSavedTitle}>
              {updateAction.error.message}
            </InlineNotice>
          ) : null}
          <section
            className="workbench-controls"
            aria-labelledby="action-filter-title"
          >
            <div className="workbench-control-heading">
              <div>
                <h2 id="action-filter-title">{t.actions.filterTitle}</h2>
                <p>{t.actions.filterDescription}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                disabled={!filtersActive}
              >
                {t.actions.resetFilters}
              </Button>
            </div>
            <div className="workbench-filter-grid">
              <label className="workbench-search">
                <span>{t.actions.searchLabel}</span>
                <span className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder={t.actions.searchPlaceholder}
                  />
                </span>
              </label>
              <label>
                {t.actions.statusFilterLabel}
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as StatusFilter)
                  }
                >
                  <option value="all">{t.actions.allStatuses}</option>
                  {actionStatuses.map((value) => (
                    <option key={value} value={value}>
                      {t.actions.statusLabel[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.actions.verificationFilterLabel}
                <select
                  value={verification}
                  onChange={(event) =>
                    setVerification(
                      event.currentTarget.value as VerificationFilter,
                    )
                  }
                >
                  <option value="all">{t.actions.allVerification}</option>
                  {verificationStates.map((value) => (
                    <option key={value} value={value}>
                      {t.actions.verificationLabel[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.actions.effortFilterLabel}
                <select
                  value={effort}
                  onChange={(event) =>
                    setEffort(event.currentTarget.value as EffortFilter)
                  }
                >
                  <option value="all">{t.actions.allEffort}</option>
                  <option value="low">{t.actions.effortOption.low}</option>
                  <option value="medium">
                    {t.actions.effortOption.medium}
                  </option>
                  <option value="high">{t.actions.effortOption.high}</option>
                </select>
              </label>
              <label>
                {t.actions.sortByLabel}
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.currentTarget.value as ActionSort)
                  }
                >
                  <option value="priority">
                    {t.actions.sortOption.priority}
                  </option>
                  <option value="updated">
                    {t.actions.sortOption.updated}
                  </option>
                  <option value="affected">
                    {t.actions.sortOption.affected}
                  </option>
                  <option value="confidence">
                    {t.actions.sortOption.confidence}
                  </option>
                </select>
              </label>
            </div>
            <fieldset className="priority-filter-fieldset">
              <legend>{t.actions.priorityLegend}</legend>
              <div
                className="filter-bar"
                role="group"
                aria-label={t.actions.priorityGroupLabel}
              >
                {(["all", "critical", "high", "medium", "low"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      className={priority === value ? "filter-active" : ""}
                      aria-pressed={priority === value}
                      onClick={() => setPriority(value)}
                    >
                      {t.actions.priorityFilter[value]}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
          </section>

          <p
            className="workbench-result-count"
            role="status"
            aria-live="polite"
          >
            {fmt(t.actions.showingCount, {
              visible: formatNumber(visibleActions.length),
              total: formatNumber(actions.length),
            })}
          </p>

          {visibleActions.length > 0 ? (
            <div className="table-shell action-workbench-table">
              <table aria-label={t.actions.tableLabel}>
                <thead>
                  <tr>
                    <th scope="col">{t.actions.columnPriority}</th>
                    <th scope="col">{t.actions.columnAction}</th>
                    <th scope="col">{t.actions.columnScope}</th>
                    <th scope="col">{t.actions.columnEffort}</th>
                    <th scope="col">{t.actions.columnConfidence}</th>
                    <th scope="col">{t.actions.columnWorkflow}</th>
                    <th scope="col">{t.actions.columnVerification}</th>
                    <th scope="col">{t.actions.columnUpdated}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActions.map((action) => {
                    const isUpdating =
                      updateAction.isPending &&
                      updateAction.variables?.actionId === action.id;
                    const count = affectedCount(action);
                    return (
                      <tr key={action.id}>
                        <td>
                          <div className="priority-cell">
                            <strong>
                              {formatNumber(action.priorityScore)}
                            </strong>
                            <StatusBadge
                              status={action.priority ?? "unknown"}
                              label={action.priority ?? t.common.unavailable}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="action-title-cell">
                            <Link
                              to="/actions/$actionId"
                              params={{ actionId: action.id }}
                              className="table-link"
                            >
                              {action.title}
                            </Link>
                            <p>{action.summary}</p>
                            <small>
                              {action.moduleId ?? t.actions.moduleUnavailable} ·{" "}
                              {action.ruleId ?? t.actions.ruleUnavailable}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div className="scope-cell">
                            <strong>{formatNumber(count)}</strong>
                            <span>{t.actions.affectedUrls}</span>
                            {action.trafficAtRisk !== null &&
                            action.trafficAtRisk !== undefined ? (
                              <small>
                                {fmt(t.actions.organicVisitsExposed, {
                                  count: formatNumber(action.trafficAtRisk),
                                })}
                              </small>
                            ) : (
                              <small>
                                {t.actions.businessExposureUnavailable}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          {normalizedEffort(action.effort) ? (
                            <StatusBadge
                              status={normalizedEffort(action.effort)!}
                            />
                          ) : (
                            t.common.unavailable
                          )}
                        </td>
                        <td>
                          {action.confidence === null ||
                          action.confidence === undefined
                            ? t.common.unavailable
                            : `${formatNumber(action.confidence * 100)}%`}
                        </td>
                        <td>
                          <label className="table-status-control">
                            <span className="sr-only">
                              {fmt(t.actions.workflowStatusFor, {
                                title: action.title,
                              })}
                            </span>
                            <select
                              aria-label={fmt(t.actions.workflowStatusFor, {
                                title: action.title,
                              })}
                              value={action.status ?? "open"}
                              disabled={isUpdating}
                              onChange={(event) =>
                                updateAction.mutate({
                                  actionId: action.id,
                                  status: event.currentTarget
                                    .value as ActionStatus,
                                })
                              }
                            >
                              {actionStatuses.map((value) => (
                                <option key={value} value={value}>
                                  {t.actions.statusLabel[value]}
                                </option>
                              ))}
                            </select>
                            {isUpdating ? (
                              <small role="status">{t.actions.saving}</small>
                            ) : null}
                          </label>
                        </td>
                        <td>
                          <StatusBadge
                            status={action.verification ?? "unknown"}
                            label={
                              action.verification
                                ? t.actions.verificationLabel[
                                    action.verification
                                  ]
                                : t.common.unavailable
                            }
                          />
                        </td>
                        <td>{formatDate(action.updatedAt, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                actions.length > 0
                  ? t.actions.emptyFilteredTitle
                  : t.actions.emptyQueueTitle
              }
              description={
                actions.length > 0
                  ? t.actions.emptyFilteredDescription
                  : t.actions.emptyQueueDescription
              }
              action={
                actions.length > 0 ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    {t.actions.resetFilters}
                  </Button>
                ) : undefined
              }
            />
          )}
        </QueryState>
      </CapabilityGate>
    </div>
  );
}

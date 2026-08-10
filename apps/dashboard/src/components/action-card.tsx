import type { ActionStatus, SeoAction } from "../api/contracts";
import { fmt, useI18n } from "../i18n";
import { Card, StatusBadge, formatNumber } from "./ui";

const ACTION_STATUSES: readonly ActionStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];

export function ActionCard({
  action,
  rank,
  onStatusChange,
  isUpdating = false,
  updateError,
}: {
  action: SeoAction;
  rank?: number;
  onStatusChange?: (actionId: string, status: ActionStatus) => void;
  isUpdating?: boolean;
  updateError?: string;
}) {
  const { t } = useI18n();
  const evidence = action.evidence ?? [];
  return (
    <Card className="action-card">
      <div className="action-card-topline">
        <div className="action-rank">
          {rank
            ? fmt(t.actionCard.rankLabel, { rank })
            : (action.category ?? t.actionCard.fallbackCategory)}
        </div>
        <StatusBadge
          status={action.priority ?? "unknown"}
          label={fmt(t.actionCard.priorityBadge, {
            priority: action.priority
              ? (t.actionCard.priorityLabel[action.priority] ?? action.priority)
              : t.common.unavailable,
          })}
        />
      </div>
      <div>
        <h3>{action.title}</h3>
        <p>{action.summary}</p>
      </div>
      <dl className="action-factors" aria-label={t.actionCard.factorsLabel}>
        <div>
          <dt>{t.actionCard.impact}</dt>
          <dd>
            {action.impact
              ? (t.actionCard.impactLabel[action.impact] ?? action.impact)
              : t.common.unavailable}
          </dd>
        </div>
        <div>
          <dt>{t.actionCard.effort}</dt>
          <dd>
            {action.effort
              ? (t.actionCard.effortLabel[action.effort] ?? action.effort)
              : t.common.unavailable}
          </dd>
        </div>
        <div>
          <dt>{t.actionCard.confidence}</dt>
          <dd>
            {action.confidence === null || action.confidence === undefined
              ? t.common.unavailable
              : `${formatNumber(action.confidence * 100)}%`}
          </dd>
        </div>
        <div>
          <dt>{t.actionCard.priorityScore}</dt>
          <dd>{formatNumber(action.priorityScore)}</dd>
        </div>
      </dl>
      <div className="action-workflow">
        <span>{t.actionCard.workflowStatus}</span>
        {onStatusChange ? (
          <select
            aria-label={fmt(t.actionCard.workflowStatusFor, {
              title: action.title,
            })}
            value={action.status ?? "open"}
            disabled={isUpdating}
            onChange={(event) =>
              onStatusChange(
                action.id,
                event.currentTarget.value as ActionStatus,
              )
            }
          >
            {ACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.actionCard.statusLabel[status]}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={action.status ?? "unknown"} />
        )}
        {isUpdating ? (
          <small role="status">{t.actionCard.savingStatus}</small>
        ) : null}
        {updateError ? (
          <small className="action-update-error" role="alert">
            {updateError}
          </small>
        ) : null}
      </div>
      <div className="priority-reason">
        <span>{t.actionCard.whyPrioritized}</span>
        <p>
          {action.priorityExplanation ?? t.actionCard.noPriorityExplanation}
        </p>
      </div>
      <details className="action-evidence">
        <summary>{t.actionCard.evidenceSummary}</summary>
        {evidence.length > 0 ? (
          <ul>
            {evidence.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <span>{item.label}</span>
                <strong>
                  {item.value === null || item.value === undefined
                    ? t.common.unavailable
                    : String(item.value)}
                </strong>
                {item.source ? <small>{item.source}</small> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t.actionCard.noEvidence}</p>
        )}
      </details>
    </Card>
  );
}

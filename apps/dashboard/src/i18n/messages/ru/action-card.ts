import type { MessagesFor } from "../types";

/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
export const actionCard: MessagesFor<"actionCard"> = {
  fallbackCategory: "Действие",
  rankLabel: "#{rank}",
  priorityBadge: "приоритет: {priority}",
  priorityLabel: {
    critical: "критический",
    high: "высокий",
    medium: "средний",
    low: "низкий",
  },
  impactLabel: {
    high: "высокое",
    medium: "среднее",
    low: "низкое",
  },
  effortLabel: {
    low: "низкие",
    medium: "средние",
    high: "высокие",
    small: "малые",
    large: "большие",
  },
  statusLabel: {
    open: "открыто",
    acknowledged: "принято",
    in_progress: "в работе",
    resolved: "решено",
  },
  factorsLabel: "Факторы приоритета",
  impact: "Влияние",
  effort: "Трудозатраты",
  confidence: "Уверенность",
  priorityScore: "Оценка приоритета",
  workflowStatus: "Статус рабочего процесса",
  workflowStatusFor: "Статус рабочего процесса для {title}",
  savingStatus: "Сохранение статуса…",
  whyPrioritized: "Почему это в приоритете",
  noPriorityExplanation: "API не предоставил объяснение приоритета.",
  evidenceSummary: "Доказательства и охват",
  noEvidence:
    "Для этого действия не было возвращено подтверждающих доказательств.",
};

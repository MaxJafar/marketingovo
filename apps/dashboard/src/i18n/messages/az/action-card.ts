/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
import type { MessagesFor } from "../types";

export const actionCard: MessagesFor<"actionCard"> = {
  fallbackCategory: "Tədbir",
  rankLabel: "#{rank}",
  priorityBadge: "{priority} prioritet",
  priorityLabel: {
    critical: "kritik",
    high: "yüksək",
    medium: "orta",
    low: "aşağı",
  },
  impactLabel: {
    high: "yüksək",
    medium: "orta",
    low: "aşağı",
  },
  effortLabel: {
    low: "aşağı",
    medium: "orta",
    high: "yüksək",
    small: "kiçik",
    large: "böyük",
  },
  statusLabel: {
    open: "açıq",
    acknowledged: "qəbul edilib",
    in_progress: "icradadır",
    resolved: "həll edilib",
  },
  factorsLabel: "Prioritet amilləri",
  impact: "Təsir",
  effort: "Əmək",
  confidence: "Əminlik",
  priorityScore: "Prioritet balı",
  workflowStatus: "İş axını statusu",
  workflowStatusFor: "{title} üçün iş axını statusu",
  savingStatus: "Status yadda saxlanılır…",
  whyPrioritized: "Bu niyə prioritetləşdirilib",
  noPriorityExplanation: "API prioritet izahı təqdim etmədi.",
  evidenceSummary: "Sübut və əhatə dairəsi",
  noEvidence: "Bu tədbir üçün dəstəkləyici sübut qaytarılmadı.",
};

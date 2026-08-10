/** Keyword lab: research workflows, provider usage, clusters, opportunities. */
import type { MessagesFor } from "../types";

export const keywords: MessagesFor<"keywords"> = {
  eyebrow: "Tələb kəşfiyyatı",
  title: "Açar sözlər və kontent",
  description:
    "Sorğu imkanlarını tapın, niyyəti qruplaşdırın və axtarış tələbini fokuslanmış kontent planına çevirin.",
  starting: "Başladılır…",
  research: {
    title: "Bir bazarı araşdırın",
    description:
      "Toxum sözü təkliflər, niyyət, Trends, PAA və əlaqəli axtarışlar üzrə genişləndirin.",
    seedLabel: "Toxum açar söz",
    start: "Açar söz araşdırmasını başlat",
  },
  plan: {
    title: "Kontent planı qurun",
    description:
      "Vergül və ya yeni sətirlərlə ayıraraq ən çox on toxum mövzu daxil edin.",
    seedsLabel: "Toxum mövzular",
    generate: "Kontent planı yarat",
  },
  notStartedTitle: "Araşdırma başlaya bilmədi",
  queuedTitle: "Araşdırma növbəyə alındı",
  queuedBody:
    "Davamlı icra Auditlər bölməsində görünür. Bu səhifə ən son tamamlanmış araşdırma nəticəsini göstərəcək.",
  usage: {
    title: "Son araşdırmada provayder istifadəsi",
    reported:
      "Ölçülən provayderlər {billable} ödənişli sorğu üzrə ${cost} bildirdi.",
    unreported:
      "{count} ödənişli sorğu zəng başına xərc bildirmədi və sıfır kimi göstərilmir.",
    allReported: "Bu nəticədəki bütün ödənişli zənglər öz xərcini bildirdi.",
    free: "{count} tamamlanmış sorğu bilinən pulsuz mənbələrdən istifadə etdi.",
  },
  clusters: {
    title: "Kontent klasterləri",
    description:
      "Qoşulmuş açar söz mənbəyindən əhatə və qısa brif tövsiyələri.",
    keywordCount: "{count} açar söz",
    coverage: "Kontent əhatəsi",
    coverageUnavailable: "Əhatə ölçməsi əlçatan deyil",
    noBrief: "Brif tövsiyəsi mövcud deyil.",
    emptyTitle: "Kontent klasteri yoxdur",
    emptyBody:
      "Mövzu klasterləri qurmaq üçün açar söz provayderi qoşun və ya açar söz məlumatı idxal edin.",
  },
  opportunities: {
    title: "Açar söz imkanları",
    description:
      "Tələbi mövqe, axtarış həcmi, çətinlik və imkan balına görə prioritetləşdirin.",
    tableLabel: "Açar söz imkanları",
    emptyTitle: "Açar söz imkanı yoxdur",
    emptyBody: "API etibarlı boş imkan dəsti qaytardı.",
    columns: {
      keyword: "Açar söz",
      intent: "Niyyət",
      position: "Mövqe",
      volume: "Həcm",
      difficulty: "Çətinlik",
      opportunity: "İmkan",
      target: "Hədəf səhifə",
    },
    noCluster: "Klaster yoxdur",
    openPage: "Səhifəni aç",
    invalidUrl: "Etibarsız URL",
    unassigned: "Təyin edilməyib",
  },
};

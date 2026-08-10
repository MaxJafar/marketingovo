/** Issue review: filters, the evidence table, and the adjudication editor. */
import type { MessagesFor } from "../types";

export const issues: MessagesFor<"issues"> = {
  eyebrow: "Keyfiyyətə nəzarət",
  title: "Problem baxışı",
  description:
    "Tarama sübutunu araşdırın, qəsdən edilən istisnaları sənədləşdirin və audit tarixçəsini silmədən yanlış müsbətləri gələcək prioritetlərdən kənar saxlayın.",
  filters: {
    title: "Siqnalı qəbul edilmiş davranışdan ayırın",
    description:
      "Başlıqları, qaydaları, modulları, barmaq izlərini və kanonik URL-ləri axtarın. Qərarlar seçilmiş sayta bağlıdır.",
    reset: "Filtrləri sıfırla",
    searchLabel: "Problemləri axtar",
    searchPlaceholder: "Qayda, URL, başlıq, barmaq izi…",
    status: "Status",
    allStatuses: "Bütün statuslar",
    statusOpen: "Açıq",
    statusResolved: "Auditlə həll edilib",
    statusIgnored: "Qəsdən nəzərə alınmayıb",
    statusFalsePositive: "Yanlış müsbətlər",
    severity: "Ciddilik",
    allSeverities: "Bütün ciddilik səviyyələri",
    severityCritical: "Kritik",
    severityHigh: "Yüksək",
    severityMedium: "Orta",
    severityLow: "Aşağı",
    severityInfo: "Məlumat",
  },
  showingRange: "{total} problemdən {start}–{end} göstərilir",
  tableLabel: "Baxış qərarı gözləyən və ya daşıyan SEO problemləri",
  columns: {
    severity: "Ciddilik",
    issue: "Problem",
    url: "URL",
    status: "Status",
    occurrences: "Rast gəlmələr",
    lastSeen: "Son görülmə",
    review: "Baxış",
  },
  siteWide: "Bütün sayt üzrə",
  /** Keyed by the API's `IssueStatus` enum; fall back to the raw value. */
  statusLabel: {
    open: "açıq",
    resolved: "həll edilib",
    ignored: "nəzərə alınmayıb",
    false_positive: "yanlış müsbət",
  },
  hide: "Gizlət",
  review: "Bax",
  paginationLabel: "Problem səhifələri",
  previous: "Əvvəlki",
  next: "Növbəti",
  pageOf: "Səhifə {page} / {total}",
  emptyFilteredTitle: "Uyğun problem yoxdur",
  emptyFilteredBody:
    "Filtrləri genişləndirin və ya başqa qayda, modul, başlıq və ya URL axtarın.",
  emptyOpenTitle: "Açıq problem yoxdur",
  emptyOpenBody:
    "Problem sübutu toplamaq üçün audit işlədin və ya həll edilmiş tapıntılara baxmaq üçün status filtrini dəyişin.",
  editor: {
    eyebrow: "Sübut baxışı",
    close: "Baxışı bağla",
    rule: "Qayda",
    module: "Modul",
    firstSeen: "İlk görülmə",
    occurrences: "Rast gəlmələr",
    evidenceTitle: "Tutulmuş sübut",
    structuredEvidence: "Strukturlaşdırılmış sübut",
    noEvidence:
      "Bu tapıntının strukturlaşdırılmış sübut yükü yoxdur. Təsnif etməzdən əvvəl qaydaya, URL-ə və audit tarixçəsinə baxın.",
    decision: "Baxış qərarı",
    keepTitle: "Aktual saxla",
    keepBody:
      "İstənilən əl ilə edilmiş ləğvi silin və gələcək icraları normal qiymətləndirin.",
    ignoreTitle: "Qəsdən nəzərə alma",
    ignoreBody: "Davranış realdır, başa düşülüb və bu sayt üçün qəbul edilib.",
    falsePositiveTitle: "Yanlış müsbət kimi işarələ",
    falsePositiveBody: "Qayda bu səhifəni və ya tətbiqi düzgün təsvir etmir.",
    reasonLabel: "Baxış səbəbi",
    reasonRequired: "(tələb olunur)",
    reasonOptional: "(istəyə bağlı)",
    reasonPlaceholder:
      "Sayt kontekstini izah edin ki, başqa marketoloq bu qərarı sonradan yoxlaya bilsin.",
    charCount: "{count} / 2,000 simvol",
    confirmation:
      "Sübutu nəzərdən keçirdim. Kimsə yenidən açana qədər bu təsnifatı gələcək auditlərdə saxla.",
    saved: "Baxış yadda saxlandı. Tədbirlər və icmal prioritetləri yeniləndi.",
    saving: "Yadda saxlanılır…",
    save: "Baxışı yadda saxla",
    retention: "Xam audit sübutu və tarixçə heç vaxt silinmir.",
  },
};

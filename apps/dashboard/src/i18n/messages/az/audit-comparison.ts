/** The audit comparison card: run pair selection and the evidence delta. */
import type { MessagesFor } from "../types";

export const auditComparison: MessagesFor<"auditComparison"> = {
  eyebrow: "Anlıq görüntü kəşfiyyatı",
  title: "Audit icralarını müqayisə edin",
  description:
    "Dəyişməz problem və səhifə sübutundan istifadə edərək geriləmələri təsdiqlənmiş düzəlişlərdən ayırın. Yeni tarama başladılmır.",
  state: {
    comparable: "Müqayisə edilə bilər",
    partial: "Qismən sübut",
    unavailable: "Səhifə sübutu əlçatan deyil",
  },
  emptyTitle: "İki tamamlanmış audit tələb olunur",
  emptyBody:
    "Bir bazis və bir təqib auditi işlədin. Açar söz, kontent və rəqib araşdırma icraları texniki tarixçədən istisna edilir.",
  baselineAudit: "Bazis audit",
  currentAudit: "Cari audit",
  openBaselineEvidence: "Bazis sübutunu aç",
  openCurrentEvidence: "Cari sübutu aç",
  loading: "Sübut deltası hesablanır…",
  errorTitle: "Müqayisə əlçatan deyil",
  regressionPressure: "Geriləmə təzyiqi",
  scoreExplainer:
    "Yeni problemlər ciddilik çəkisi əlavə edir (kritik 8, yüksək 5, orta 3, aşağı 1); düzəlişlər onu çıxır. HTTP geriləmələri 3, indekslənəbilirlik geriləmələri 2 əlavə edir. Mənfi dəyər xalis yaxşılaşmadır.",
  summary: {
    newWorse: "Yeni / pisləşən problemlər",
    resolvedReduced: "Həll edilmiş / azalmış",
    healthChange: "SEO sağlamlıq dəyişikliyi",
    pageRegressions: "Səhifə geriləmələri",
    pagesCaptured: "Tutulmuş səhifələr",
    reviewedExcluded: "Baxılmış küy istisna edilib",
  },
  configuration: "Konfiqurasiya",
  configMatched:
    "Saxlanılan tarama parametrləri hər iki anlıq görüntüdə üst-üstə düşür.",
  configDifferent: "Fərqli girişlər: {differences}.",
  configUnavailable:
    "Saxlanılan parametrlər əlçatan deyil, ona görə əhatə ekvivalentliyi sübut edilə bilmir.",
  configFingerprints: "Konfiqurasiya barmaq izləri: {baseline}… → {current}…",
  warningsTitle: "Şərh qeydləri",
  columns: {
    finding: "Tapıntı",
    change: "Dəyişiklik",
    url: "URL",
    before: "Əvvəl",
    after: "Sonra",
    source: "Mənbə",
    target: "Hədəf",
    beforeAfter: "Əvvəl → sonra",
  },
  regressions: {
    title: "Problem geriləmələri",
    description: "Yeni tapıntılar və ciddiliyi artan tapıntılar.",
    caption: "Yeni və pisləşən SEO problemləri",
    empty: "Yeni və ya pisləşən qüvvədə problem aşkarlanmadı.",
  },
  fixes: {
    title: "Təsdiqlənmiş düzəlişlər",
    description: "Cari anlıq görüntüdə olmayan və ya azalmış tapıntılar.",
    caption: "Həll edilmiş və azalmış SEO problemləri",
    empty: "Bu cütlükdə heç bir problem həlli təsdiqlənmədi.",
  },
  pages: {
    title: "Səhifə dəyişiklikləri",
    description: "Status, indekslənəbilirlik, əlavələr və silinmələr.",
    caption: "Audit anlıq görüntüləri arasında səhifə səviyyəli dəyişikliklər",
    empty: "Bu cütlük üçün səhifə səviyyəli dəyişiklik tutulmadı.",
  },
  links: {
    title: "Daxili bağlantı dəyişiklikləri",
    description:
      "Dəyişməz tarama qraflarından dəqiq mənbə-hədəf kənarları. Qırıq bağlantı yaranması və bərpası təsnif edilir; redaksiya strukturu neytral qalır.",
    graphCoverage: "Qraf əhatəsi",
    edgesCaptured: "Tutulmuş kənarlar",
    addedRemoved: "Əlavə / silinmiş",
    modified: "Dəyişdirilmiş",
    regressionsRecoveries: "Geriləmələr / bərpalar",
    warningsTitle: "Bağlantı müqayisə qeydləri",
    caption: "Audit anlıq görüntüləri arasında daxili bağlantı dəyişiklikləri",
    emptyUnavailable:
      "Müqayisə edilə bilən daxili bağlantı sübutunu tutmaq üçün hər iki auditi yenidən işlədin.",
    empty: "Bu cütlük üçün daxili bağlantı kənarı dəyişikliyi tutulmadı.",
  },
  siteWide: "Bütün sayt üzrə",
  notInSnapshot: "Anlıq görüntüdə yoxdur",
  indexabilityUnknown: "indekslənəbilirlik naməlumdur",
  indexable: "indekslənə bilər",
  notIndexable: "indekslənə bilməz",
  statusUnavailable: "status əlçatan deyil",
  notPresent: "Mövcud deyil",
  occurrenceOne: "{count} rast gəlmə",
  occurrenceOther: "{count} rast gəlmə",
  truncationNotice:
    "API cavabı təhlükəsizlik limitinə çatdı. Tam saxlanılan korpus üçün icra məlumatını ixrac edin və ya SDK-dan istifadə edin.",
};

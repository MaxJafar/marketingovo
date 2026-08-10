/** The decision-center overview: health hero, metric grid, source health. */
import type { MessagesFor } from "../types";

export const overview: MessagesFor<"overview"> = {
  eyebrow: "Qərar mərkəzi",
  siteTitle: "{name} icmalı",
  fallbackTitle: "Marketinq icmalınız",
  description:
    "Nəyin dəyişdiyini, nəyin önəmli olduğunu və hansı addımın nəticələri yaxşılaşdırma ehtimalının ən yüksək olduğunu görün.",
  startingAudit: "Audit başladılır…",
  runFullAudit: "Tam audit işlət",
  auditNotStartedTitle: "Audit başlaya bilmədi",
  auditQueuedTitle: "Audit növbəyə alındı",
  auditQueuedBody:
    "Audit qəbul edildi. Gedişatı Auditlər iş sahəsindən izləyin.",
  health: {
    eyebrow: "Sayt sağlamlığı",
    title: "Növbəti qərarınız üçün aydın bazis",
    body: "Sağlamlıq balı konfiqurasiya etdiyiniz audit mənbələrinin qaytardığı siqnalları birləşdirir. Çatışmayan girişlər görünən qalır.",
    reviewActions: "Prioritetləşdirilmiş tədbirlərə bax",
    currentScore: "Cari bal",
    pointsVsPriorAudit: "əvvəlki auditə nisbətən {change} sağlamlıq balı",
    comparisonUnavailable: "Müqayisə əlçatan deyil",
  },
  regressions: {
    eyebrow: "İndi izləyin",
    title: "Kritik geriləmələr",
    body: "Dərhal müdaxilə tələb edə bilən problemlər.",
    openQueue: "Tədbir növbəsini aç",
  },
  performance: {
    title: "Performansa bir baxış",
    description:
      "Marketinq nəticələri və texniki əhatə — çatışmayan məlumatı sıfıra çevirmədən.",
    organicClicks: "Orqanik kliklər",
    organicClicksHelp: "Müqayisələr üçün Search Console-u qoşun",
    organicKeyEvents: "Orqanik əsas hadisələr",
    organicKeyEventsHelp: "Orqanik nəticələri ölçmək üçün GA4-ü qoşun",
    indexableCoverage: "İndekslənə bilən əhatə",
    coreWebVitalsPassRate: "Core Web Vitals keçid faizi",
  },
  topActions: {
    title: "İlk 5 tədbir",
    description:
      "Təxmini təsir, əmək, əminlik və API-nin təqdim etdiyi sübuta görə sıralanıb.",
    viewAll: "Bütün tədbirlərə bax",
    emptyTitle: "Hələ prioritetləşdirilmiş tədbir yoxdur",
    emptyDescription:
      "Məlumat mənbələrinizi qoşduqdan sonra bazis audit işlədin. Etibarlı boş nəticə boş göstərilir — mükəmməl bal kimi yox.",
  },
  trendTitle: "Sağlamlıq balı trendi",
  sources: {
    title: "Məlumat mənbəyi sağlamlığı",
    description: "Bu görünüşü hansı girişlərin dəstəklədiyini bilin.",
    manage: "İdarə et",
    updated: "{date} tarixində yenilənib",
    coverage: "{value}% əhatə",
    unavailableTitle: "Mənbə statusu əlçatan deyil",
    unavailableBody: "API bu icmalın arxasındakı mənbələri müəyyən etmədi.",
  },
};

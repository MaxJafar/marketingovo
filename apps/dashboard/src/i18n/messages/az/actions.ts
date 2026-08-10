/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
import type { MessagesFor } from "../types";

export const actions: MessagesFor<"actions"> = {
  eyebrow: "Sübutdan nəticəyə iş masası",
  title: "Tədbirlər",
  description:
    "Texniki sübutu biznes məruzluğundan ayırmadan SEO işini prioritetləşdirin, araşdırın, təyin edin və yoxlayın.",
  statusNotSavedTitle: "Tədbir statusu yadda saxlanmadı",
  filterTitle: "İndi önəmli olan işi tapın",
  filterDescription:
    "Tövsiyə, qayda, modul və ya məsul üzrə axtarın. Çatışmayan sübut əlçatmaz qalır və heç vaxt sıfıra çevrilmir.",
  resetFilters: "Filtrləri sıfırla",
  searchLabel: "Tədbirləri axtar",
  searchPlaceholder: "Kanonik, qırıq bağlantılar, məsul…",
  statusFilterLabel: "Status",
  allStatuses: "Bütün statuslar",
  verificationFilterLabel: "Yoxlama",
  allVerification: "Bütün yoxlamalar",
  effortFilterLabel: "Əmək",
  allEffort: "Bütün əmək səviyyələri",
  effortOption: {
    low: "Aşağı",
    medium: "Orta",
    high: "Yüksək",
  },
  sortByLabel: "Sıralama",
  sortOption: {
    priority: "Prioritet balı",
    updated: "Ən son yenilənən",
    affected: "Təsirlənən URL-lər",
    confidence: "Əminlik",
  },
  priorityLegend: "Prioritet",
  priorityGroupLabel: "Tədbirləri prioritet üzrə filtrləyin",
  priorityFilter: {
    all: "Hamısı",
    critical: "Kritik",
    high: "Yüksək",
    medium: "Orta",
    low: "Aşağı",
  },
  showingCount: "{total} tədbirdən {visible} göstərilir",
  tableLabel: "Prioritetləşdirilmiş SEO tədbirləri",
  columnPriority: "Prioritet",
  columnAction: "Tədbir və sübut qrupu",
  columnScope: "Əhatə",
  columnEffort: "Əmək",
  columnConfidence: "Əminlik",
  columnWorkflow: "İş axını",
  columnVerification: "Yoxlama",
  columnUpdated: "Yenilənib",
  statusLabel: {
    open: "açıq",
    acknowledged: "qəbul edilib",
    in_progress: "icradadır",
    resolved: "həll edilib",
  },
  verificationLabel: {
    pending: "gözləyir",
    verified: "təsdiqlənib",
    regressed: "geriləyib",
  },
  moduleUnavailable: "Modul əlçatan deyil",
  ruleUnavailable: "Qayda əlçatan deyil",
  affectedUrls: "təsirlənən URL",
  organicVisitsExposed: "{count} orqanik ziyarət məruz qalır",
  businessExposureUnavailable: "Biznes məruzluğu əlçatan deyil",
  workflowStatusFor: "{title} üçün iş axını statusu",
  saving: "Yadda saxlanılır…",
  emptyFilteredTitle: "Bu filtrlərə uyğun tədbir yoxdur",
  emptyFilteredDescription:
    "Sübuta əsaslanan tam növbəyə qayıtmaq üçün bir və ya bir neçə filtri sıfırlayın.",
  emptyQueueTitle: "Hələ prioritetləşdirilmiş tədbir yoxdur",
  emptyQueueDescription:
    "İlk tədbir növbəsini yaratmaq üçün audit işlədin. Etibarlı boş nəticə heç vaxt mükəmməl bal kimi təqdim edilmir.",
};

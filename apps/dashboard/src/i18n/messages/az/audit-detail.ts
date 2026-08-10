/** The audit run page: replay, sitemap coverage, and the evidence workbench. */
import type { MessagesFor } from "../types";

export const auditDetail: MessagesFor<"auditDetail"> = {
  backToAudits: "Auditlərə qayıt",
  eyebrow: "Audit icrası",
  runTitle: "İcra {id}",
  fallbackTitle: "Audit təfərrüatları",
  description:
    "Mənbə əhatəsini və dəqiq sübutu araşdırın, ya da saxlanılan icra konfiqurasiyasını saytın cari vəziyyətinə qarşı yenidən işlədin.",
  queuingReplay: "Təkrar icra növbəyə alınır…",
  replayConfiguration: "Konfiqurasiyanı təkrar işlət",
  replayErrorTitle: "Təkrar icra başlaya bilmədi",
  replayQueuedTitle: "Müstəqil təkrar icra növbəyə alındı",
  replayQueuedBefore:
    "Saxlanılan v{version} konfiqurasiyası bu icranı dəyişmədən kopyalandı. Təkrar icra saytın və provayderin cari vəziyyətini oxuyur.",
  replayQueuedLink: "Təkrar icranı aç",
  replayQueuedAfter: ".",
  boundaryTitle: "Təkrar icra sərhədi",
  boundaryBody:
    "Təkrar icra bu saxlanılan iş axınından və onun dəqiq seçimlərindən yeni icra yaradır. Bu nəticəni heç vaxt redaktə etmir; canlı səhifələr və inteqrasiyalar yenidən sorğulanır ki, dəyişikliklər ölçülə bilən qalsın.",
  summary: {
    status: "Status",
    started: "Başlayıb",
    completed: "Tamamlanıb",
    issueInstances: "Problem halları",
  },
  breakdownTitle: "Problem bölgüsü",
  breakdownEmptyTitle: "Bölgü əlçatan deyil",
  breakdownEmptyBody: "İcra ciddilik cəmlərini qaytarmadı.",
  runLogTitle: "İcra jurnalı",
  runLogEmptyTitle: "Jurnal qeydi yoxdur",
  runLogEmptyBody: "API icra jurnalı qaytarmadı.",
  sitemap: {
    eyebrow: "Tutulmuş mənbə",
    title: "Sitemap əhatəsi",
    description:
      "Əhatə tutulmuş indekslənə bilən tarama URL-lərini məhz bu icranın istifadə etdiyi sitemap anlıq görüntüsü ilə müqayisə edir.",
    declaredUrls: "Bəyan edilmiş URL-lər",
    indexableDiscovered: "İndekslənə bilən aşkarlanmış",
    matched: "Uyğunlaşmış",
    coverage: "Əhatə",
    snapshotBefore: "Anlıq görüntü:",
    httpStatusSuffix: " · HTTP {status}",
    filesLabel: "Tutulmuş sitemap faylları",
    fileColumn: "Sitemap faylı",
    typeColumn: "Növ",
    httpColumn: "HTTP",
    locationsColumn: "Yerlər",
    missingIndexable: "İndekslənə bilən, lakin yoxdur",
    declaredNotCrawled: "Bəyan edilib, lakin taranmayıb",
    brokenDeclared: "Bəyan edilmiş HTTP xətaları",
    sampleUnavailable:
      "Təsdiqlənmiş sitemap anlıq görüntüsü tutulmadığı üçün əlçatan deyil.",
    sampleTruncated:
      "{total} URL-dən ilk {shown} göstərilir. JSON hesabatı tutulmuş kohortun tamamını qoruyur.",
  },
  tabs: {
    crawl: {
      label: "Tarama yolları",
      description: "Tutulmuş ən qısa kəşf yolu və ilk istinadçı.",
    },
    redirects: {
      label: "Yönləndirmələr",
      description: "Sorğulanan URL, hər yönləndirmə addımı və son cavab.",
    },
    hreflang: {
      label: "Hreflang",
      description: "Dil hədəfləri, öz-özünə istinadlar və qarşılıqlı sübut.",
    },
    extractions: {
      label: "Çıxarmalar",
      description:
        "Konfiqurasiya edilmiş çıxarıcı qaydalarla tutulmuş xüsusi sahələr.",
    },
  },
  crawl: {
    tableLabel: "Tarama yolu sübutu",
    pageColumn: "Səhifə",
    depthColumn: "Dərinlik",
    referrerColumn: "İlk istinadçı",
    httpColumn: "HTTP",
    indexableColumn: "İndekslənə bilər",
    seed: "Toxum",
  },
  redirects: {
    tableLabel: "Yönləndirmə yolu sübutu",
    requestedColumn: "Sorğulanan URL",
    pathColumn: "Tutulmuş yol",
    hopsColumn: "Addımlar",
    finalHttpColumn: "Son HTTP",
  },
  hreflang: {
    tableLabel: "Hreflang sübut matrisi",
    sourceColumn: "Mənbə səhifə",
    languageColumn: "HTML / öz dili",
    alternateColumn: "Alternativ",
    targetColumn: "Hədəf",
    reciprocalColumn: "Qarşılıqlı",
    missing: "Çatışmır",
    selfReference: "Öz-özünə istinad",
    mismatch: "Gözlənilən: {expected}; müşahidə edilən: {observed}",
    sourceFallback: "mənbə",
    noneFallback: "yoxdur",
  },
  extractions: {
    tableLabel: "Xüsusi çıxarma sübutu",
    pageColumn: "Səhifə",
    fieldsColumn: "Tutulmuş sahələr",
    noMatch: "Uyğunluq yoxdur",
    truncatedSuffix: " (kəsilib)",
  },
  workbench: {
    eyebrow: "Versiyalanmış audit sübutu",
    title: "Sübut iş masası",
    description:
      "UI saxlanılan sübutu səhifələyir; cəmi göstərmədən kohortu heç vaxt kəsmir.",
    tablistLabel: "Sübut bölmələri",
    searchLabel: "Sübutu səhifə URL-i və ya başlığı ilə axtar",
    searchPlaceholder: "Səhifə URL-i və ya başlığı axtar",
    search: "Axtar",
    clear: "Təmizlə",
    paginationLabel: "Sübut səhifələri",
    previous: "Əvvəlki",
    next: "Növbəti",
    pageIndicator: "Səhifə {page} / {pages} · {records} qeyd",
  },
  emptyTitle: "{section} tutulmayıb",
  emptyUnavailable:
    "Bu icrada versiyalanmış səhifə sübutu yoxdur. İş masasını doldurmaq üçün yeni audit işlədin.",
  emptyFiltered:
    "Seçilmiş icrada uyğun {section} yoxdur. Bu, ölçülmüş boş vəziyyətdir — uğursuz sorğu deyil.",
  fallbackEvidence: "sübut",
  fallbackRecords: "qeyd",
};

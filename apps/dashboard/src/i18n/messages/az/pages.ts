/** URL inventory: the crawled pages table and its indexability evidence. */
import type { MessagesFor } from "../types";

export const pages: MessagesFor<"pages"> = {
  eyebrow: "URL inventarı",
  title: "Səhifələr",
  description:
    "Texniki tarama sübutunu URL səviyyəsində orqanik trafik və konversiya konteksti ilə birləşdirin.",
  columns: {
    page: "Səhifə",
    http: "HTTP",
    indexability: "İndekslənəbilirlik",
    clicks: "Kliklər",
    internalLinks: "Daxili bağlantılar",
    organicKeyEvents: "Orqanik əsas hadisələr",
    issues: "Problemlər",
    coreWebVitals: "Core Web Vitals",
    lastCrawled: "Son tarama",
  },
  linkCounts: "{inCount} daxil olan · {outCount} çıxan",
  linkDepth: "Dərinlik {depth} · fərqli səhifələr",
  explore: "Tədqiq et",
  exploreLinksFor: "{page} üçün daxili bağlantıları tədqiq et",
  searchLabel: "Səhifələri axtar",
  searchPlaceholder: "Başlıq və ya URL üzrə axtar",
  tableLabel: "Taranmış səhifələr",
  noMatchTitle: "Uyğun səhifə yoxdur",
  noMatchBody: "Daha geniş başlıq və ya URL axtarışı sınayın.",
  emptyTitle: "Taranmış səhifə yoxdur",
  emptyBody:
    "API boş səhifə inventarı qaytardı. URL səviyyəsində sübut toplamaq üçün audit işlədin.",
  indexability: {
    reasons: {
      indexable: "Tarama sübutundan təsdiqlənib",
      robotsBlocked: "robots.txt tərəfindən bloklanıb",
      metaNoindex: "Meta robots noindex",
      xRobotsNoindex: "X-Robots-Tag noindex",
      canonicalized: "Kanonik başqa URL-ə yönəlir",
      nonHtml: "HTML olmayan cavab",
      redirect: "Yönləndirmə cavabı",
      httpError: "HTTP xəta cavabı",
      noContent: "Cavab məzmunu yoxdur",
      fetchError: "Yükləmə alınmadı",
      missingStatus: "HTTP statusu əlçatan deyil",
      unexpectedStatus: "Gözlənilməz HTTP statusu",
      missingContentType: "Məzmun növü əlçatan deyil",
      robotsUnknown: "Robots sübutu əlçatan deyil",
      parseFailed: "HTML sübutu əlçatan deyil",
    },
    evidenceUnavailable: "Sübut əlçatan deyil",
    legacyResult: "Köhnə format audit nəticəsi",
  },
};

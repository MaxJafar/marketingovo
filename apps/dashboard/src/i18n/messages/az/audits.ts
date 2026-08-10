/** The audits page: run launcher, private-site approval, crawl history. */
import type { MessagesFor } from "../types";

export const audits: MessagesFor<"audits"> = {
  eyebrow: "Tarama tarixçəsi",
  title: "Auditlər",
  description:
    "Bazis başladın, aktiv taramaları izləyin və tamamlanmış texniki anlıq görüntüləri müqayisə edin.",
  starting: "Başladılır…",
  runFullAudit: "Tam audit işlət",
  privateAccess: {
    summary: "Özəl sayta giriş",
    allowTitle:
      "Bu audit üçün məhz bu host adına özəl şəbəkəyə girişə icazə ver",
    allowHelp:
      "Yalnız {host}. Bu icazə layihəni dəyişənə qədər bu səhifədən başladılan auditlərə şamil olunur; bulud metadata həmişə bloklu qalır.",
  },
  scope: {
    summary: "Ekspert audit əhatəsi",
    title: "Dəqiq URL kohortunu audit edin",
    body: "Hər sətirdə bir mütləq URL yerləşdirin. Marketingovo yalnız bu siyahını tarayır və hər URL-i toxum kimi saxlayır — bu, miqrasiyalar, şablonlar, QA nümunələri və yoxlama icraları üçün faydalıdır.",
    urlListLabel: "URL siyahısı",
    urlListHelp:
      "URL-lər layihənin mənşəyini istifadə etməlidir. Fraqmentlər və dublikatlar icra başlamazdan əvvəl silinir.",
    errorTitle: "URL kohortu diqqət tələb edir",
    submit: "URL siyahısı auditini işlət",
    atLeastOneUrl: "Ən azı bir mütləq URL əlavə edin.",
    invalidUrl: "Etibarsız URL: {url}",
    unsupportedScheme: "Dəstəklənməyən URL sxemi: {scheme}",
  },
  startErrorTitle: "Audit başlaya bilmədi",
  queuedTitle: "Audit növbəyə alındı",
  queuedBody:
    "API icranı qəbul etdi. Səhifəni yeniləyin və ya aşağıda statusu izləyin.",
  columns: {
    started: "Başlayıb",
    status: "Status",
    trigger: "Tətikləyici",
    pagesCrawled: "Taranmış səhifələr",
    issues: "Problemlər",
    healthScore: "Sağlamlıq balı",
  },
  tableLabel: "Audit icraları",
  emptyTitle: "Hələ audit icrası yoxdur",
  emptyBody:
    "Tarama tarixçəsini və prioritetləşdirilmiş tədbirləri doldurmaq üçün tam bazis auditi başladın.",
};

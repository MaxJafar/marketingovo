import type { MessagesFor } from "../types";

export const settings: MessagesFor<"settings"> = {
  eyebrow: "İş sahəsi konfiqurasiyası",
  title: "Parametrlər",
  description:
    "Sayt kimliyini və bu lokal layihə ilə saxlanan hesabat seçimlərini yeniləyin.",
  languageTitle: "Dil",
  languageDescription:
    "Bu cihazda bu konsolun interfeys dili. Məlumatlar, hesabatlar və agent səthləri tərcümə edilmir.",
  languageLabel: "İnterfeys dili",
  savedTitle: "Parametrlər yadda saxlandı",
  savedBody: "Lokal API yenilənmiş iş sahəsi parametrlərini qəbul etdi.",
  notSavedTitle: "Parametrlər yadda saxlanmadı",
  notExportedTitle: "Layihə ixrac edilmədi",
  notImportedTitle: "Layihə idxal edilmədi",
  importedTitle: "Layihə idxal edildi",
  importedSummary:
    "{runs} icra, {actions} tədbir, {contextVersions} kontekst reviziyası, {contextEntries} jurnal qeydi, {extractionRuleVersions} çıxarma qaydası reviziyası və {artifacts} hesabat artefaktı idxal edildi. Qrafiklər deaktivdir və {reconnect}.",
  reconnectList: "bu inteqrasiyalar yenidən qoşulmalıdır: {providers}",
  reconnectNone: "heç bir inteqrasiyanın yenidən qoşulması tələb olunmur",
  notDeletedTitle: "Layihə silinmədi",
  deletedTitle: "Lokal layihə silindi",
  deletedSummary:
    "{runs} icra, {issueInstances} problem müşahidəsi, {actions} tədbir, {extractionRuleVersions} çıxarma qaydası reviziyası və {artifacts} artefakt silindi. {cleanup} Qlobal inteqrasiya etimadnamələri digər layihələr üçün saxlanıldı.",
  cleanupComplete: "Fayl sistemi təmizliyi tamamlandı.",
  cleanupScheduled:
    "Fayl sistemi təmizliyi xidmətin növbəti işə düşməsinə planlaşdırılıb.",
  siteIdentity: "Sayt kimliyi",
  siteName: "Sayt adı",
  canonicalUrl: "Kanonik URL",
  reporting: "Hesabatlıq",
  timezone: "Saat qurşağı",
  reportingCurrency: "Hesabat valyutası",
  retentionTarget: "Lokal saxlama hədəfi (gün)",
  reportPreferences: "Hesabat seçimləri",
  alertEmail: "Hesabat əlaqə e-poçtu",
  alertEmailHelp:
    "Hesabat metadatası kimi lokal saxlanılır. Marketingovo hostinqli e-poçt xəbərdarlıqları göndərmir.",
  weeklyDigest: "Həftəlik xülasə seçimi",
  weeklyDigestHelp:
    "Xülasə hesabatları yaradılarkən həftəlik prioritetləri, trendləri və geriləmələri daxil edin.",
  saving: "Yadda saxlanılır…",
  save: "Parametrləri yadda saxla",
  portabilityTitle: "Layihə daşınabilirliyi",
  portabilityBodyBefore: "Versiyalanmış",
  portabilityBodyAfter:
    "paketini ixrac edin — audit tarixçəsi, tədbirlər, metrikalar, Layihə konteksti reviziyaları, marketoloq jurnalı, xüsusi qaydalar, konnektor parametrləri və məhdudlaşdırılmış hesabat artefaktları ilə. Etimadnamələr, tokenlər, kukilər, başlıqlar və lokal fayl yolları heç vaxt daxil edilmir.",
  exporting: "İxrac edilir…",
  exportProject: "Layihəni ixrac et",
  importing: "İdxal edilir…",
  importProject: "Layihəni idxal et",
  importHelp:
    "İdxal həmişə yeni lokal layihə yaradır, identifikatorları yenidən xəritələyir, problem barmaq izlərini, konteksti, çıxarma qaydalarını və hər icranın arxasındakı konfiqurasiya anlıq görüntüsünü qoruyur, idxal edilmiş qrafikləri deaktiv edir və inteqrasiyaların yenidən qoşulmasını tələb edir.",
  dangerZone: "Təhlükə zonası",
  deleteTitle: "Lokal layihəni sil",
  deleteBody1:
    "Bu layihəni, onun icralarını, xam sübutunu, tədbir tarixçəsini, Layihə kontekstini, çıxarma qaydası reviziyalarını, qrafiklərini, parametrlərini və hesabat artefaktlarını bu cihazdan həmişəlik silin. Yenidən lazım ola bilərsə, əvvəlcə layihəni ixrac edin.",
  deleteBody2:
    "Qlobal BYOK etimadnamələri digər layihələrə xidmət edə biləcəyi üçün bilərəkdən saxlanılır. Onları ayrıca İnteqrasiyalar bölməsindən ləğv edin.",
  deleteProject: "Layihəni sil",
  confirmLabel: "Təsdiq üçün layihə adını yazın",
  confirmHelpBefore: "Dəqiq olaraq",
  confirmHelpAfter: "yazın. Bu əməliyyat geri qaytarıla bilməz.",
  cancel: "Ləğv et",
  deleting: "Silinir…",
  permanentlyDelete: "Layihəni həmişəlik sil",
};

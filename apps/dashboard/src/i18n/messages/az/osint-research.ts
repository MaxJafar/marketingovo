/** Public-web OSINT page: pass form, dossier cards, trust, findings, history. */
import type { MessagesFor } from "../types";

export const osintResearch: MessagesFor<"osintResearch"> = {
  eyebrow: "Məhsul prioriteti · kəşfiyyat qatı",
  title: "İctimai veb OSINT",
  description:
    "Saytınızdan və açıq şəkildə göstərilmiş ən çox dörd ictimai hədəfdən sərhədli, mənbəyə bağlı dosye qurun. Qraf müşahidə olunanı qoruyur və çatışmayan məlumatı iddiaya çevirmir.",
  available: "Əlçatan",
  sourceLink: "mənbə",
  citedEvidenceOne: "{count} istinad edilmiş sübut elementi",
  citedEvidenceMany: "{count} istinad edilmiş sübut elementi",
  confidencePct: "{confidence}% əminlik",
  evidence: {
    confidence: "{label} · {confidence}% əminlik",
    observedAt: "· {date} tarixində müşahidə edilib",
    claimLabel: "· iddia",
  },
  form: {
    title: "Sübut keçidi başladın",
    description:
      "Layihə saytı avtomatik daxil edilir. Əhatəyə düşdükdə ictimai rəqib, tərəfdaş, xəbər otağı və ya istinad URL-ləri əlavə edin.",
    targetsLabel: "Əlavə ictimai hədəflər",
    targetsHelp:
      "Hər sətirdə bir olmaqla ən çox dörd URL. Yalnız HTTPS; etimadnamələr, kukilər, hesab yoxlamaları və ya insan axtarışı keçidləri yoxdur.",
    queueing: "İctimai veb araşdırması növbəyə alınır…",
    run: "OSINT keçidini işlət",
    invalidTarget: "Açıq ictimai https:// URL istifadə edin: {url}",
    rejectedTitle: "Hədəf siyahısı qəbul edilmədi",
    failedTitle: "OSINT icrası başlaya bilmədi",
    queuedTitle: "OSINT icrası növbəyə alındı",
    queuedBody:
      "İcra ictimai veb limitləri ilə toplanır. Sübut dosyesi yadda saxlandıqda bu səhifə yenilənəcək.",
  },
  target: {
    eyebrow: "Hədəf dosyesi",
    pagesObserved: "Müşahidə edilən səhifələr",
    availableEvidence: "Əlçatan sübut",
    graphEntities: "Qraf obyektləri",
    graphLinks: "Qraf bağlantıları",
    finalUrl: "Son URL:",
    publishingSignalTitle: "İctimai dərcetmə siqnalı",
    cadenceItemsOne: "müşahidə edilən lentdə {count} tarixli element",
    cadenceItemsMany: "müşahidə edilən lentdə {count} tarixli element",
    cadenceUnavailable: "; ölçülmüş interval olmadan ritm əlçatan deyil.",
    cadenceAverage: "; orta interval {days} gün.",
    cadenceDisclaimer: "Bu, dərcetmə sübutudur — əhatə və ya cəlbetmə deyil.",
    notObservedTitle: "Hədəf tam müşahidə edilmədi",
  },
  coverage: {
    title: "Əhatə və siyasət",
    description:
      "Hər müşahidə öz mənbəyini və sübut vəziyyətini saxlayır. Çatışmayan siqnal heç vaxt sıfıra çevrilmir.",
    coverage: "Əhatə",
    targetsCompleted: "Tamamlanmış hədəflər",
    pagesObserved: "Müşahidə edilən səhifələr",
    evidenceAvailable: "Əlçatan sübut",
    publicWebOnly: "Yalnız ictimai veb",
    personalDataDisabled: "Şəxsi məlumatlar deaktivdir",
    identityResolutionDisabled: "Kimlik müəyyənləşdirmə deaktivdir",
    authenticatedCollectionDisabled: "Autentifikasiyalı toplama deaktivdir",
    darkWebDisabled: "Dark web deaktivdir",
  },
  trust: {
    title: "Etibar və mənşə",
    description:
      "Sabit iddia barmaq izləri təkrar keçidləri auditə yararlı edir, lakin ictimai veb müşahidəsini müstəqil təsdiqlənmiş həqiqət kimi təqdim etmir.",
    claimFingerprints: "İddia barmaq izləri",
    sourceUrlsRecorded: "Qeydə alınmış mənbə URL-ləri",
    integrityRecord: "Bütövlük qeydi",
    recorded: "Qeydə alınıb",
    incomplete: "Natamam",
    legacyDossier: "Köhnə format dosye",
    fingerprintAlgorithm: "Barmaq izi alqoritmi",
    evidenceDigest: "Sübut həzmi:",
    olderFormatTitle: "Köhnə dosye formatı",
    olderFormatBody:
      "Bu saxlanılan keçid iddia barmaq izlərindən əvvələ aiddir. Hər müşahidə üçün mənşəyi qeydə almaq üçün yeni ictimai veb keçidi işlədin.",
    fingerprintScope:
      "Barmaq izləri müşahidə edilən iddia sahələrini əhatə edir və tutulma vaxtını bilərəkdən istisna edir. Həzm hesabat dəyişikliklərini aşkarlayır; mənbənin dəqiq və ya səlahiyyətli olduğunu sertifikatlaşdırmır.",
  },
  findings: {
    title: "Tapıntılar",
    description: "İctimai vebdən təsviri, sübuta bağlı müşahidələr.",
    empty: "Müşahidə edilən sübut heç bir tapıntını dəstəkləmədi.",
  },
  history: {
    title: "Keçid tarixçəsi",
    comparedDescription:
      "{date} tarixindən bəri istinad edilmiş ictimai veb dəyişiklikləri. Bloklanmış hədəf yoxa çıxma kimi qiymətləndirilmək əvəzinə istisna edilir.",
    firstPassDescription:
      "Dəqiq siqnalları zamanla müqayisə etmək üçün ikinci ictimai veb keçidi işlədin.",
    baseline:
      "İlk keçid bazisi müəyyən edir. Sonrakı keçidlər kimlik iddiaları irəli sürmədən əlavə edilmiş, silinmiş və dəyişmiş sübutu bildirir.",
    noChanges:
      "Əvvəlki keçiddən bəri dəstəklənən heç bir ictimai siqnal dəyişməyib.",
    targetLabel: "· hədəf",
  },
  dossiers: {
    title: "Hədəf dosyeləri",
    generatedOne: "{date} tarixində yaradılıb · {count} sərhədli mənbə hədəfi.",
    generatedMany:
      "{date} tarixində yaradılıb · {count} sərhədli mənbə hədəfi.",
  },
  limitations: {
    title: "Bilinən məhdudiyyətlər",
    description:
      "Bu məhdudiyyətlər UI-da gizli boşluq deyil, dosye müqaviləsinin bir hissəsidir.",
  },
  noDossierTitle: "Hələ OSINT dosyesi yoxdur",
  noDossierBody:
    "Bu layihə üçün ilk sübuta bağlı dosyeni yaratmaq üçün yuxarıda ictimai veb keçidi işlədin.",
};

/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const adCabinets: MessagesFor<"adCabinets"> = {
  platformLabel: {
    all: "Bütün yerləşdirmələr",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Google Axtarış",
    google_search_partners: "Axtarış tərəfdaşları",
    google_display: "Google Display",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Digər yerləşdirmə",
  },
  metricLabel: {
    spend: "Xərc",
    impressions: "Göstərimlər",
    clicks: "Kliklər",
    link_clicks: "Bağlantı klikləri",
    conversions: "Konversiyalar",
    conversion_value: "Konversiya dəyəri",
    cost_per_conversion: "Konversiya başına xərc",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Əhatə",
    frequency: "Tezlik",
    video_plays: "Video oynatmalar",
  },
  state: {
    partial: "qismən — {observed}/{requested} gün",
    failed: "oxuna bilmədi",
    unavailable: "ölçülməyib",
  },
  performance: {
    loading: "Saxlanılan ölçmələr oxunur…",
    unreadable: "Bu kabinetin ölçmələri oxuna bilmədi.",
    neverSynced:
      "Heç vaxt sinxronizasiya edilməyib. Bu kabinetin xərcini və çatdırılmasını oxumaq üçün ödənişli audit işlədin. Nəsə ölçülənə qədər heç nə göstərilmir.",
    syncedRange: "{start} – {end}. Son sinxronizasiya: {date}.",
    metricHeader: "Metrika",
    valueHeader: "Dəyər",
    coverageHeader: "Əhatə",
    coverageComplete: "tam",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Qərara dəyər sorğular",
    loading: "Saxlanılan axtarış terminləri oxunur…",
    empty:
      "Bu hesab üçün hələ axtarış termini saxlanılmayıb. Ödənişli audit işlədin.",
    queryHeader: "Sorğu",
    matchedHeader: "Uyğunlaşıb",
    clicksHeader: "Kliklər",
    costHeader: "Xərc",
    conversionsHeader: "Konversiyalar",
    footnote:
      "Yalnız Axtarış və Alış-veriş. Performance Max və Demand Gen ümumiyyətlə sorğu bildirmir və Google anonimləşdirmək üçün çox nadir olan terminləri gizlədir, ona görə bu, heç vaxt hesabın bütün kliklərini əhatə etmir. Qısa siyahı heç nəyin israf edilmədiyinə sübut deyil.",
  },
  queue: {
    heading: "Təsdiqinizi gözləyir",
    empty:
      "Təsdiq gözləyən heç nə yoxdur. Qoşulmuş agent kampaniya hazırlayıb onu burada növbəyə qoya bilər; təsdiqləyə bilməz — bu məhsul da hələ reklam platformasına heç nə göndərə bilmir. Google Ads dizayn etibarilə yalnız oxunandır — bax: ADR 0008.",
    perDay: "gündə {amount}",
    lifetime: "ümumilikdə {amount}",
    noBudget: "Büdcə göstərilməyib",
    stagedOne:
      "{count} hazırlanmış yük. Təsdiqləməzdən əvvəl dəqiq sorğunu oxuyun — təsdiq bu versiyaya bağlanır və sonradan redaktə edilmiş yük yenidən təsdiqlənməlidir.",
    stagedMany:
      "{count} hazırlanmış yük. Təsdiqləməzdən əvvəl dəqiq sorğunu oxuyun — təsdiq bu versiyaya bağlanır və sonradan redaktə edilmiş yük yenidən təsdiqlənməlidir.",
    stagedBy: "{name} tərəfindən {date} tarixində hazırlanıb. Yük {hash}…",
    hidePayload: "Yükü gizlət",
    readPayload: "Yükü oxu",
    readBeforeApproving: "Təsdiqləməzdən əvvəl yükü oxuyun.",
    approveExact: "Məhz bu yükü təsdiqlə",
    withdraw: "Geri götür",
    approvalRefused: "Təsdiq rədd edildi.",
    footnote:
      "Təsdiqləmə məhz bu yükə razılığınızı qeydə alır. Heç nə göndərmir: bu quruluşda dizayn etibarilə Meta-ya gedən yazı yolu yoxdur.",
  },
  connections: {
    heading: "Qoşulmalar",
    integrationsLink: "İnteqrasiyalar",
    metaExpiredBefore:
      "Meta giriş tokeninin vaxtı bitib. Meta System User tokenlərinin sabit ömrü var və yenilənmir — Business Manager-də yenisini yaradın və bura yerləşdirin:",
    metaExpiredAfter:
      ". O vaxta qədər xərc və çatdırılma sıfır deyil, oxunmazdır.",
    metaConnectedExpiry:
      "Meta qoşulub. Tokenin vaxtı {date} bitir — ondan əvvəl rotasiya edin.",
    metaConnected: "Meta qoşulub.",
    metaMissingBefore:
      "Meta qoşulmayıb, ona görə Facebook və Instagram xərci oxuna bilmir. Meta Business Manager-də System User tokeni yaradın və bura yerləşdirin:",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "Google Ads üçün Google girişinin vaxtı bitib. Onu burada yenidən qoşun:",
    googleExpiredAfter: ". O vaxta qədər Google xərci sıfır deyil, oxunmazdır.",
    googleConnected: "Google Ads qoşulub.",
    googleMissingBefore:
      "Google Ads qoşulmayıb. İki şey lazımdır: Google girişi və Google Ads menecer hesabının API Center-indən öz developer tokeniniz. Marketingovo developer tokeni ilə gəlmir — tətbiqə daxil edilmiş token hər quraşdırmanı Google üçün vahid kimliyə çevirərdi və onun limit və şərtləri sahibinə bağlanır. Google yeni tokenləri əl ilə təsdiqləyir, ona görə lazım olmazdan əvvəl müraciət edin. Hər ikisi bura daxil edilir:",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Reklam kabinetləri",
    providerSelectLabel: "Hesabları axtarılacaq provayder",
    asking: "{provider} soruşulur…",
    findAccounts: "Hesablarımı tap",
    starting: "Başladılır…",
    runPaidAudit: "Ödənişli audit işlət",
    auditCheckBefore:
      "Ödənişli audit bu reklamların insanları göndərdiyi səhifələri də yoxlayır — 404 verən təyinatları, klik identifikatorunu itirən yönləndirmələri və təklif verilən şeyi heç vaxt xatırlatmayan açılış səhifələrini. Tapıntılar burada görünür:",
    actionsLink: "Tədbirlər",
    auditCheckAfter:
      ". Əvvəlcə SEO auditi işlətmək yoxlamanı ucuzlaşdırır və ona səhifə sürətini əlavə edir; onsuz hər təyinat birbaşa yüklənir.",
    empty:
      "Bu iş sahəsinə heç bir reklam hesabı bağlanmayıb. Bir giriş adətən bir neçə hesaba çatır və bu iş sahəsinin onlardan hansını oxuyacağı sizin qərarınızdır — provayderi qoşmaq özlüyündə heç nəyi bağlamır.",
    billsIn: "hesablaşma valyutası: {currency}",
    noCurrency: "bu hesab üçün valyuta bildirilməyib",
    dailyCap: "gündəlik limit {cap}",
    noDailyCap: "lokal gündəlik limit qoyulmayıb",
    hidePerformance: "Performansı gizlət",
    showPerformance: "Performansı göstər",
    archive: "Arxivlə",
    remove: "Sil",
    removeTitle: "Kabineti və ona qarşı qeydə alınmış bütün ölçmələri silir.",
    discoveryFailed: "Hesab kəşfi üçün {provider} ilə əlaqə qurula bilmədi.",
    discoveredHeading: "Bu etimadnamənin çata bildiyi hesablar",
    linked: "Bağlanıb",
    linkToWorkspace: "Bu iş sahəsinə bağla",
  },
};

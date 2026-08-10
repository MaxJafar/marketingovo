/** Workspace setup wizard: five linear steps from empty install to first runs. */
import type { MessagesFor } from "../types";

export const wizard: MessagesFor<"wizard"> = {
  eyebrow: "Quraşdırma",
  title: "Marketinq iş sahənizi yaradın",
  description:
    "Real məlumatlı panelə beş addım. Yalnız brend adı tələb olunur.",
  progressLabel: "Quraşdırma gedişatı",
  optional: "İstəyə bağlı",
  errorTitle: "Bu addım yadda saxlanıla bilmədi",
  genericError: "Nəsə səhv getdi.",
  launchError: "İcralar başladıla bilmədi.",
  back: "Geri",
  continue: "Davam et",
  saving: "Yadda saxlanılır…",
  starting: "Başladılır…",
  startRuns: "İlk icraları başlat",
  goToDashboard: "İdarə panelinə keç",
  steps: {
    workspace: { label: "İş sahəsi", hint: "Brendi adlandırın." },
    brand: {
      label: "Brend mövcudluğu",
      hint: "Brendin başqa harada yaşadığı.",
    },
    competitors: { label: "Rəqiblər", hint: "Kimə qarşı ölçüləcəyi." },
    data: { label: "Məlumat mənbələri", hint: "İstəyə bağlı. Ötürülə bilər." },
    launch: { label: "Baxış", hint: "İlk icraları başladın." },
  },
  providers: {
    googleSearchConsole: {
      label: "Google Search Console",
      why: "Tapıntıları həqiqətən göstərim qazanan sorğu və səhifələrə görə sıralayır.",
      field: "Mülk URL-i və ya sc-domain identifikatoru",
    },
    googleAnalytics4: {
      label: "Google Analytics 4",
      why: "Tapıntıları təkcə ciddiliyə görə deyil, sessiya və konversiyalara görə çəkiləndirir.",
      field: "Mülk ID-si",
    },
    pagespeedInsights: {
      label: "PageSpeed Insights",
      why: "Texniki auditə sahə Core Web Vitals ölçmələrini əlavə edir.",
      field: "API açarı",
    },
    serpapi: {
      label: "SerpAPI",
      why: "Canlı mövqe izləməsi üçün tələb olunur. Onsuz mövqelər ölçülməmiş qalır.",
      field: "API açarı",
    },
  },
  runs: {
    baselineAudit: "Bazis audit",
    competitorComparison: "Rəqib müqayisəsi",
    osintDossier: "İctimai veb OSINT dosyesi",
  },
  workspace: {
    title: "Nəyi izləyirik?",
    description:
      "İş sahəsi brendin adını daşıyır. Veb saytı yalnız taranmasını istəyirsinizsə əlavə edin.",
    brandName: "Brend adı",
    website: "Veb sayt",
    websiteHelp:
      "Yalnız tarama və SEO auditləri üçün lazımdır. Sosial, reklam və araşdırma onsuz da işləyir və onu sonra Parametrlərdən əlavə edə bilərsiniz. Buraxsanız, https:// avtomatik əlavə olunur.",
    summaryLabel: "Bu brend nə edir?",
    summaryHelp:
      "İş sahəsi konteksti kimi qeydə alınır ki, hesabatlar və agentlər eyni fonu paylaşsın.",
  },
  brand: {
    title: "Brend başqa harada yaşayır?",
    description:
      "Hər profil taramanıza qarşı yoxlanılır: hər hansı səhifə ona bağlantı verirmi və o, schema.org sameAs-də bəyan edilibmi. Bağlantısız profil axtarış sistemləri üçün görünməzdir.",
    label: "Etiket",
    profileUrl: "Profil URL-i",
    removeProfile: "Profil {number} sil",
    remove: "Sil",
    addProfile: "Başqa profil əlavə et",
  },
  competitors: {
    title: "Kimə qarşı ölçülürsünüz?",
    description:
      "Hər rəqib sizin saytınızla eyni limitlərlə taranır. Dərcetmə ritmi və kontent boşluqları onların səhifələrindən gəlir, ona görə provayder açarı lazım deyil.",
    domains: "Rəqib domenləri",
    domainsHelp:
      "Hər sətirdə bir. İlk ikisi açılış icrasında müqayisə edilir; qalanları iş sahəsi kontekstində saxlanılır.",
  },
  data: {
    title: "Məlumatlarınızı qoşun",
    description:
      "Bunların hər biri istəyə bağlıdır. Ötürsəniz, audit yenə işləyir — tapıntılar texniki ciddilik və əhatəyə görə sıralanır və mənbə tələb edən hər şey təxmin edilmək əvəzinə əlçatmaz kimi bildirilir.",
    storageTitle: "Bunlar harada saxlanılır",
    storageBody:
      "Etimadnamələr bu cihazdakı lokal etimadnamə anbarına gedir və heç vaxt hesabatlara, jurnallara və ya artefaktlara yazılmır.",
  },
  launch: {
    title: "İşə hazırdır",
    description:
      "Bazis audit, rəqib müqayisəsi və istəyə bağlı ictimai veb OSINT keçidi birlikdə növbəyə alınır.",
    brand: "Brend",
    unnamed: "Adsız",
    website: "Veb sayt",
    notSet: "Təyin edilməyib",
    brandProfiles: "Brend profilləri",
    noProfiles: "Yoxdur — brend mövcudluğu yoxlanılmayacaq",
    competitors: "Rəqiblər",
    noCompetitors: "Yoxdur — bazar kəşfiyyatı boş qalır",
    dataSources: "Məlumat mənbələri",
    providersConfigured: "{count} konfiqurasiya edilib",
    noProviders:
      "Yoxdur — tapıntılar yalnız ciddilik və əhatəyə görə sıralanır",
    osint: "İctimai veb OSINT",
    osintIncluded:
      "Daxildir — istinadlı ictimai siqnallar və təkrar keçid tarixçəsi",
    osintSkippedPrivate: "Ötürüldü — ictimai hədəf tələb olunur",
    osintSkippedChoice: "Öz seçiminizlə ötürüldü",
    integrationsDetected: "Aşkarlanmış inteqrasiyalar",
    integrationsAvailable: "{count} əlçatan",
    checking: "Yoxlanılır…",
    osintLabel: "İctimai veb OSINT dosyesini daxil et",
    osintHelp:
      "Tövsiyə olunur. Yalnız bu saytı və yuxarıdakı açıq rəqib URL-lərini istifadə edir — mənbə bağlantıları və əlçatanlıq vəziyyətləri ilə; insan axtarışı, autentifikasiyalı skreypinq və ya dark web toplaması yoxdur. Özəl və ya loopback rəqib URL-ləri istisna edilir.",
    osintOff:
      "{host} üçün OSINT sönülü qalır; o, ictimai hədəflərlə məhdudlaşır. Bazis yuxarıdakı özəl host icazəsi ilə yenə işləyə bilər.",
    privateTitle: "Bu icra özəl ünvanı hədəfləyir",
    privateBodyOne:
      "{hosts} özəl və ya loopback şəbəkədədir. Siz onları bu iş sahəsi üçün avtorizasiya etməyincə tarayıcı onlardan imtina edir.",
    privateBodyMany:
      "{hosts} özəl və ya loopback şəbəkədədir. Siz onları bu iş sahəsi üçün avtorizasiya etməyincə tarayıcı onlardan imtina edir.",
    allowOne:
      "Bu hostun taranmasına icazə ver. Yalnız məhz bu hostlar avtorizasiya olunur; özəl şəbəkənin qalanı bloklu qalır.",
    allowMany:
      "Bu hostların taranmasına icazə ver. Yalnız məhz bu hostlar avtorizasiya olunur; özəl şəbəkənin qalanı bloklu qalır.",
    startedTitle: "İcralar başladı",
    queuedJoiner: " və ",
    queued:
      "{runs} növbəyə alındı. Gedişat Auditlər bölməsində görünür; hər icra tamamlandıqca bu iş sahəsi dolur.",
  },
};

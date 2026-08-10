/** Guided setup: the seven-step onboarding checklist and its cards. */
import type { MessagesFor } from "../types";

export const onboarding: MessagesFor<"onboarding"> = {
  eyebrow: "Bələdçili quraşdırma",
  title: "İlk faydalı təhlilinizə çatın",
  description:
    "İş sahəsi yaradın, sübutu və nəticəni seçin, sonra təkrar izləməni aktivləşdirin. Veb sayt istəyə bağlıdır və taramanı və auditləri açır.",
  apiUnavailableTitle: "Lokal API əlçatan deyil",
  progressLabel: "Onbordinq gedişatı",
  progressSummary: "Addım {current} / {total}: {label}.",
  stepCompleted: "Tamamlanıb.",
  stepOptionalIncomplete: "İstəyə bağlı, tamamlanmayıb.",
  stepCurrent: "Cari addım.",
  stepIncomplete: "Tamamlanmayıb.",
  steps: {
    createWorkspace: {
      label: "İş sahəsi yaradın",
      description: "Bu iş sahəsinin aid olduğu brendi adlandırın.",
    },
    addWebsite: {
      label: "Veb sayt əlavə edin",
      description:
        "İstəyə bağlı. Yalnız tarama və SEO auditləri üçün tələb olunur.",
    },
    connectData: {
      label: "Məlumat qoşun",
      description: "Mənbə qoşun və ya yalnız tarama təhlilini seçin.",
    },
    chooseGoal: {
      label: "Məqsəd seçin",
      description: "Auditə hansı nəticənin indi önəmli olduğunu deyin.",
    },
    runBaseline: {
      label: "Bazis işlədin",
      description: "İlk texniki anlıq görüntünüzü yaradın.",
    },
    reviewActions: {
      label: "Tədbirlərə baxın",
      description: "Ən yüksək dəyərli növbəti addımı seçin.",
    },
    activateMonitoring: {
      label: "İzləməni aktivləşdirin",
      description: "Geriləmələr üçün təkrar auditləri qrafikə salın.",
    },
  },
  goals: {
    technicalHealth: {
      title: "Texniki sağlamlığı yaxşılaşdır",
      description:
        "İndekslənəbilirliyi, taranabilirliyi, performansı və geriləmələri prioritetləşdirin.",
    },
    qualifiedTraffic: {
      title: "Keyfiyyətli trafiki artır",
      description:
        "Ən güclü real potensiala malik səhifələri və sorğuları tapın.",
    },
    organicKeyEvents: {
      title: "Orqanik əsas hadisələri artır",
      description:
        "Tövsiyələri analitika və konversiya məruzluğu ilə çəkiləndirin.",
    },
    contentOpportunities: {
      title: "Kontent imkanlarını planlaşdır",
      description:
        "Mövzu boşluqlarını üzə çıxarın və tələbi sübuta əsaslanan plana çevirin.",
    },
  },
  loading: {
    kicker: "Lokal API yoxlanılır",
    title: "İş sahəniz yüklənir…",
    body: "Panel saytın artıq konfiqurasiya edilib-edilmədiyini təsdiqləyir.",
  },
  create: {
    kicker: "Addım 1 / 7",
    title: "İlk iş sahənizi yaradın",
    body: "İş sahəsi bu brendin kanallarını, araşdırmalarını və qeydlərini saxlayır. Veb sayt istəyə bağlıdır — yalnız tarama və SEO auditləri istəyirsinizsə əlavə edin.",
    notAddedTitle: "Sayt əlavə edilmədi",
    addedTitle: "Sayt əlavə edildi",
    addedBody:
      "Ən azı bir mənbə qoşaraq və ya yalnız tarama təhlilini seçərək davam edin.",
    nameLabel: "İş sahəsinin adı",
    urlLabel: "Kanonik URL",
    optional: "İstəyə bağlı",
    urlHelp:
      "Əvvəlcə sosial, reklam və araşdırma üzərində işləmək üçün boş buraxın. Veb saytı istənilən vaxt Parametrlərdən əlavə edə bilərsiniz.",
    creating: "İş sahəsi yaradılır…",
    submit: "İş sahəsi yarat",
  },
  workspace: {
    kicker: "Aktiv iş sahəsi",
    noWebsite: "Veb sayt yoxdur — tarama və auditlər sönülüdür.",
  },
  evidence: {
    kicker: "Addım 3 / 7",
    title: "Sübutunuzu seçin",
    body: "Komandanızın etibar etdiyi platformaları qoşun və ya tarama məlumatı ilə başlayıb inteqrasiyaları sonra əlavə edin. Çatışmayan mənbələr əminliyi azaldır; onlar heç vaxt saxta sıfırlara çevrilmir.",
    connectedIntegrations: "qoşulmuş inteqrasiya",
    crawlOnlyTitle: "Yalnız tarama təhlili seçildi",
    crawlOnlyBody:
      "Bazis indi işləyə bilər. Əminliyi və məruzluq qiymətləndirməsini yaxşılaşdırmaq üçün GSC və ya GA4-ü sonra qoşun.",
    manageIntegrations: "İnteqrasiyaları idarə et",
    crawlOnlyButton: "Yalnız tarama məlumatı ilə davam et",
  },
  goal: {
    kicker: "Addım 4 / 7",
    title: "İndi önəmli olan nəticəni seçin",
    body: "Seçilmiş məqsəd audit icrası ilə birlikdə saxlanılır ki, onun məramı tarixçədə və agent iş axınlarında açıq olsun.",
    groupLabel: "Əsas SEO məqsədi",
  },
  baseline: {
    kicker: "Addım 5 / 7",
    title: "Bazisi qurun",
    body: "Tam audit tədbirlərə URL səviyyəsində sübut verir və izləmə üçün istinad nöqtəsi yaradır.",
    needsWebsiteTitle: "Bu addım üçün veb sayt lazımdır",
    needsWebsiteBefore:
      "Bazis audit saytınızı tarayır. Bunu açmaq üçün veb saytı",
    needsWebsiteLink: "Parametrlər",
    needsWebsiteAfter:
      "bölməsində əlavə edin və ya irəli keçin — bu iş sahəsinin qalanı onsuz da işləyir.",
    chooseGoalTitle: "Əvvəlcə məqsəd seçin",
    chooseGoalBody: "Bazisi başlatmazdan əvvəl yuxarıdakı nəticəni seçin.",
    notStartedTitle: "Audit başlaya bilmədi",
    queuedTitle: "Audit növbəyə alındı",
    queuedBody:
      "İcranı audit tarixçəsindən izləyin. Tədbirlər yalnız tamamlanmış və ya qismən nəticə hazır olduqda açılır.",
    privateAccessSummary: "Özəl sayta giriş",
    privateAccessLabel:
      "Bu audit üçün məhz bu host adına özəl şəbəkəyə girişə icazə ver",
    privateAccessHelp:
      "Yalnız {host}. Siz bu hosta icazə verməyincə loopback və özəl ünvanlar bloklu qalır; bulud metadata həmişə bloklu qalır.",
    starting: "Audit başladılır…",
    run: "Bazis auditi işlət",
    viewHistory: "Audit tarixçəsinə bax",
  },
  firstMove: {
    kicker: "Addım 6 / 7",
    title: "İlk addımı seçin",
    body: "Resursları ayırmazdan əvvəl təsiri, əməyi, əminliyi və mənbə sübutunu müqayisə edin. Bu addım yalnız bazis tamamlanmış və ya qismən nəticə verdikdən sonra açılır.",
    reviewActions: "Prioritetləşdirilmiş tədbirlərə bax",
    lockedReason: "Tamamlanmış bazis icrası gözlənilir.",
  },
  monitoring: {
    kicker: "Addım 7 / 7",
    title: "Lokal izləməni aktivləşdirin",
    body: "Lokal saat qurşağınızda hər bazar ertəsi 06:00-da davamlı həftəlik audit yaradın. Ritmi İzləmə bölməsindən dəyişə bilərsiniz.",
    notActivatedTitle: "İzləmə aktivləşdirilmədi",
    activatedTitle: "İzləmə aktivləşdirildi",
    activatedBody:
      "Lokal arxa fon xidməti əlçatan olduğu müddətdə həftəlik qrafiki işlədəcək.",
    activeTitle: "İzləmə aktivdir",
    activeBody: "Ən azı bir aktiv qrafik bu mülkü qoruyur.",
    activating: "İzləmə aktivləşdirilir…",
    activate: "Həftəlik izləməni aktivləşdir",
    manage: "İzləməni idarə et",
    lockedReason:
      "İzləməni aktivləşdirməzdən əvvəl bazisi tamamlayın və prioritetləşdirilmiş tədbirləri açın.",
  },
};

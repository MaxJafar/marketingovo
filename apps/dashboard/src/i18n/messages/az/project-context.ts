/** Project context page: versioned profile, journal, and revision history. */
import type { MessagesFor } from "../types";

export const projectContext: MessagesFor<"projectContext"> = {
  eyebrow: "Təkrar istifadə edilə bilən strategiya yaddaşı",
  title: "Layihə konteksti",
  description:
    "Biznes məqsədlərini, auditoriyaları, bazarları, məhdudiyyətləri və qərarları tarama sübutunun yanında saxlayın ki, hər insan və agent eyni faktlardan başlasın.",
  revisionSavedTitle: "Kontekst reviziyası yadda saxlandı",
  revisionSavedBody: "Əvvəlki reviziya dəyişməz qalır və tarixçədə əlçatandır.",
  revisionNotSavedTitle: "Kontekst yadda saxlanmadı",
  journalAppendedTitle: "Jurnal qeydi əlavə edildi",
  journalAppendedBody:
    "Qeyd dəyişməzdir və artıq lokal agent resurslarına açıqdır.",
  journalNotAppendedTitle: "Jurnal qeydi əlavə edilmədi",
  revisionLabel: "Reviziya {revision}",
  profile: {
    eyebrow: "Versiyalanmış profil",
    createFirstRevision: "İlk reviziyanı yarat",
    savedAt: "{date} tarixində yadda saxlanıb",
    summaryLabel: "Biznes və axtarış xülasəsi",
    summaryPlaceholder:
      "Biznes nə təklif edir, kimə, və orqanik axtarış indi nəyə nail olmalıdır?",
    oneItemPerLine: "Hər sətirdə bir element.",
    changeSummaryLabel: "Reviziya xülasəsi",
    changeSummaryPlaceholder:
      "Böyük Britaniya bazarı əlavə edildi və demo konversiyası dəqiqləşdirildi",
    changeSummaryHelp:
      "Nəyin dəyişdiyini izah edin. Yadda saxlama həmişə yeni dəyişməz reviziya yaradır.",
    saving: "Reviziya yadda saxlanılır…",
    save: "Yeni reviziyanı yadda saxla",
  },
  profileLists: {
    audiences: {
      label: "Prioritet auditoriyalar",
      help: "Bu saytı kim tapmalı, ona etibar etməli və hərəkətə keçməlidir?",
      placeholder: "Texniki SEO rəhbərləri\nB2B artım komandaları",
    },
    markets: {
      label: "Bazarlar",
      help: "Niyyəti dəyişən ölkələr, regionlar və ya kommersiya seqmentləri.",
      placeholder: "Azərbaycan\nTürkiyə",
    },
    languages: {
      label: "Dillər",
      help: "Komandanızın tanıdığı etiketləri işlədin; lazım olduqda lokalı da göstərin.",
      placeholder: "Azərbaycanca (az-AZ)\nİngiliscə (en-US)",
    },
    conversionGoals: {
      label: "Konversiya məqsədləri",
      help: "Orqanik işi dəyərli edən hadisələri adlandırın.",
      placeholder: "Keyfiyyətli demo sorğusu\nSınaq aktivləşdirməsi",
    },
    priorityTopics: {
      label: "Prioritet mövzular",
      help: "Cari strategiyanın dəstəkləməli olduğu məhsullar, problemlər və ya mövzular.",
      placeholder: "Texniki SEO avtomatlaşdırması\nLokal-öncəlikli analitika",
    },
    competitors: {
      label: "Bilinən rəqiblər",
      help: "Ədalətli, açıq müqayisə üçün istifadə edilən brendlər və ya domenlər.",
      placeholder: "example-competitor.com\nAlternativ kateqoriya lideri",
    },
    constraints: {
      label: "Məhdudiyyətlər və qoruyucular",
      help: "Hüquqi, brend, platforma, miqrasiya və ya resurs limitləri.",
      placeholder:
        "Ödəniş URL-lərini dəyişməyin\nİddialar üçün hüquqi baxış tələb olunur",
    },
  },
  journalKinds: {
    observation: "Müşahidə",
    decision: "Qərar",
    constraint: "Məhdudiyyət",
    experiment: "Eksperiment",
  },
  journalForm: {
    eyebrow: "Yalnız əlavə olunan jurnal",
    heading: "Strategiyanı nəyin dəyişdiyini qeyd edin",
    kindLabel: "Qeyd növü",
    sourceLabel: "Mənbə audit (istəyə bağlı)",
    noLinkedAudit: "Bağlı audit yoxdur",
    titleLabel: "Qeyd başlığı",
    titlePlaceholder:
      "Böyük Britaniya müqayisə səhifələri keyfiyyətli demolara konversiya edir",
    detailLabel: "Sübut və nəticə",
    detailPlaceholder:
      "Nəyin müşahidə edildiyini və ya qərar verildiyini, niyə önəmli olduğunu və nəyin onu etibarsız edəcəyini bildirin.",
    appending: "Əlavə edilir…",
    append: "Jurnal qeydi əlavə et",
    immutableNote:
      "Qeydlər yerində redaktə edilə bilməz. Sübut dəyişdikdə sonrakı qərar əlavə edin.",
  },
  journalHistory: {
    heading: "Qərar jurnalı",
    description:
      "Ən yeni qeydlər birinci görünür; ardıcıllıq nömrələri heç vaxt dəyişmir.",
    sourceRun: "Mənbə icra: {id}",
    emptyTitle: "Hələ strategiya jurnalı yoxdur",
    emptyDescription:
      "Sübut komandanın necə hərəkət etməli olduğunu dəyişdikdə müşahidə, qərar, məhdudiyyət və ya eksperiment əlavə edin.",
  },
  revisionHistory: {
    heading: "Reviziya tarixçəsi",
    description: "Profil reviziyaları dəyişməzdir və ən yenisi birincidir.",
  },
};

/** Custom extraction rules card: editor, template library, safe live preview. */
import type { MessagesFor } from "../types";

export const extractionRules: MessagesFor<"extractionRules"> = {
  eyebrow: "Sübut konfiqurasiyası",
  title: "Xüsusi çıxarma qaydaları",
  description:
    "Hər auditdə qiymətləri, müəllifləri, məhsul ID-lərini, CMS işarələrini və ya istənilən başqa səhifə sahəsini tutun. Qaydalar bu layihəyə aiddir və hər yadda saxlanan reviziya təkrarlana bilən icra üçün əlçatan qalır.",
  currentRuleSet: "Cari qayda dəsti",
  revisionLabel: "Reviziya {revision}",
  loadingRules: "Çıxarma qaydaları yüklənir…",
  preparingEditor: "Çıxarma redaktoru hazırlanır…",
  rulesUnavailableTitle: "Çıxarma qaydaları əlçatan deyil",
  revisionSavedTitle: "Qayda reviziyası yadda saxlandı",
  revisionSavedBody:
    "Yeni auditlər bu reviziyanın anlıq görüntüsünü götürəcək. Mövcud icralar və onların sübutu dəyişməz qalır.",
  revisionRejectedTitle: "Qayda reviziyası rədd edildi",
  captureOptions: {
    text: "Mətn məzmunu",
    html: "Daxili HTML",
    attribute: "Atribut",
  },
  template: {
    eyebrow: "Əvvəlcə-bax kitabxanası",
    title: "Çıxarma şablonları",
    description:
      "Hazırlanmış sübut paketindən başlayın, hər selektoru yoxlayın, sonra onu yadda saxlanmamış layihəyə əlavə edin. Şablonlar heç vaxt özbaşına reviziya yazmır və ya tarama başlatmır.",
    policyPill: "Baxış tələb olunur",
    loading: "Çıxarma şablonları yüklənir…",
    catalogUnavailableTitle: "Şablon kataloqu əlçatan deyil",
    gridLabel: "Şablonlar",
    review: "{name} şablonuna bax",
    fieldsCount: "{count} sahə",
    addedTitle: "Şablon layihəyə əlavə edildi",
    addedBody:
      "{name} sahələri aşağıda baxış və ya önizləmə üçün hazırdır. Reviziya xülasəsi verib Reviziya yadda saxla seçənə qədər heç nə saxlanılmır.",
    reviewEyebrow: "Layihə idxalına baxış",
    closeReview: "Baxışı bağla",
    previewOn: "Önizləmə ünvanı:",
    beforeSaving: "Yadda saxlamazdan əvvəl",
    beforeSavingBody:
      "Nümayəndəli bir URL-i önizləyin və bu sayta uyğun gəlməyən sahələri silin və ya adlandırın.",
    assumptionsLabel: "Yoxlanılmalı fərziyyələr",
    fieldsTable: "{name} sahələri",
    fieldColumn: "Sahə",
    selectorColumn: "CSS selektoru",
    captureColumn: "Tutma",
    attributeCapture: "Atribut: {attribute}",
    conflictTitle: "Sahə konfliktlərini həll edin",
    conflictBodyOne:
      "Mövcud layihə sahəsini adlandırın və ya silin: {labels}. Şablon etiketləri unikal qalmalıdır.",
    conflictBodyMany:
      "Mövcud layihə sahələrini adlandırın və ya silin: {labels}. Şablon etiketləri unikal qalmalıdır.",
    capacityTitle: "Qayda limiti aşıldı",
    capacityBody:
      "Bu paket 50 qaydalıq layihə sərhədini aşardı. İdxal etməzdən əvvəl layihə qaydalarını silin.",
    addFieldsOne: "{count} sahəni layihəyə əlavə et",
    addFieldsMany: "{count} sahəni layihəyə əlavə et",
    freshIdsNote:
      "Təzə qayda ID-ləri lokal yaradılır; kataloq ID-ləri heç vaxt istifadəçiyə məxsus konfiqurasiya kimi saxlanılmır.",
  },
  editor: {
    listLabel: "Çıxarma qaydaları",
    empty:
      "Hələ qayda yoxdur. Səhifəyə xas məlumatı auditə yararlı sübuta çevirmək üçün birini əlavə edin.",
    ruleLegend: "Qayda {number}",
    enabled: "Aktiv",
    removeRule: "Qayda {number} sil",
    remove: "Sil",
    fieldLabel: "Sahə etiketi",
    capture: "Tutma",
    cssSelector: "CSS selektoru",
    attributeName: "Atribut adı",
    regexLabel: "Təhlükəsiz regex filtri",
    regexOptional: "(istəyə bağlı)",
    regexHelp:
      "Mövcud olduqda 1-ci tutma qrupu saxlanılır. Geri istinadlar, ətrafa baxışlar və qeyri-müəyyən təkrarlar rədd edilir.",
    addRule: "Qayda əlavə et",
    revisionSummary: "Reviziya xülasəsi",
    savingRevision: "Reviziya yadda saxlanılır…",
    saveRevision: "Reviziya yadda saxla",
  },
  preview: {
    title: "Təhlükəsiz canlı önizləmə",
    description:
      "Layihənin dəqiq mənşəyində bir URL-i auditlərin işlətdiyi eyni yönləndirməyə həssas çıxış siyasəti ilə yükləyin. Layihə qaydaları önizləmə ilə heç vaxt yadda saxlanılmır.",
    failedTitle: "Önizləmə alınmadı",
    pageUrl: "Səhifə URL-i",
    rendering: "Render",
    renderOptions: {
      static: "Statik HTML",
      js: "JavaScript",
    },
    allowPrivateHost: "Məhz bu özəl hosta icazə ver",
    allowPrivateHostHelp:
      "Yalnız localhost və ya təsdiqlənmiş daxili sayt üçün tələb olunur. Bulud metadata ünvanları bloklu qalır.",
    renderingPreview: "Önizləmə render edilir…",
    previewDraft: "Layihəni önizlə",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} ms",
    finalUrl: "Son URL",
    resultsTable: "Çıxarma önizləmə nəticələri",
    fieldColumn: "Sahə",
    resultColumn: "Nəticə",
    noMatch: "Uyğunluq yoxdur",
    truncated: "Dəyər sübut sərhədində kəsilib.",
  },
};

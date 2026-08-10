/**
 * Campaign links and their QR codes: the builder, the live preview, stored
 * links, and the self-hosted redirect config. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const campaignLinks: MessagesFor<"campaignLinks"> = {
  verdictLabel: {
    comfortable: "etibarlı oxunur",
    tight: "sərhəddədir",
    unscannable: "oxunmayacaq",
  },
  placementOption: {
    screen: { label: "Ekran", hint: "Slaydlar, veb səhifə, video" },
    printHandheld: {
      label: "Əldə tutulan",
      hint: "Flayer, vizit kartı, qəbz",
    },
    printPoster: {
      label: "Poster",
      hint: "Uzaqdan oxunur, nadir hallarda toxunulur",
    },
    packaging: { label: "Qablaşdırma", hint: "Əyri, daşınmada cızılan" },
    outdoor: { label: "Açıq hava", hint: "Yağış, günəş, qismən örtülü" },
  },
  links: {
    heading: "Bağlantılar",
    qrAlt: "{label} üçün QR kodu",
    printedTag: "çap edilib",
    copied: "Kopyalandı",
    copyLink: "Bağlantını kopyala",
    svg: "SVG",
    png: "PNG",
    markPrinted: "Çap edilmiş kimi işarələ",
    delete: "Sil",
    noteOne: "{count} qeyd — bu yaradılan vaxtdan",
    noteMany: "{count} qeyd — bu yaradılan vaxtdan",
    empty:
      "Hələ bağlantı yoxdur. Burada yaradılan kodlar URL-i birbaşa kodlayır, ona görə heç nə onları həll etmir və onlar geri çağırıla və ya ölçülə bilməz.",
  },
  form: {
    heading: "Yeni kampaniya bağlantısı",
    mark: "kod mövcud olmazdan əvvəl yoxlanılır",
    intro:
      "QR kodu dəyişdirilməsi bahalı edilmiş URL-dir. Teqlər hələ düzəltmək heç nəyə başa gəlməyəndə burada yoxlanılır.",
    nameLabel: "Ad",
    nameHelp: "Sonradan tapmaq üçündür. Heç vaxt URL-də görünmür.",
    destinationLabel: "Təyinat",
    destinationHelp: "Teqsiz səhifə. Teqlər aşağıda əlavə edilir.",
    sourceLabel: "Mənbə",
    sourceHelp: "Haradan gəldi",
    mediumLabel: "Kanal",
    mediumHelp: "Necə gəldi",
    campaignLabel: "Kampaniya",
    campaignHelp: "Hansı kampaniya",
    normalizedBefore: "Konvensiyaya görə bu belə olur:",
    normalizedAfter: ".",
    useThat: "Bunu işlət",
    placementLabel: "Bu kod harada olacaq?",
    placementHelp:
      "Xəta korreksiyası səviyyəsini və minimum ölçünü müəyyən edir.",
    printedWidthLabel: "Çap eni (mm)",
    printedWidthHelp: "Hazır məhsulda faktiki nə qədər enli olacağı.",
    coloursSummary: "Rənglər və kənar boşluq",
    modulesLabel: "Modullar",
    backgroundLabel: "Fon",
    quietZoneLabel: "Sakit zona",
    quietZoneHelp: "Dörd standart minimumdur.",
  },
  preview: {
    heading: "Önizləmə",
    moduleSize: "Modul ölçüsü",
    readableFrom: "Oxunma məsafəsi",
    readableUpTo: "{distance} sm-ə qədər",
    contrast: "Kontrast",
    symbol: "Simvol",
    symbolSpec: "versiya {version}, {count}×{count} modul, səviyyə {level}",
    blockingHeading: "Bunlar yadda saxlamağa mane olur",
    blockingBody:
      "Bu məhsulda hər şey problemi qeyd edib davam edir. Bunlar etmir, çünki çap edilmiş kodun ikinci cəhdi yoxdur.",
    advisoryHeading: "Bilməyə dəyər",
    saveFailed: "Bağlantı yadda saxlanıla bilmədi.",
    saving: "Yadda saxlanılır…",
    saveLink: "Bu bağlantını yadda saxla",
    nameFirst: "Əvvəlcə ona ad verin.",
  },
  redirect: {
    heading: "Sonradan yenidən yönləndirə biləcəyiniz kodlar",
    body: "QR kodunun vaxtı bitə və ya dəyişə bilməz — modullar təyinatı kodlayır. “Dinamik” kod satan məhsullar öz domenlərində yönləndirmə satır — elə buna görə də onu həll etməyi dayandıra bilirlər. Yönləndirməni artıq sahib olduğunuz domenə qoyun — eyni imkan heç nəyə başa gəlmir və heç kimə hesabat vermir.",
    platformLabel: "Platforma",
    cannotExpire: "özbaşına bitə bilməz",
    shortDomainLabel: "Qısa domeniniz",
    endsOnLabel: "Bitmə tarixi",
    expiryNote:
      "{platform} tarixi yoxlaya bilmir. Bitmə şərh kimi yazılır və faylı nəsə redaktə etməlidir.",
    building: "Qurulur…",
    buildConfig: "Konfiqurasiyanı qur",
    copy: "Kopyala",
  },
};

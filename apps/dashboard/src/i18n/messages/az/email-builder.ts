/** The email builder: brand kit, templates, compiler report, and preview. */
import type { MessagesFor } from "../types";

export const emailBuilder: MessagesFor<"emailBuilder"> = {
  report: {
    title: "E-poçt müştəriləri bununla nə edəcək",
    okSummary:
      "Bloklayan və ya sınmış heç nə yoxdur. {size}KB kompilyasiya edildi",
    okNoWarnings: ".",
    okWarningSingular: ", oxumağa dəyər {count} xəbərdarlıqla.",
    okWarningPlural: ", oxumağa dəyər {count} xəbərdarlıqla.",
    blockingRemoved:
      "Göndərdiyinizdən {count} element silindi, ona görə əlinizdəki sənəd yazdığınız deyil. ",
    errorSingular:
      "{count} xəta ən azı bir e-poçt müştərisində görünəcək şəkildə sınacaq.",
    errorPlural:
      "{count} xəta ən azı bir e-poçt müştərisində görünəcək şəkildə sınacaq.",
  },
  brandKit: {
    title: "Brend dəsti",
    revisionMark: "reviziya {revision}",
    notSetUp: "qurulmayıb",
    intro:
      "Agentin e-poçtları nəyə əsasən yazdığı və kompilyatorun nəticəni nəyə görə yoxladığı budur. Poçt ünvanı və abunəlikdən çıxma teqi üslub deyil: kommersiya e-poçtu qanunla hər ikisini daşımalıdır.",
    colours: "Rənglər",
    colourNameLabel: "Rəng {number} adı",
    colourValueLabel: "Rəng {number} dəyəri",
    noStatedUse: "təyinatı göstərilməyib",
    type: "Şrift",
    fontStackLabel: "{role} şrift yığını",
    fontStackHelp:
      "Hər yığını ümumi ailə ilə bitirin. Outlook və Gmail-in mobil tətbiqləri veb şriftləri nəzərə almır və geri dönmə olmadıqda öz standartını seçir.",
    legalFooter: "Hüquqi alt yazı",
    companyName: "Şirkət adı",
    postalAddress: "Poçt ünvanı",
    unsubscribeLabel: "Abunəlikdən çıxma birləşdirmə teqi",
    unsubHelpBefore:
      "Abunəlikdən çıxma teqi e-poçt xidmətinizin əvəzlədiyi dəyərdir — Mailchimp",
    unsubHelpMiddle: "işlədir, əksər digərləri isə",
    unsubHelpAfter:
      "formasından istifadə edir. Olduğu kimi saxlanılır, çünki onu təxmin etmək qanunla tələb olunan yerdə ölü keçid yaradır.",
    voice: "Səs tonu",
    voicePlaceholder:
      "Brend necə səslənir. Mətni yazan agent tərəfindən oxunur.",
    voiceLabel: "Brend səsi",
    changeSummaryPlaceholder: "Nə dəyişdi və niyə",
    changeSummaryLabel: "Dəyişiklik xülasəsi",
    saveRevision: "Reviziya yadda saxla",
    revisionNote:
      "Hər yadda saxlama reviziya əlavə edir. Keçən rüb qurulan e-poçt hansı brendə əsasən qurulduğunu hələ də deyə bilir.",
  },
  templates: {
    title: "Şablonlar",
    newNameLabel: "Yeni şablon adı",
    create: "Yarat",
    empty:
      "Hələ şablon yoxdur. Birini yaradın, sonra HTML-i burada yazın və ya qoşulmuş agentdən brend dəstinizə əsasən hazırlamasını istəyin.",
    noRevisions: "hələ reviziya yoxdur",
    revisionMeta: "reviziya {revision} · {time} yenilənib",
  },
  compose: {
    title: "Tərtib et",
    starterTitle:
      "Brend dəstinizdən artıq qurulmuş və hər yoxlamadan keçən cədvəl əsaslı sənəd.",
    starter: "Brend dəstindən başla",
    checking: "Yoxlanılır…",
    check: "Yoxla",
    saveRevision: "Reviziya yadda saxla",
    subject: "Mövzu",
    preheaderPlaceholder:
      "Preheader — poçt qutusunun mövzudan sonra göstərdiyi sətir",
    preheaderLabel: "Preheader",
    emailHtml: "E-poçt HTML-i",
    compileFailed: "E-poçt kompilyasiya edilə bilmədi.",
  },
  preview: {
    title: "Önizləmə",
    desktop: "Masaüstü",
    mobile: "Mobil",
    frameTitle: "E-poçt önizləməsi",
    compiledSummary: "Kompilyasiya edilmiş HTML — ixrac etdiyiniz budur",
    plainTextSummary: "Sadə mətn alternativi",
    exportNote:
      "Marketingovo e-poçt göndərmir. Kompilyasiya edilmiş HTML-i siyahınıza, razılıq qeydlərinizə və abunəlikdən çıxma emalınıza artıq sahib olan öz e-poçt xidmətinizə köçürün.",
  },
};

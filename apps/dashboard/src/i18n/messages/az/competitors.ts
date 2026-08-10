/** Competitors: the comparison workflow and crawl-evidence cards. */
import type { MessagesFor } from "../types";

export const competitors: MessagesFor<"competitors"> = {
  eyebrow: "Bazar konteksti",
  title: "Rəqiblər",
  description:
    "Tarama sübutu, dərcetmə ritmi və kontent boşluqları — hamısı hər rəqibin öz saytından toplanır, provayder açarı tələb olunmur. Açar söz səviyyəsində boşluqlar dəstəkləyən provayder onları təqdim edənə qədər açıq şəkildə əlçatmaz qalır.",
  form: {
    title: "Təkrarlana bilən müqayisə işlədin",
    description:
      "Bir və ya iki rəqib domeni daxil edin. Hər sayt eyni limitlərlə taranır; bu görünüş uydurulmuş görünürlük məlumatını deyil, texniki sübutu bildirir.",
    domainsLabel: "Rəqib domenləri",
    starting: "Başladılır…",
    submit: "Saytları müqayisə et",
  },
  notStartedTitle: "Müqayisə başlaya bilmədi",
  queuedTitle: "Müqayisə növbəyə alındı",
  queuedBody:
    "Davamlı icra Auditlər bölməsində görünür. Bu səhifə ən son tamamlanmış müqayisəni göstərəcək.",
  card: {
    updated: "{date} tarixində yenilənib",
    publishesEvery: "Dərcetmə tezliyi:",
    cadenceDays: "{count} gündən bir",
    cadenceUnavailableHint:
      "Lent tapılmadı və ya lentdə intervalı ölçmək üçün çox az tarixli yazı var idi.",
    lastPublished: "Son dərc",
    daysAgo: "{count} gün əvvəl",
    technicalHealth: "Texniki sağlamlıq",
    change: "Dəyişiklik",
    changeUnavailableHint:
      "Bu saytı əhatə edən əvvəlki müqayisə yoxdur, ona görə də hərəkət ediləcək bazis yoxdur.",
    noChange: "Dəyişiklik yoxdur",
    changePts: "{value} bal",
    sharedKeywords: "Ortaq açar sözlər",
    keywordGaps: "Açar söz boşluqları",
    coversGapTopics: "Boşluq mövzularını əhatə edir",
  },
  emptyTitle: "Rəqib konfiqurasiya edilməyib",
  emptyBody:
    "Bazar kontekstini açmaq üçün API və ya quraşdırma axını vasitəsilə rəqib domenləri əlavə edin.",
  gaps: {
    title: "Onların əhatə etdiyi, sizin etmədiyiniz mövzular",
    description:
      "Səhifələrin özündən çıxarılır, ona görə də açar söz provayderi tələb olunmur. Hər termin rəqib səhifələrində sizin saytınızdakından xeyli yüksək sıxlıqla görünür.",
    coverageOne: "müqayisə edilən {total} saytdan {covering} saytında",
    coverageMany: "müqayisə edilən {total} saytdan {covering} saytında",
  },
};

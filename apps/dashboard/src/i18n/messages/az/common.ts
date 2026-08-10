/** Shared primitives: formatters, query states, capability gates, freshness. */
import type { MessagesFor } from "../types";

export const common: MessagesFor<"common"> = {
  unavailable: "Əlçatan deyil",
  noComparison: "Müqayisə mövcud deyil",
  vsPriorPeriod: "əvvəlki dövrə nisbətən {change}%",
  createWorkspaceTitle: "Başlamaq üçün iş sahəsi yaradın",
  createWorkspaceBody:
    "İş sahəsi kanallarınızı, araşdırmalarınızı və qeydlərinizi saxlayır. Başlamaq üçün birini yaradın — veb saytı sonra əlavə edə bilərsiniz, ya da heç etməyə bilərsiniz.",
  loadingLabel: "Məlumat yüklənir",
  errorTitle: "Məlumat əlçatan deyil",
  errorFallback: "API bu iş sahəsini qaytarmadı.",
  errorHint:
    "Heç bir dəyər sıfırla əvəz edilməyib. Lokal API-ni və inteqrasiya sağlamlığını yoxlayın.",
  tryAgain: "Yenidən cəhd et",
  gateTitle: "Bunun üçün daha bir şey lazımdır",
  gateHint:
    "Bu iş sahəsindəki hər şey işləməyə davam edir. Burada heç nə yer tutucu ilə doldurulmayıb.",
  freshness: {
    stale:
      "Bu görünüş mövcud olan ən son anlıq görüntüdən istifadə edir. Son dəyişikliklər daxil olmaya bilər.",
    missing: "Bir və ya bir neçə mənbə bu görünüş üçün məlumat verməyib.",
    unavailable: "Bir və ya bir neçə mənbəyə çatmaq mümkün olmadı.",
    unknown: "API bu cavab üçün təzəlik zəmanəti təqdim etmədi.",
    fresh: "Cavaba mənbə xəbərdarlıqları daxildir.",
  },
  snapshot: "Anlıq görüntü: {time}",
  invalidSessionResponse: "Lokal xidmət etibarsız sessiya cavabı qaytardı.",
  importTooLarge: ".marketingovo faylı 25 MiB və ya daha kiçik olmalıdır.",
  importWrongExtension: ".marketingovo uzantılı fayl seçin.",
  serviceUnreachable: "Lokal xidmətə çatmaq mümkün deyil.",
  messageNotSent: "Bu mesaj göndərilmədi.",
  trendUnavailable: "Trend əlçatan deyil",
  trendEmptyBody:
    "Etibarlı trend çəkmək üçün ən azı iki tarixli ölçmə lazımdır.",
  historicalSignal: "Tarixi siqnal",
  observations: "{count} müşahidə",
  trendRange: "{title}, {min} ilə {max} arasında",
};

/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
import type { MessagesFor } from "../types";

export const backlinks: MessagesFor<"backlinks"> = {
  internalTitle: "Daxili bağlantı qrafı",
  lookingForAudit: "Tamamlanmış audit axtarılır…",
  latestAuditBody:
    "Ən son audit saytdakı hər daxili bağlantını xəritələdi. İstənilən səhifənin daxil olan və çıxan bağlantılarını izləmək üçün onun tədqiqatçısını açın.",
  openExplorer: "Bağlantı tədqiqatçısını aç →",
  noAuditYet:
    "Hələ tamamlanmış audit yoxdur. Birini işlədin və daxili bağlantı qrafı burada görünəcək.",
  openAudits: "auditləri aç",
  externalTitle: "Xarici geri bağlantılar",
  externalBody:
    "Marketingovo sizin saytınızı tarayır, vebin qalan hissəsini yox, ona görə də istinad edən domenləri özbaşına ölçə bilməz. Burada göstəriləcək geri bağlantı rəqəmi yoxdur və heç biri təxmin edilmir.",
  agentBodyBefore:
    "Qoşulmuş agent bunu öz alətləri ilə araşdıra bilər. Aşağıdakı terminalda ondan soruşun — məsələn",
  agentExample: "bu rübdə qiymət səhifəmizə hansı saytlar bağlantı verib",
  agentBodyAfter: ".",
};

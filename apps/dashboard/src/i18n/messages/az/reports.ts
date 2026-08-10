/** The reports library: exportable snapshots and their download formats. */
import type { MessagesFor } from "../types";

export const reports: MessagesFor<"reports"> = {
  eyebrow: "Nəticələri paylaşın",
  title: "Hesabatlar",
  description:
    "İxrac edilə bilən anlıq görüntülər və planlaşdırılmış performans xülasələri ilə maraqlı tərəfləri eyni səhifədə saxlayın.",
  typeFallback: "SEO hesabatı",
  generated: "{date} tarixində yaradılıb",
  scheduledFor: "{date} üçün planlaşdırılıb",
  scheduleUnavailable: "Qrafik əlçatan deyil",
  recipients: "Alıcılar: {list}",
  downloadGroupLabel: "{name} hesabatını endir",
  downloadFormatLabel: "{format} formatında hesabatı endir: {name}",
  downloadUnavailable: "Endirmə əlçatan deyil",
  emptyTitle: "Hələ hesabat yoxdur",
  emptyDescription:
    "Bazis məlumatlarınız hazır olduqda API vasitəsilə hesabat yaradın və ya qrafik qurun.",
};

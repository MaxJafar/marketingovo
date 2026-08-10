/** The local runtime page: overall status, uptime, and component checks. */
import type { MessagesFor } from "../types";

export const systemHealth: MessagesFor<"systemHealth"> = {
  eyebrow: "Lokal işləmə mühiti",
  title: "Sistem sağlamlığı",
  description:
    "Hesabat anlıq görüntüsünə etibar etməzdən əvvəl panel API-sini, yaddaşı, işçi prosesləri və xarici konnektorları yoxlayın.",
  overallStatus: "Ümumi status",
  statusHealthy: "Bütün bildirilən sistemlər işləkdir",
  statusDegraded: "Bəzi xidmətlər diqqət tələb edir",
  statusOffline: "Lokal API nasazlıq bildirir",
  statusUnknown: "Status naməlumdur",
  version: "Versiya",
  uptime: "İşləmə müddəti",
  uptimeDaysHours: "{days}g {hours}s",
  uptimeHours: "{hours}s",
  checked: "Yoxlanılıb",
  latency: "Gecikmə",
  latencyValue: "{value} ms",
  emptyTitle: "Komponent yoxlaması yoxdur",
  emptyDescription:
    "API ümumi sağlamlığı qaytardı, lakin komponent səviyyəsində yoxlama vermədi.",
};

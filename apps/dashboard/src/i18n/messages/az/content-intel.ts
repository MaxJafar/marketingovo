/** Content intel: measured gaps against competitors, and topic clusters. */
import type { MessagesFor } from "../types";

export const contentIntel: MessagesFor<"contentIntel"> = {
  gaps: {
    title: "Kontent boşluqları",
    loading: "Müqayisə oxunur…",
    empty:
      "Hələ kontent boşluğu qeydə alınmayıb. Bunu doldurmaq üçün rəqiblər əlavə edin və müqayisə işlədin.",
    emptyLink: "rəqibləri aç",
    coveredSingular: "{count} istinadla əhatə olunub",
    coveredPlural: "{count} istinadla əhatə olunub",
    density: "sıxlıq {value}",
    tag: "Boşluq",
  },
  clusters: {
    title: "Mövzu klasterləri",
    loading: "Açar söz iş sahəsi oxunur…",
    empty:
      "Hələ klaster yoxdur. Açar söz laboratoriyasından kontent planı işlədin.",
    emptyLink: "açar söz laboratoriyasını aç",
    cluster: "Klaster",
    keywords: "Açar sözlər",
    coverage: "Əhatə",
  },
};

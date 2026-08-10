/** Content intel: measured gaps against competitors, and topic clusters. */
import type { MessagesFor } from "../types";

export const contentIntel: MessagesFor<"contentIntel"> = {
  gaps: {
    title: "Brechas de contenido",
    loading: "Leyendo la comparación…",
    empty:
      "Aún no hay brechas de contenido registradas. Añade competidores y ejecuta una comparación para poblar esto.",
    emptyLink: "abrir competidores",
    coveredSingular: "cubierto por {count} referencia",
    coveredPlural: "cubierto por {count} referencias",
    density: "densidad {value}",
    tag: "Brecha",
  },
  clusters: {
    title: "Clústeres temáticos",
    loading: "Leyendo el espacio de palabras clave…",
    empty:
      "Aún no hay clústeres. Ejecuta un plan de contenido desde el lab de palabras clave.",
    emptyLink: "abrir el lab de palabras clave",
    cluster: "Clúster",
    keywords: "Palabras clave",
    coverage: "Cobertura",
  },
} as const;

/** URL inventory: the crawled pages table and its indexability evidence. */
import type { MessagesFor } from "../types";

export const pages: MessagesFor<"pages"> = {
  eyebrow: "Inventario de URLs",
  title: "Páginas",
  description:
    "Conecta la evidencia técnica del rastreo con el tráfico orgánico y el contexto de conversión a nivel de URL.",
  columns: {
    page: "Página",
    http: "HTTP",
    indexability: "Indexabilidad",
    clicks: "Clics",
    internalLinks: "Enlaces internos",
    organicKeyEvents: "Eventos clave orgánicos",
    issues: "Problemas",
    coreWebVitals: "Core Web Vitals",
    lastCrawled: "Último rastreo",
  },
  linkCounts: "{inCount} entrantes · {outCount} salientes",
  linkDepth: "Profundidad {depth} · páginas distintas",
  explore: "Explorar",
  exploreLinksFor: "Explorar los enlaces internos de {page}",
  searchLabel: "Buscar páginas",
  searchPlaceholder: "Buscar por título o URL",
  tableLabel: "Páginas rastreadas",
  noMatchTitle: "Ninguna página coincide",
  noMatchBody: "Prueba una búsqueda más amplia de título o URL.",
  emptyTitle: "Sin páginas rastreadas",
  emptyBody:
    "La API devolvió un inventario de páginas vacío. Ejecuta una auditoría para recopilar evidencia a nivel de URL.",
  indexability: {
    reasons: {
      indexable: "Verificado a partir de la evidencia del rastreo",
      robotsBlocked: "Bloqueada por robots.txt",
      metaNoindex: "Meta robots noindex",
      xRobotsNoindex: "X-Robots-Tag noindex",
      canonicalized: "El canonical apunta a otra URL",
      nonHtml: "Respuesta no HTML",
      redirect: "Respuesta de redirección",
      httpError: "Respuesta de error HTTP",
      noContent: "Respuesta sin contenido",
      fetchError: "La obtención falló",
      missingStatus: "Estado HTTP no disponible",
      unexpectedStatus: "Estado HTTP inesperado",
      missingContentType: "Tipo de contenido no disponible",
      robotsUnknown: "Evidencia de robots no disponible",
      parseFailed: "Evidencia HTML no disponible",
    },
    evidenceUnavailable: "Evidencia no disponible",
    legacyResult: "Resultado de auditoría heredado",
  },
} as const;

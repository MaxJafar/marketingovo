/** The console home: hero banner, KPI stats, and the overview panels. */
import type { MessagesFor } from "../types";

export const dashboard: MessagesFor<"dashboard"> = {
  hero: {
    welcome: "bienvenido a",
    tagline: "tu terminal todo en uno de inteligencia de marketing",
    bubble: "los datos nunca duermen",
  },
  stats: {
    seoVisibility: "Visibilidad SEO",
    organicTraffic: "Tráfico orgánico",
    keyEvents: "Eventos clave",
    cwvPassRate: "Tasa de aprobación CWV",
    noTrendYet: "aún sin tendencia",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "sin cambios",
    runAuditToMeasure: "ejecuta una auditoría para medir",
    connectSearchConsole: "conecta Search Console",
    connectAnalytics: "conecta Analytics",
    runAuditWithVitals: "ejecuta una auditoría con vitals",
  },
  seoOverview: {
    title: "Resumen SEO",
    domainHealth: "Salud del dominio",
    empty:
      "Ninguna auditoría ha medido este sitio todavía, así que no hay puntuación de salud que dibujar — un número de relleno sería una invención.",
    runAudit: "Ejecutar una auditoría →",
    donutLabel: "Salud del dominio {value} de 100",
    crawlability: "Rastreabilidad",
    sitePerformance: "Rendimiento del sitio",
    onPageSeo: "SEO on-page",
    keyEvents: "Eventos clave",
  },
  crossChannel: {
    title: "Informe multicanal",
    body: "El documento para clientes que abarca pago, orgánico, social, email, competidores y trabajo completado — con gráficas dibujadas solo a partir de valores medidos, exportado como PDF y generado con una cadencia diaria, semanal o mensual.",
    openReport: "Abrir el informe →",
    scheduleIt: "Programarlo →",
  },
  topKeywords: {
    title: "Palabras clave principales",
    empty:
      "Aún no se ha ejecutado ninguna investigación de palabras clave para este espacio de trabajo.",
    openLab: "Abrir el lab de palabras clave →",
    keyword: "Palabra clave",
    position: "Pos.",
    volume: "Vol.",
    viewAll: "Ver todas las palabras clave →",
  },
  competitorInsights: {
    title: "Insights de competidores",
    empty:
      "Aún no se ha ejecutado ninguna comparación de competidores, así que no hay nada medido que clasificar.",
    research: "Investigar competidores →",
    domain: "Dominio",
    visibility: "Visibilidad",
    you: "tú ({name})",
    thisSite: "este sitio",
    viewAll: "Ver competidores →",
  },
  contentFeed: {
    title: "Feed de intel de contenido",
    empty:
      "Las brechas de contenido aparecen aquí cuando una comparación de competidores las mide.",
    open: "Abrir intel de contenido →",
    competitorsCovering: "◉ {count} competidores cubriéndolo",
    gapTag: "Brecha de contenido",
    viewFeed: "Ver el feed de contenido →",
  },
} as const;

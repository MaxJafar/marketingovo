/** The audit run page: replay, sitemap coverage, and the evidence workbench. */
import type { MessagesFor } from "../types";

export const auditDetail: MessagesFor<"auditDetail"> = {
  backToAudits: "Volver a auditorías",
  eyebrow: "Ejecución de auditoría",
  runTitle: "Ejecución {id}",
  fallbackTitle: "Detalles de la auditoría",
  description:
    "Inspecciona la cobertura de fuentes y la evidencia exacta, o reproduce la configuración guardada de la ejecución contra el estado actual del sitio.",
  queuingReplay: "Poniendo en cola la reproducción…",
  replayConfiguration: "Reproducir configuración",
  replayErrorTitle: "La reproducción no pudo iniciarse",
  replayQueuedTitle: "Reproducción independiente en cola",
  replayQueuedBefore:
    "La configuración guardada v{version} se copió sin cambiar esta ejecución. La reproducción lee el estado actual del sitio y de los proveedores.",
  replayQueuedLink: "Abrir reproducción",
  replayQueuedAfter: ".",
  boundaryTitle: "Límite de la reproducción",
  boundaryBody:
    "La reproducción crea una nueva ejecución a partir de este flujo guardado y sus opciones exactas. Nunca edita este resultado; las páginas e integraciones en vivo se consultan de nuevo para que los cambios sigan siendo medibles.",
  summary: {
    status: "Estado",
    started: "Iniciada",
    completed: "Completada",
    issueInstances: "Instancias de problemas",
  },
  breakdownTitle: "Desglose de problemas",
  breakdownEmptyTitle: "Desglose no disponible",
  breakdownEmptyBody: "La ejecución no devolvió totales por severidad.",
  runLogTitle: "Registro de ejecución",
  runLogEmptyTitle: "Sin entradas de registro",
  runLogEmptyBody: "La API no devolvió un registro de ejecución.",
  sitemap: {
    eyebrow: "Fuente capturada",
    title: "Cobertura del sitemap",
    description:
      "La cobertura compara las URLs indexables capturadas en el rastreo con la instantánea del sitemap usada por esta ejecución exacta.",
    declaredUrls: "URLs declaradas",
    indexableDiscovered: "Indexables descubiertas",
    matched: "Coincidentes",
    coverage: "Cobertura",
    snapshotBefore: "Instantánea:",
    httpStatusSuffix: " · HTTP {status}",
    filesLabel: "Archivos de sitemap capturados",
    fileColumn: "Archivo de sitemap",
    typeColumn: "Tipo",
    httpColumn: "HTTP",
    locationsColumn: "Ubicaciones",
    missingIndexable: "Indexable pero ausente",
    declaredNotCrawled: "Declarada pero no rastreada",
    brokenDeclared: "Errores HTTP declarados",
    sampleUnavailable:
      "No disponible porque no se capturó ninguna instantánea verificada del sitemap.",
    sampleTruncated:
      "Mostrando las primeras {shown} de {total} URLs. El informe JSON conserva la cohorte capturada completa.",
  },
  tabs: {
    crawl: {
      label: "Rutas de rastreo",
      description:
        "Ruta de descubrimiento capturada más corta y primer referente.",
    },
    redirects: {
      label: "Redirecciones",
      description:
        "URL solicitada, cada salto de redirección y la respuesta final.",
    },
    hreflang: {
      label: "Hreflang",
      description:
        "Objetivos de idioma, autorreferencias y evidencia recíproca.",
    },
    extractions: {
      label: "Extracciones",
      description:
        "Campos personalizados capturados por las reglas de extracción configuradas.",
    },
  },
  crawl: {
    tableLabel: "Evidencia de rutas de rastreo",
    pageColumn: "Página",
    depthColumn: "Profundidad",
    referrerColumn: "Primer referente",
    httpColumn: "HTTP",
    indexableColumn: "Indexable",
    seed: "Semilla",
  },
  redirects: {
    tableLabel: "Evidencia de rutas de redirección",
    requestedColumn: "URL solicitada",
    pathColumn: "Ruta capturada",
    hopsColumn: "Saltos",
    finalHttpColumn: "HTTP final",
  },
  hreflang: {
    tableLabel: "Matriz de evidencia hreflang",
    sourceColumn: "Página de origen",
    languageColumn: "Idioma HTML / propio",
    alternateColumn: "Alternativa",
    targetColumn: "Objetivo",
    reciprocalColumn: "Recíproco",
    missing: "Ausente",
    selfReference: "Autorreferencia",
    mismatch: "Se esperaba {expected}; se observó {observed}",
    sourceFallback: "origen",
    noneFallback: "ninguno",
  },
  extractions: {
    tableLabel: "Evidencia de extracción personalizada",
    pageColumn: "Página",
    fieldsColumn: "Campos capturados",
    noMatch: "Sin coincidencia",
    truncatedSuffix: " (truncado)",
  },
  workbench: {
    eyebrow: "Evidencia de auditoría versionada",
    title: "Mesa de evidencia",
    description:
      "La UI pagina la evidencia guardada; nunca trunca una cohorte sin mostrar el total.",
    tablistLabel: "Secciones de evidencia",
    searchLabel: "Buscar evidencia por URL o título de página",
    searchPlaceholder: "Buscar por URL o título de página",
    search: "Buscar",
    clear: "Limpiar",
    paginationLabel: "Páginas de evidencia",
    previous: "Anterior",
    next: "Siguiente",
    pageIndicator: "Página {page} de {pages} · {records} registros",
  },
  emptyTitle: "No se capturó {section}",
  emptyUnavailable:
    "Esta ejecución no contiene evidencia de páginas versionada. Ejecuta una nueva auditoría para poblar la mesa de trabajo.",
  emptyFiltered:
    "La ejecución seleccionada no tiene {section} coincidentes. Este es un estado vacío medido, no una consulta fallida.",
  fallbackEvidence: "evidencia",
  fallbackRecords: "registros",
} as const;

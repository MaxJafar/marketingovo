/** Custom extraction rules card: editor, template library, safe live preview. */
import type { MessagesFor } from "../types";

export const extractionRules: MessagesFor<"extractionRules"> = {
  eyebrow: "Configuración de evidencia",
  title: "Reglas de extracción personalizadas",
  description:
    "Captura precios, autores, IDs de producto, marcadores del CMS o cualquier otro campo de página en cada auditoría. Las reglas pertenecen a este proyecto y cada revisión guardada queda disponible para reproducir ejecuciones de forma reproducible.",
  currentRuleSet: "Conjunto de reglas actual",
  revisionLabel: "Revisión {revision}",
  loadingRules: "Cargando reglas de extracción…",
  preparingEditor: "Preparando el editor de extracción…",
  rulesUnavailableTitle: "Reglas de extracción no disponibles",
  revisionSavedTitle: "Revisión de reglas guardada",
  revisionSavedBody:
    "Las nuevas auditorías tomarán una instantánea de esta revisión. Las ejecuciones existentes y su evidencia permanecen sin cambios.",
  revisionRejectedTitle: "La revisión de reglas fue rechazada",
  captureOptions: {
    text: "Contenido de texto",
    html: "HTML interno",
    attribute: "Atributo",
  },
  template: {
    eyebrow: "Biblioteca de revisión previa",
    title: "Plantillas de extracción",
    description:
      "Parte de un paquete de evidencia curado, inspecciona cada selector y añádelo al borrador sin guardar. Las plantillas nunca escriben una revisión ni inician un rastreo por su cuenta.",
    policyPill: "Revisión requerida",
    loading: "Cargando plantillas de extracción…",
    catalogUnavailableTitle: "Catálogo de plantillas no disponible",
    gridLabel: "Plantillas",
    review: "Revisar {name}",
    fieldsCount: "{count} campos",
    addedTitle: "Plantilla añadida al borrador",
    addedBody:
      "Los campos de {name} están listos para revisar o previsualizar abajo. Nada se persiste hasta que aportes un resumen de revisión y elijas Guardar revisión.",
    reviewEyebrow: "Revisión de importación al borrador",
    closeReview: "Cerrar revisión",
    previewOn: "Previsualizar en",
    beforeSaving: "Antes de guardar",
    beforeSavingBody:
      "Previsualiza una URL representativa y elimina o renombra los campos que no encajen con este sitio.",
    assumptionsLabel: "Supuestos a verificar",
    fieldsTable: "Campos de {name}",
    fieldColumn: "Campo",
    selectorColumn: "Selector CSS",
    captureColumn: "Captura",
    attributeCapture: "Atributo: {attribute}",
    conflictTitle: "Resuelve los conflictos de campos",
    conflictBodyOne:
      "Renombra o elimina el campo existente del borrador: {labels}. Las etiquetas de plantilla deben seguir siendo únicas.",
    conflictBodyMany:
      "Renombra o elimina los campos existentes del borrador: {labels}. Las etiquetas de plantilla deben seguir siendo únicas.",
    capacityTitle: "Límite de reglas superado",
    capacityBody:
      "Este paquete superaría el límite de 50 reglas por proyecto. Elimina reglas del borrador antes de importarlo.",
    addFieldsOne: "Añadir {count} campo al borrador",
    addFieldsMany: "Añadir {count} campos al borrador",
    freshIdsNote:
      "Los IDs de regla nuevos se crean localmente; los IDs del catálogo nunca se persisten como si fueran configuración del usuario.",
  },
  editor: {
    listLabel: "Reglas de extracción",
    empty:
      "Aún no hay reglas. Añade una para convertir datos específicos de página en evidencia auditable.",
    ruleLegend: "Regla {number}",
    enabled: "Activada",
    removeRule: "Eliminar regla {number}",
    remove: "Eliminar",
    fieldLabel: "Etiqueta del campo",
    capture: "Captura",
    cssSelector: "Selector CSS",
    attributeName: "Nombre del atributo",
    regexLabel: "Filtro regex seguro",
    regexOptional: "(opcional)",
    regexHelp:
      "El grupo de captura 1 se conserva cuando está presente. Se rechazan las retrorreferencias, los lookarounds y la repetición ambigua.",
    addRule: "Añadir regla",
    revisionSummary: "Resumen de la revisión",
    savingRevision: "Guardando revisión…",
    saveRevision: "Guardar revisión",
  },
  preview: {
    title: "Previsualización en vivo segura",
    description:
      "Obtén una URL del origen exacto del proyecto a través de la misma política de salida consciente de redirecciones que usan las auditorías. Las reglas del borrador nunca se guardan al previsualizarlas.",
    failedTitle: "La previsualización falló",
    pageUrl: "URL de la página",
    rendering: "Renderizado",
    renderOptions: {
      static: "HTML estático",
      js: "JavaScript",
    },
    allowPrivateHost: "Permitir este host privado exacto",
    allowPrivateHostHelp:
      "Necesario solo para localhost o un sitio interno aprobado. Las direcciones de metadatos de la nube permanecen bloqueadas.",
    renderingPreview: "Renderizando previsualización…",
    previewDraft: "Previsualizar borrador",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} ms",
    finalUrl: "URL final",
    resultsTable: "Resultados de la previsualización de extracción",
    fieldColumn: "Campo",
    resultColumn: "Resultado",
    noMatch: "Sin coincidencia",
    truncated: "Valor truncado en el límite de evidencia.",
  },
} as const;

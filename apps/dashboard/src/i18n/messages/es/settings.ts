import type { MessagesFor } from "../types";

export const settings: MessagesFor<"settings"> = {
  eyebrow: "Configuración del espacio de trabajo",
  title: "Ajustes",
  description:
    "Actualiza la identidad del sitio y las preferencias de informes guardadas con este proyecto local.",
  languageTitle: "Idioma",
  languageDescription:
    "Idioma de la interfaz de esta consola en este dispositivo. Los datos, informes y superficies de agentes no se traducen.",
  languageLabel: "Idioma de la interfaz",
  savedTitle: "Ajustes guardados",
  savedBody:
    "La API local aceptó los ajustes actualizados del espacio de trabajo.",
  notSavedTitle: "Los ajustes no se guardaron",
  notExportedTitle: "El proyecto no se exportó",
  notImportedTitle: "El proyecto no se importó",
  importedTitle: "Proyecto importado",
  importedSummary:
    "Importadas {runs} ejecuciones, {actions} acciones, {contextVersions} revisiones de contexto, {contextEntries} entradas del diario, {extractionRuleVersions} revisiones de reglas de extracción y {artifacts} artefactos de informes. Las programaciones están desactivadas y {reconnect}.",
  reconnectList: "estas integraciones deben reconectarse: {providers}",
  reconnectNone: "no se requiere reconectar ninguna integración",
  notDeletedTitle: "El proyecto no se eliminó",
  deletedTitle: "Proyecto local eliminado",
  deletedSummary:
    "Eliminadas {runs} ejecuciones, {issueInstances} observaciones de problemas, {actions} acciones, {extractionRuleVersions} revisiones de reglas de extracción y {artifacts} artefactos. {cleanup} Las credenciales globales de integraciones se conservaron para otros proyectos.",
  cleanupComplete: "Limpieza del sistema de archivos completada.",
  cleanupScheduled:
    "La limpieza del sistema de archivos está programada para el próximo arranque del servicio.",
  siteIdentity: "Identidad del sitio",
  siteName: "Nombre del sitio",
  canonicalUrl: "URL canónica",
  reporting: "Informes",
  timezone: "Zona horaria",
  reportingCurrency: "Moneda de los informes",
  retentionTarget: "Objetivo de retención local (días)",
  reportPreferences: "Preferencias de informes",
  alertEmail: "Email de contacto para informes",
  alertEmailHelp:
    "Se guarda localmente como metadato de informes. Marketingovo no envía alertas de email alojadas.",
  weeklyDigest: "Preferencia de resumen semanal",
  weeklyDigestHelp:
    "Incluye prioridades, tendencias y regresiones semanales al generar informes de resumen.",
  saving: "Guardando…",
  save: "Guardar ajustes",
  portabilityTitle: "Portabilidad del proyecto",
  portabilityBodyBefore: "Exporta un paquete versionado",
  portabilityBodyAfter:
    "con historial de auditorías, acciones, métricas, revisiones del Contexto del proyecto, el diario del marketer, reglas personalizadas, ajustes de conectores y artefactos de informes acotados. Las credenciales, tokens, cookies, cabeceras y rutas de archivos locales nunca se incluyen.",
  exporting: "Exportando…",
  exportProject: "Exportar proyecto",
  importing: "Importando…",
  importProject: "Importar proyecto",
  importHelp:
    "Las importaciones siempre crean un proyecto local nuevo, remapean identificadores, conservan las huellas de problemas, el contexto, las reglas de extracción y la instantánea de configuración detrás de cada ejecución, desactivan las programaciones importadas y requieren reconectar las integraciones.",
  dangerZone: "Zona de peligro",
  deleteTitle: "Eliminar proyecto local",
  deleteBody1:
    "Elimina permanentemente de este dispositivo este proyecto, sus ejecuciones, la evidencia sin procesar, el historial de acciones, el Contexto del proyecto, las revisiones de reglas de extracción, las programaciones, los ajustes y los artefactos de informes. Exporta el proyecto primero si puedes volver a necesitarlo.",
  deleteBody2:
    "Las credenciales BYOK globales se conservan intencionalmente porque pueden servir a otros proyectos. Revócalas por separado desde Integraciones.",
  deleteProject: "Eliminar proyecto",
  confirmLabel: "Escribe el nombre del proyecto para confirmar",
  confirmHelpBefore: "Escribe",
  confirmHelpAfter: "exactamente. Esta acción no se puede deshacer.",
  cancel: "Cancelar",
  deleting: "Eliminando…",
  permanentlyDelete: "Eliminar proyecto permanentemente",
} as const;

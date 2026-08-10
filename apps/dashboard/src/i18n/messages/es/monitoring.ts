/** Monitoring page: the schedule editor, schedule list, and alert stream. */
import type { MessagesFor } from "../types";

export const monitoring: MessagesFor<"monitoring"> = {
  eyebrow: "Garantía continua",
  title: "Monitorización",
  description:
    "Programa auditorías locales y detecta regresiones antes de que se conviertan en sorpresas en los informes. Las programaciones se ejecutan mientras el servicio en segundo plano de Marketingovo está activo.",
  mutationErrorTitle: "El cambio de programación falló",
  editor: {
    editTitle: "Editar programación",
    createTitle: "Crear una programación",
    intro:
      "Ejecuta una auditoría del sitio o genera el informe multicanal con una cadencia pensada para marketers, o usa una expresión cron estándar de cinco campos.",
    cancelEdit: "Cancelar edición",
    workflowLabel: "Qué ejecutar",
    workflowAudit: "Auditoría del sitio",
    workflowReport: "Informe multicanal",
    workflowAsCreated: "{workflow} (como se creó)",
    frequencyLabel: "Frecuencia",
    frequencyDaily: "Diaria",
    frequencyWeekly: "Semanal",
    frequencyMonthly: "Mensual (día 1)",
    frequencyCustom: "Cron personalizado",
    cronLabel: "Expresión cron",
    timeLabel: "Hora local",
    dayLabel: "Día",
    timezoneLabel: "Zona horaria",
    reportNoticeTitle: "Los informes citan auditorías",
    reportNoticeBody:
      "Un informe solo cita una auditoría ejecutada dentro de su propio periodo. Empareja la programación del informe con una de auditoría, o su sección orgánica dirá que no se midió.",
    saving: "Guardando…",
    save: "Guardar programación",
    create: "Crear programación",
  },
  weekdays: {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo",
  },
  cadenceMonthly: "Mensual el día 1 a las {time}",
  cadenceDaily: "Diaria a las {time}",
  cadenceWeekly: "Cada {weekday} a las {time}",
  cadenceDayFallback: "día {day}",
  schedules: {
    title: "Programaciones",
    description: "Programaciones de auditoría duraderas para este proyecto.",
    pauseAria: "Pausar la programación {name}",
    enableAria: "Activar la programación {name}",
    timezoneUnavailable: "Zona horaria no disponible",
    nextRun: "Próxima: {date}",
    edit: "Editar",
    delete: "Eliminar",
    deleteConfirm: "¿Eliminar la programación {name}?",
    emptyTitle: "Sin programaciones",
    emptyDescription:
      "Crea una programación arriba para ejecutar auditorías periódicas mientras el servicio en segundo plano está activo.",
  },
  alerts: {
    title: "Alertas recientes",
    description: "Cambios abiertos y reconocidos que necesitan revisión.",
    noDetail: "No se devolvió ningún detalle adicional.",
    status: "Estado: {status}",
    emptyTitle: "Sin alertas de monitorización",
    emptyDescription:
      "Un flujo de alertas vacío y válido significa que no se devolvieron alertas — no que todas las fuentes estén sanas.",
  },
} as const;

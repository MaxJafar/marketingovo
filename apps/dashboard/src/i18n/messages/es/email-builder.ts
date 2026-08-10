/** The email builder: brand kit, templates, compiler report, and preview. */
import type { MessagesFor } from "../types";

export const emailBuilder: MessagesFor<"emailBuilder"> = {
  report: {
    title: "Qué harán los clientes de correo con él",
    okSummary: "Nada bloqueante ni roto. {size}KB compilados",
    okNoWarnings: ".",
    okWarningSingular: ", con {count} advertencia que vale la pena leer.",
    okWarningPlural: ", con {count} advertencias que vale la pena leer.",
    blockingRemoved:
      "{count} elemento(s) se eliminaron de lo que enviaste, así que el documento que tienes no es el que escribiste. ",
    errorSingular:
      "{count} error se romperá visiblemente en al menos un cliente.",
    errorPlural:
      "{count} errores se romperán visiblemente en al menos un cliente.",
  },
  brandKit: {
    title: "Kit de marca",
    revisionMark: "revisión {revision}",
    notSetUp: "sin configurar",
    intro:
      "Contra lo que un agente escribe los emails, y contra lo que el compilador comprueba el resultado. La dirección postal y la etiqueta de baja no son estilo: el correo comercial está legalmente obligado a llevar ambas.",
    colours: "Colores",
    colourNameLabel: "Nombre del color {number}",
    colourValueLabel: "Valor del color {number}",
    noStatedUse: "sin uso declarado",
    type: "Tipografía",
    fontStackLabel: "Pila de fuentes de {role}",
    fontStackHelp:
      "Termina cada pila con una familia genérica. Outlook y las apps móviles de Gmail ignoran las fuentes web, y sin nada a lo que recurrir eligen su propio valor por defecto.",
    legalFooter: "Pie legal",
    companyName: "Nombre de la empresa",
    postalAddress: "Dirección postal",
    unsubscribeLabel: "Etiqueta de combinación de baja",
    unsubHelpBefore:
      "La etiqueta de baja es lo que tu servicio de email sustituya — Mailchimp usa",
    unsubHelpMiddle: ", la mayoría de los demás usan una forma del tipo",
    unsubHelpAfter:
      ". Se guarda tal cual, porque adivinarla produce un enlace muerto en un lugar legalmente obligatorio.",
    voice: "Voz",
    voicePlaceholder:
      "Cómo suena la marca. Lo lee el agente que escribe el copy.",
    voiceLabel: "Voz de la marca",
    changeSummaryPlaceholder: "Qué cambió, y por qué",
    changeSummaryLabel: "Resumen del cambio",
    saveRevision: "Guardar una revisión",
    revisionNote:
      "Cada guardado añade una revisión. Un email construido el trimestre pasado aún puede decir contra qué marca se construyó.",
  },
  templates: {
    title: "Plantillas",
    newNameLabel: "Nombre de la nueva plantilla",
    create: "Crear",
    empty:
      "Aún no hay plantillas. Crea una y luego escribe el HTML aquí o pide a un agente conectado que lo redacte contra tu kit de marca.",
    noRevisions: "aún sin revisiones",
    revisionMeta: "revisión {revision} · actualizada {time}",
  },
  compose: {
    title: "Componer",
    starterTitle:
      "Un documento basado en tablas ya construido a partir de tu kit de marca que pasa todas las comprobaciones.",
    starter: "Empezar desde el kit de marca",
    checking: "Comprobando…",
    check: "Comprobar",
    saveRevision: "Guardar revisión",
    subject: "Asunto",
    preheaderPlaceholder:
      "Preheader — la línea que la bandeja de entrada muestra después del asunto",
    preheaderLabel: "Preheader",
    emailHtml: "HTML del email",
    compileFailed: "El email no se pudo compilar.",
  },
  preview: {
    title: "Previsualización",
    desktop: "Escritorio",
    mobile: "Móvil",
    frameTitle: "Previsualización del email",
    compiledSummary: "HTML compilado — esto es lo que exportas",
    plainTextSummary: "Alternativa en texto plano",
    exportNote:
      "Marketingovo no envía correo. Copia el HTML compilado en tu propio servicio de email, que ya es dueño de tu lista, tus registros de consentimiento y tu gestión de bajas.",
  },
} as const;

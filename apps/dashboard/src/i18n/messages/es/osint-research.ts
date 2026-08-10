/** Public-web OSINT page: pass form, dossier cards, trust, findings, history. */
import type { MessagesFor } from "../types";

export const osintResearch: MessagesFor<"osintResearch"> = {
  eyebrow: "Prioridad de producto · capa de inteligencia",
  title: "OSINT de web pública",
  description:
    "Construye un dossier acotado y enlazado a fuentes a partir de tu sitio y hasta cuatro objetivos públicos indicados explícitamente. El grafo conserva lo observado sin convertir los datos ausentes en una afirmación.",
  available: "Disponible",
  sourceLink: "fuente",
  citedEvidenceOne: "{count} elemento de evidencia citado",
  citedEvidenceMany: "{count} elementos de evidencia citados",
  confidencePct: "{confidence}% de confianza",
  evidence: {
    confidence: "{label} · {confidence}% de confianza",
    observedAt: "· observado {date}",
    claimLabel: "· afirmación",
  },
  form: {
    title: "Iniciar una pasada de evidencia",
    description:
      "El sitio del proyecto se incluye automáticamente. Añade URLs públicas de competidores, socios, salas de prensa o referencias cuando estén dentro del alcance.",
    targetsLabel: "Objetivos públicos adicionales",
    targetsHelp:
      "Hasta cuatro URLs, una por línea. Solo HTTPS; sin credenciales, cookies, sondeos de cuentas ni pivotes de búsqueda de personas.",
    queueing: "Poniendo en cola la investigación de web pública…",
    run: "Ejecutar pasada OSINT",
    invalidTarget: "Usa una URL pública https:// explícita: {url}",
    rejectedTitle: "La lista de objetivos no fue aceptada",
    failedTitle: "La ejecución OSINT no pudo iniciarse",
    queuedTitle: "Ejecución OSINT en cola",
    queuedBody:
      "La ejecución se está recolectando con límites de web pública. Esta página se actualizará cuando su dossier de evidencia quede persistido.",
  },
  target: {
    eyebrow: "Dossier del objetivo",
    pagesObserved: "Páginas observadas",
    availableEvidence: "Evidencia disponible",
    graphEntities: "Entidades del grafo",
    graphLinks: "Enlaces del grafo",
    finalUrl: "URL final:",
    publishingSignalTitle: "Señal pública de publicación",
    cadenceItemsOne: "{count} elemento con fecha en el feed observado",
    cadenceItemsMany: "{count} elementos con fecha en el feed observado",
    cadenceUnavailable:
      "; la cadencia no está disponible sin un intervalo medido.",
    cadenceAverage: "; intervalo promedio de {days} días.",
    cadenceDisclaimer:
      "Esto es evidencia de publicación, no de alcance ni interacción.",
    notObservedTitle: "El objetivo no se observó por completo",
  },
  coverage: {
    title: "Cobertura y política",
    description:
      "Cada observación conserva su fuente y su estado de evidencia. Una señal ausente nunca se convierte en cero.",
    coverage: "Cobertura",
    targetsCompleted: "Objetivos completados",
    pagesObserved: "Páginas observadas",
    evidenceAvailable: "Evidencia disponible",
    publicWebOnly: "Solo web pública",
    personalDataDisabled: "Datos personales desactivados",
    identityResolutionDisabled: "Resolución de identidad desactivada",
    authenticatedCollectionDisabled: "Recolección autenticada desactivada",
    darkWebDisabled: "Dark web desactivada",
  },
  trust: {
    title: "Confianza y procedencia",
    description:
      "Las huellas estables de afirmaciones hacen auditables las pasadas repetidas sin presentar una observación de web pública como verdad verificada de forma independiente.",
    claimFingerprints: "Huellas de afirmaciones",
    sourceUrlsRecorded: "URLs de fuentes registradas",
    integrityRecord: "Registro de integridad",
    recorded: "Registrado",
    incomplete: "Incompleto",
    legacyDossier: "Dossier heredado",
    fingerprintAlgorithm: "Algoritmo de huella",
    evidenceDigest: "Resumen de evidencia:",
    olderFormatTitle: "Formato de dossier antiguo",
    olderFormatBody:
      "Esta pasada guardada es anterior a las huellas de afirmaciones. Ejecuta una nueva pasada de web pública para registrar la procedencia de cada observación.",
    fingerprintScope:
      "Las huellas cubren los campos de afirmación observados y excluyen intencionadamente la hora de captura. El resumen detecta cambios en el reporte; no certifica que una fuente sea precisa o autoritativa.",
  },
  findings: {
    title: "Hallazgos",
    description:
      "Observaciones descriptivas y enlazadas a evidencia desde la web pública.",
    empty: "Ningún hallazgo fue sustentado por la evidencia observada.",
  },
  history: {
    title: "Historial de pasadas",
    comparedDescription:
      "Cambios citados de la web pública desde {date}. Un objetivo bloqueado se excluye en lugar de tratarse como una desaparición.",
    firstPassDescription:
      "Ejecuta una segunda pasada de web pública para comparar señales exactas a lo largo del tiempo.",
    baseline:
      "La primera pasada establece la línea base. Las siguientes reportan evidencia añadida, eliminada y modificada sin hacer afirmaciones de identidad.",
    noChanges:
      "Ninguna señal pública sustentada cambió desde la pasada anterior.",
    targetLabel: "· objetivo",
  },
  dossiers: {
    title: "Dossieres de objetivos",
    generatedOne: "Generado {date} · {count} objetivo de fuente acotado.",
    generatedMany: "Generado {date} · {count} objetivos de fuente acotados.",
  },
  limitations: {
    title: "Limitaciones conocidas",
    description:
      "Estas restricciones forman parte del contrato del dossier, no son una carencia oculta de la UI.",
  },
  noDossierTitle: "Aún no hay dossier OSINT",
  noDossierBody:
    "Ejecuta una pasada de web pública arriba para crear el primer dossier enlazado a evidencia de este proyecto.",
} as const;

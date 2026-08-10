/** Integrations page: connector cards and their credential sub-forms. */
import type { MessagesFor } from "../types";

export const integrations: MessagesFor<"integrations"> = {
  eyebrow: "Datos conectados",
  title: "Integraciones",
  description:
    "Reúne señales de búsqueda, analítica, rastreo y contenido en una sola capa de decisión defendible.",
  vaultNoticeTitle: "Las credenciales no pasan por el navegador",
  vaultNoticeBody:
    "Los valores secretos se envían a la API local para almacenarse cifrados en el servidor. La UI solo recibe el estado de conexión y etiquetas de cuenta seguras.",
  testFailedTitle: "La prueba de conexión falló",
  testCompleteTitle: "Prueba de conexión completada",
  testCompleteBody: "El estado de la integración se ha actualizado.",
  removedTitle: "Credencial local eliminada",
  removedBody:
    "El proveedor queda desconectado de Marketingovo. Cualquier mapeo de sitio no secreto sigue disponible para reconectar más adelante.",
  cancel: "Cancelar",
  credentialForm: {
    apiKeyLabel: "Clave de API",
    title: "Conectar {name}",
    intro:
      "Las credenciales se envían directamente a la API local. Este panel nunca las guarda en el almacenamiento del navegador ni las vuelve a leer.",
    closeAria: "Cerrar formulario de credenciales",
    textHelp:
      "Introduce el identificador de cuenta proporcionado por la plataforma.",
    secretHelp:
      "Se guarda en el almacén de credenciales de la API; nunca se devuelve al navegador.",
    notSavedTitle: "Las credenciales no se guardaron",
    saving: "Guardando de forma segura…",
    saveAndConnect: "Guardar y conectar",
    continue: "Continuar",
  },
  configurationForm: {
    title: "Configurar {name}",
    intro:
      "Estos ajustes no secretos se guardan por sitio, así un mismo espacio de trabajo local puede mapear varios sitios a distintas propiedades del proveedor.",
    closeAria: "Cerrar formulario de configuración",
    help: "Este ajuste no contiene material secreto de credenciales.",
    notSavedTitle: "La configuración no se guardó",
    saving: "Guardando…",
    save: "Guardar configuración",
  },
  removal: {
    title: "Revocar el acceso local a {name}",
    intro:
      "Elimina esta credencial del almacén local respaldado por el sistema operativo y desconéctala de todos los proyectos locales. Los mapeos de sitio no secretos se conservan para reconectar más adelante.",
    closeAria: "Cerrar eliminación de credenciales",
    providerNoticeTitle: "El acceso en el proveedor puede seguir activo",
    providerNoticeBody:
      "Marketingovo puede borrar su copia local, pero no puede desactivar una clave de API ni un permiso OAuth en el proveedor. Usa la página de configuración del proveedor cuando necesites revocar la credencial en su origen.",
    acknowledgement:
      "Entiendo que esto desconecta {name} en todos los proyectos locales.",
    notRemovedTitle: "La credencial no se eliminó",
    removing: "Eliminando…",
    remove: "Eliminar credencial local",
  },
  card: {
    categoryFallback: "Fuente de datos",
    descriptionFallback:
      "No se devolvió ninguna descripción de la integración.",
    account: "Cuenta",
    notConnected: "No conectada",
    lastVerifiedSync: "Última sincronización verificada",
    quotaRemaining: "Cuota restante",
    quotaReset: "Reinicio de cuota",
    rotateCredentials: "Rotar credenciales",
    addOptionalApiKey: "Añadir clave de API opcional",
    connectApiKey: "Conectar clave de API",
    connectCredentials: "Conectar credenciales",
    connectAccount: "Conectar cuenta",
    reconnectAccount: "Reconectar cuenta",
    editSiteMapping: "Editar mapeo de sitio",
    configureSite: "Configurar sitio",
    testConnection: "Probar conexión",
    revokeAria: "Revocar el acceso local de {name}",
    revoke: "Revocar acceso local",
  },
  emptyTitle: "No hay integraciones disponibles",
  emptyDescription:
    "La API no devolvió un catálogo de integraciones. Revisa la salud del sistema y la configuración del servidor.",
} as const;

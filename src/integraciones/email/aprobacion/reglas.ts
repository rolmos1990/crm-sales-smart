// Reglas de aprobación de remitentes desconocidos (FR-032 a FR-039).
//
// Un número de WhatsApp lo conoce quien ya habló con el negocio; una dirección
// de correo publicada en un sitio web recibe proveedores, facturas, boletines
// y spam. Por eso el negocio puede decidir que no todo remitente desconocido
// se convierta en un contacto y una oportunidad del CRM.
//
// Límite que no se cruza: esto aplica SOLO al canal correo. Para WhatsApp,
// Instagram y Messenger todas estas funciones devuelven `false` y el
// comportamiento queda idéntico al de siempre (FR-039, SC-011).
import { CANAL_EMAIL, type ConfiguracionBuzonAlmacenada } from "../tipos";

export interface EstadoAprobacion {
  /** El remitente debe aprobarse antes de poder atenderlo. */
  requiereAprobacion: boolean;
}

/**
 * ¿Este remitente entra bloqueado?
 *
 * Tres condiciones, todas necesarias:
 *   1. es el canal correo;
 *   2. el buzón tiene desactivada la creación automática de contactos;
 *   3. esa dirección todavía no fue aprobada.
 *
 * La tercera es la que hace que "una vez aprobado el remitente, sus correos
 * posteriores se reciben normalmente" (FR-037) se cumpla aunque la
 * conversación se cierre y se reabra: la memoria vive en la dirección, no en
 * la conversación.
 */
export function requiereAprobacion(input: {
  canal: string;
  recepcion?: Pick<
    ConfiguracionBuzonAlmacenada["recepcion"],
    "crearContactosAutomaticamente"
  > | null;
  aprobadoEn?: Date | null;
}): boolean {
  if (input.canal !== CANAL_EMAIL) return false;
  // Sin configuración legible se asume el comportamiento por defecto, que es
  // el de siempre: crear el contacto. Un buzón mal configurado no debe
  // bloquear conversaciones en silencio.
  if (input.recepcion?.crearContactosAutomaticamente !== false) return false;
  return !input.aprobadoEn;
}

/**
 * ¿Esta conversación puede emitir un mensaje saliente?
 *
 * La leen los tres puntos desde los que puede salir un mensaje: el agente
 * humano (envio.ts), el agente de IA (orquestar-ia.suscriptor.ts) y el motor
 * de Workflows (workflows/motor/disparo.ts). Entregar el bloqueo en uno solo
 * deja un agujero por el que la IA responde un correo no aprobado.
 */
export function conversacionBloqueada(
  conversacion: { bloqueadaPorAprobacion?: boolean | null } | null | undefined,
): boolean {
  return conversacion?.bloqueadaPorAprobacion === true;
}

/** Lo que se le dice al agente cuando intenta responder un pendiente (FR-034). */
export const MENSAJE_BLOQUEO_APROBACION =
  "Este correo es de un remitente sin aprobar. Aprobá el remitente para poder responderle.";

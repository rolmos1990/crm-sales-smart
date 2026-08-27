/**
 * Decide a qué canal pertenece un evento `object:"page"` del webhook de Meta
 * cuando la misma Página de Facebook tiene conectada una cuenta de
 * Instagram (flujo heredado vía Página) y/o una cuenta de Facebook
 * Messenger — Meta manda ambos tipos de mensaje por el mismo evento, sin
 * ningún campo que diga cuál es cuál (ver
 * specs/005-facebook-messenger-integracion/research.md, R1).
 *
 * Módulo separado y sin dependencias (ni Prisma ni Next) a propósito, para
 * poder testear la decisión sin mockear la base de datos — mismo criterio
 * que instagram-ventana.ts (obtenerEstadoVentanaMensajeria).
 */

export type CuentaCanalWebhook = { id: string; instanciaId: string; configuracion: unknown };

/**
 * `esContactoInstagramConocido` ya viene resuelto por quien llama (una
 * consulta a `ContactoIdentificadorCanal`) — solo hace falta cuando ambos
 * candidatos existen; en el caso común (un solo candidato) esta función
 * decide sin necesitar ese dato.
 */
export function resolverCuentaParaEventoPage(
  cuentaInstagram: CuentaCanalWebhook | null,
  cuentaMessenger: CuentaCanalWebhook | null,
  esContactoInstagramConocido: boolean,
): { cuentaCanal: CuentaCanalWebhook; canal: "instagram" | "facebook_messenger" } | null {
  if (cuentaInstagram && cuentaMessenger) {
    return esContactoInstagramConocido
      ? { cuentaCanal: cuentaInstagram, canal: "instagram" }
      : { cuentaCanal: cuentaMessenger, canal: "facebook_messenger" };
  }
  if (cuentaInstagram) return { cuentaCanal: cuentaInstagram, canal: "instagram" };
  if (cuentaMessenger) return { cuentaCanal: cuentaMessenger, canal: "facebook_messenger" };
  return null;
}

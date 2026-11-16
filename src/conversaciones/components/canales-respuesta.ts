// Canales por los que se le puede responder a un contacto. Puro (sin JSX)
// para poder probarlo con vitest.
import type { ConversacionResumen, CuentaCanalResumen } from "../types";

/** Una cuenta del negocio por la que se le puede responder al contacto. */
export interface CanalRespuesta {
  cuentaCanalId: string;
  /** Conversación del contacto en esa cuenta; null si todavía no hay y hay que iniciarla. */
  conversacionId: string | null;
  canal: string;
  nombreCuenta: string;
  /** Desde dónde sale el mensaje (número, @cuenta, buzón). */
  identificadorCuenta: string;
  /** Cómo se identifica al contacto en ese canal (correo, teléfono, @usuario). */
  identificadorContacto: string | null;
}

const esMeta = (canal: string) => canal === "instagram" || canal === "facebook_messenger";

// Los entrantes guardan el canal completo ("whatsapp_lite") pero
// iniciarConversacion guardó históricamente el base ("whatsapp"): se aceptan los dos.
const canalBase = (canal: string) => canal.replace("_lite", "").replace("_business", "");

function identificadorEnCanal(conv: ConversacionResumen, canal: string) {
  const ids = conv.contacto?.identificadoresCanal ?? [];
  return ids.find((i) => i.canal === canal) ?? ids.find((i) => canalBase(i.canal) === canalBase(canal)) ?? null;
}

/**
 * Cómo se le llega al contacto por `cuenta`, o null si no hay forma. WhatsApp
 * y correo sirven con el dato del contacto. Instagram y Messenger exigen que
 * el contacto haya escrito antes (Meta no deja abrir conversación con un IGSID/
 * PSID desconocido), y ese id es propio de cada cuenta: con varias cuentas del
 * mismo canal solo vale la que ya tiene conversación con él.
 */
function identificadorAlcanzable(
  conv: ConversacionResumen,
  cuenta: CuentaCanalResumen,
  cuentasDelMismoCanal: number,
  tieneConversacion: boolean,
): string | null | false {
  const id = identificadorEnCanal(conv, cuenta.canal);
  const etiqueta = id ? (id.handle ? `@${id.handle}` : id.identificador) : null;

  if (cuenta.canal.startsWith("whatsapp")) return etiqueta ?? conv.contacto?.telefonoPrincipal ?? false;
  if (cuenta.canal === "email") return etiqueta ?? conv.contacto?.email ?? false;
  if (!id) return false;
  if (esMeta(cuenta.canal) && cuentasDelMismoCanal > 1 && !tieneConversacion) return false;
  return etiqueta;
}

/**
 * Cuentas del negocio por las que se le puede responder al contacto de
 * `actual`. La de la conversación actual va siempre primero. El resto sale de
 * `cuentas` (activas) filtradas a las que pueden llegarle al contacto; si ya
 * tiene conversación en esa cuenta se usa la más reciente, si no queda con
 * `conversacionId: null` para iniciarla al elegirla.
 */
export function canalesDeRespuesta(
  actual: ConversacionResumen,
  conversaciones: ConversacionResumen[],
  cuentas: CuentaCanalResumen[] = [],
): CanalRespuesta[] {
  const porCuenta = new Map<string, ConversacionResumen>();
  for (const c of conversaciones) {
    if (c.contactoId !== actual.contactoId || !c.cuentaCanalId || !c.cuentaCanal) continue;
    const previa = porCuenta.get(c.cuentaCanalId);
    if (!previa || new Date(c.actualizadoEn) > new Date(previa.actualizadoEn)) porCuenta.set(c.cuentaCanalId, c);
  }

  const resultado: CanalRespuesta[] = [];
  if (actual.cuentaCanalId && actual.cuentaCanal) {
    resultado.push({
      cuentaCanalId: actual.cuentaCanalId,
      conversacionId: actual.id,
      canal: actual.cuentaCanal.canal,
      nombreCuenta: actual.cuentaCanal.nombre,
      identificadorCuenta: actual.cuentaCanal.identificador,
      identificadorContacto: actual.handleCanal ? `@${actual.handleCanal}` : (actual.identificadorCanal ?? null),
    });
  }

  for (const cuenta of cuentas) {
    if (cuenta.id === actual.cuentaCanalId) continue;
    const existente = porCuenta.get(cuenta.id) ?? null;
    const mismoCanal = cuentas.filter((c) => c.canal === cuenta.canal).length;
    const alcance = identificadorAlcanzable(actual, cuenta, mismoCanal, !!existente);
    // Una conversación existente ya demuestra que se le puede escribir por ahí.
    if (alcance === false && !existente) continue;
    resultado.push({
      cuentaCanalId: cuenta.id,
      conversacionId: existente?.id ?? null,
      canal: cuenta.canal,
      nombreCuenta: cuenta.nombre,
      identificadorCuenta: cuenta.identificador,
      identificadorContacto:
        (alcance || null) ??
        (existente?.handleCanal ? `@${existente.handleCanal}` : (existente?.identificadorCanal ?? null)),
    });
  }

  return resultado;
}

// Canales por los que se le puede responder a un contacto. Puro (sin JSX)
// para poder probarlo con vitest.
import type { ConversacionResumen } from "../types";

/** Un canal por el que se le puede responder al contacto: su conversación en esa cuenta. */
export interface CanalRespuesta {
  conversacionId: string;
  canal: string;
  nombreCuenta: string;
  /** Cómo se identifica al contacto en ese canal (correo, teléfono, @usuario). */
  identificadorContacto: string | null;
}

/**
 * Canales por los que se le puede responder al contacto de `actual`: uno por
 * cada cuenta en la que el contacto ya tiene conversación (la más reciente de
 * cada cuenta). La actual va primero. Un mensaje sale siempre por la cuenta de
 * su conversación, así que "responder por otro canal" es pasar a esa conversación.
 */
export function canalesDeRespuesta(
  actual: ConversacionResumen,
  conversaciones: ConversacionResumen[],
): CanalRespuesta[] {
  const porCuenta = new Map<string, ConversacionResumen>();
  for (const c of conversaciones) {
    if (c.contactoId !== actual.contactoId || !c.cuentaCanalId || !c.cuentaCanal) continue;
    if (c.cuentaCanalId === actual.cuentaCanalId) continue;
    const previa = porCuenta.get(c.cuentaCanalId);
    if (!previa || new Date(c.actualizadoEn) > new Date(previa.actualizadoEn)) porCuenta.set(c.cuentaCanalId, c);
  }
  const aCanal = (c: ConversacionResumen): CanalRespuesta => ({
    conversacionId: c.id,
    canal: c.cuentaCanal?.canal ?? "",
    nombreCuenta: c.cuentaCanal?.nombre ?? "",
    identificadorContacto: c.handleCanal ? `@${c.handleCanal}` : (c.identificadorCanal ?? null),
  });
  return [actual, ...porCuenta.values()].filter((c) => c.cuentaCanal).map(aCanal);
}

// 035 — De los datos de correo del comando ProcesarEntrante a la fila de
// MensajeCorreo. Puro (de Prisma solo usa tipos): lo usa procesarMensajeEntrante para crear
// el registro ANIDADO en el mismo create del mensaje, que es lo que hace
// idempotente el reproceso (FR-011).
import type { Prisma } from "@/generated/prisma/client";
import { datosCorreoEntranteSchema } from "../vista/schema";
import { MAX_BYTES_HTML_LIMPIO } from "./html/politica";

export type FilaMensajeCorreoNueva = Prisma.MensajeCorreoUncheckedCreateWithoutMensajeInput;

/**
 * Valida y mapea. Devuelve null si los datos no tienen la forma esperada: en
 * ese caso el mensaje se crea igual, sin MensajeCorreo, y se ve en texto como
 * antes de 035. Un correo nunca se pierde por esto.
 */
export function filaMensajeCorreo(datos: unknown, instanciaId: string): FilaMensajeCorreoNueva | null {
  const r = datosCorreoEntranteSchema.safeParse(datos);
  if (!r.success) return null;
  const d = r.data;
  // Cinturón y tirantes: el HTML guardado nunca supera el tope de la política.
  const html =
    d.estadoHtml === "DISPONIBLE" && d.htmlLimpio && Buffer.byteLength(d.htmlLimpio, "utf8") <= MAX_BYTES_HTML_LIMPIO
      ? d.htmlLimpio
      : null;
  const estadoHtml = d.estadoHtml === "DISPONIBLE" && !html ? "NO_DISPONIBLE" : d.estadoHtml;
  return {
    instanciaId,
    estadoHtml,
    motivoHtml: estadoHtml === "DISPONIBLE" ? null : (d.motivoHtml ?? (estadoHtml === "NO_DISPONIBLE" ? "DEMASIADO_GRANDE" : null)),
    htmlLimpio: estadoHtml === "DISPONIBLE" ? html : null,
    versionPolitica: d.versionPolitica,
    tieneImagenesExternas: estadoHtml === "DISPONIBLE" && d.imagenesExternas.length > 0,
    imagenesExternas: estadoHtml === "DISPONIBLE" ? d.imagenesExternas : [],
    adjuntos: d.adjuntos,
    de: d.de ?? undefined,
    para: d.para,
    paraTotal: d.paraTotal,
    cc: d.cc,
    ccTotal: d.ccTotal,
    asunto: d.asunto,
    fechaEnvio: d.fechaEnvio ? new Date(d.fechaEnvio) : null,
  };
}

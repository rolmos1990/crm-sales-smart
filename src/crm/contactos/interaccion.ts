import { prisma } from "@/shared/db/prisma";
import { marcarPendienteSinFallar } from "./analisis/cola";

/**
 * 041 — Único lugar que escribe `Contacto.ultimaInteraccionEn` y
 * `Contacto.esperandoRespuestaDesde` (research D3).
 *
 * Son hechos con fecha, no configuración: se materializan para ordenar y
 * filtrar miles de contactos sin agregar sobre mensajes, actividades y pedidos
 * en cada consulta. Se escriben en línea —al lado del `actualizadoEn` de la
 * conversación— y no por suscriptor, para que la lista los refleje en el
 * mismo render en que el agente ve el mensaje.
 *
 * Qué cuenta como interacción (clarificación 1 de la spec): mensajes del
 * contacto, mensajes de una persona del equipo, actividades creadas por una
 * persona y pedidos. Los envíos automáticos de la IA o de un Workflow NO
 * cuentan como interacción, pero SÍ como respuesta.
 */

type ClienteContacto = { contacto: Pick<typeof prisma.contacto, "updateMany"> };

/**
 * 042 — Junto a cada interacción se marca el contacto para el análisis (P1).
 * Solo si llega `instanciaId`: no se agrega una consulta por mensaje para
 * averiguarlo; el barrido de reconciliación cubre a quien no lo pase.
 * `marcarPendienteSinFallar` usa el cliente global y nunca el `db` recibido:
 * un fallo al marcar no puede abortar la transacción de quien llama.
 */
async function marcarParaAnalisis(
  contactoId: string,
  instanciaId: string | null | undefined,
  motivo: "MENSAJE" | "INTERACCION",
): Promise<void> {
  if (!instanciaId) return;
  await marcarPendienteSinFallar({ instanciaId, contactoId, prioridad: "P1", motivo });
}

/** Avanza la última interacción; nunca retrocede (tolera eventos fuera de orden). */
export async function registrarInteraccion(
  contactoId: string,
  fecha: Date,
  db: ClienteContacto = prisma,
  instanciaId?: string | null,
): Promise<void> {
  await db.contacto.updateMany({
    where: { id: contactoId, OR: [{ ultimaInteraccionEn: null }, { ultimaInteraccionEn: { lt: fecha } }] },
    data: { ultimaInteraccionEn: fecha },
  });
  await marcarParaAnalisis(contactoId, instanciaId, "INTERACCION");
}

/**
 * Mensaje del contacto: es interacción y deja al contacto esperando respuesta.
 * Conserva la fecha del PRIMER mensaje sin respuesta, que es la que importa
 * para saber cuánto lleva esperando.
 */
export async function registrarMensajeEntrante(
  contactoId: string,
  fecha: Date,
  db: ClienteContacto = prisma,
  instanciaId?: string | null,
): Promise<void> {
  await registrarInteraccion(contactoId, fecha, db);
  await db.contacto.updateMany({
    where: { id: contactoId, esperandoRespuestaDesde: null },
    data: { esperandoRespuestaDesde: fecha },
  });
  await marcarParaAnalisis(contactoId, instanciaId, "MENSAJE");
}

/** Cualquier respuesta saliente —de una persona o automática— cierra la espera. */
export async function registrarRespuesta(contactoId: string, db: ClienteContacto = prisma): Promise<void> {
  await db.contacto.updateMany({
    where: { id: contactoId, esperandoRespuestaDesde: { not: null } },
    data: { esperandoRespuestaDesde: null },
  });
}

/**
 * Para usar fuera de una transacción: el registro principal (mensaje,
 * actividad, pedido) ya se creó y no debe fallar por un dato derivado. Se
 * registra el error y se sigue.
 */
export async function sinFallar(etiqueta: string, contactoId: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[Contactos] No se pudo ${etiqueta}`, { contactoId, err });
  }
}

export async function registrarInteraccionSinFallar(
  contactoId: string | null | undefined,
  fecha: Date,
  instanciaId?: string | null,
): Promise<void> {
  if (!contactoId) return;
  await sinFallar("registrar la interacción del contacto", contactoId, () =>
    registrarInteraccion(contactoId, fecha, prisma, instanciaId),
  );
}

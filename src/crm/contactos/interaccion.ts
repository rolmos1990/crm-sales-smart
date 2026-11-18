import { prisma } from "@/shared/db/prisma";

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

/** Avanza la última interacción; nunca retrocede (tolera eventos fuera de orden). */
export async function registrarInteraccion(
  contactoId: string,
  fecha: Date,
  db: ClienteContacto = prisma,
): Promise<void> {
  await db.contacto.updateMany({
    where: { id: contactoId, OR: [{ ultimaInteraccionEn: null }, { ultimaInteraccionEn: { lt: fecha } }] },
    data: { ultimaInteraccionEn: fecha },
  });
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
): Promise<void> {
  await registrarInteraccion(contactoId, fecha, db);
  await db.contacto.updateMany({
    where: { id: contactoId, esperandoRespuestaDesde: null },
    data: { esperandoRespuestaDesde: fecha },
  });
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

export async function registrarInteraccionSinFallar(contactoId: string | null | undefined, fecha: Date): Promise<void> {
  if (!contactoId) return;
  await sinFallar("registrar la interacción del contacto", contactoId, () => registrarInteraccion(contactoId, fecha));
}

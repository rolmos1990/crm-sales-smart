import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { calcularDatosObjetivos, clasificarTipoRelacion } from "./calculo-objetivo";
import { generarSenalesObjetivas } from "./senales";
import { obtenerSnapshotVigente } from "./queries";
import type { PerfilCliente, DatosInterpretados } from "./tipos";

// Eventos de conversación — únicos que ameritan intentar la extracción
// interpretada (research.md Decisión 4 de la spec).
const EVENTOS_CONVERSACION = ["CONVERSACION_CREADA", "CONVERSACION_RESUMIDA", "CONVERSACION_CLASIFICADA"];

async function tieneAlgunaConversacion(contactoId: string, instanciaId: string): Promise<boolean> {
  const count = await prisma.conversacion.count({ where: { contactoId, instanciaId } });
  return count > 0;
}

/**
 * Recalcula y persiste el perfil de un contacto. Idempotente: llamar dos
 * veces con el mismo estado de datos produce el mismo resultado (upsert por
 * `contactoId`). No toca `datosInterpretados` salvo que `disparadoPor` sea
 * un evento de conversación (FR-006, FR-007 — ver extraccion-interpretada.ts,
 * conectado en la Historia 2).
 */
export async function recalcular(
  contactoId: string,
  instanciaId: string,
  disparadoPor?: string,
): Promise<PerfilCliente> {
  const [datosObjetivos, tieneInteraccionPrevia, snapshotAnterior] = await Promise.all([
    calcularDatosObjetivos(contactoId, instanciaId),
    tieneAlgunaConversacion(contactoId, instanciaId),
    obtenerSnapshotVigente(contactoId, instanciaId),
  ]);

  const tipoRelacion = clasificarTipoRelacion({
    pedidosCompletados: datosObjetivos.numeroPedidosCompletados,
    tieneInteraccionPrevia,
    fechaUltimaCompra: datosObjetivos.fechaUltimaCompra,
    tieneIncidenciaActiva: datosObjetivos.incidenciasActivas > 0,
  });

  const senalesObjetivas = generarSenalesObjetivas(datosObjetivos);

  let datosInterpretados: DatosInterpretados | null = snapshotAnterior?.datosInterpretados ?? null;
  if (disparadoPor && EVENTOS_CONVERSACION.includes(disparadoPor)) {
    // Import diferido — evita cargar el gateway de IA cuando no hace falta
    // (eventos de Pedido/Cotización/Oportunidad no lo necesitan).
    const { extraerDatosInterpretados } = await import("./extraccion-interpretada");
    const nuevaInterpretacion = await extraerDatosInterpretados(contactoId, instanciaId);
    // Fallo/ausencia → se conserva la interpretación anterior, nunca se borra (research.md Decisión 4).
    if (nuevaInterpretacion) datosInterpretados = nuevaInterpretacion;
  }

  await prisma.perfilClienteSnapshot.upsert({
    where: { contactoId },
    create: {
      contactoId,
      instanciaId,
      tipoRelacion,
      datosObjetivos: datosObjetivos as unknown as Prisma.InputJsonValue,
      datosInterpretados: (datosInterpretados as unknown as Prisma.InputJsonValue) ?? undefined,
      senalesObjetivas: senalesObjetivas as unknown as Prisma.InputJsonValue,
      disparadoPor: disparadoPor ?? null,
    },
    update: {
      tipoRelacion,
      datosObjetivos: datosObjetivos as unknown as Prisma.InputJsonValue,
      datosInterpretados: (datosInterpretados as unknown as Prisma.InputJsonValue) ?? undefined,
      senalesObjetivas: senalesObjetivas as unknown as Prisma.InputJsonValue,
      disparadoPor: disparadoPor ?? null,
      calculadoEn: new Date(),
    },
  });

  return {
    contactoId,
    tipoRelacion,
    datosObjetivos,
    datosInterpretados,
    senalesObjetivas,
    calculadoEn: new Date().toISOString(),
    disparadoPor: disparadoPor ?? null,
  };
}

/**
 * Lee el perfil vigente; lo calcula bajo demanda si es el primer acceso
 * (FR-004). `null` si el contacto no existe o no pertenece a `instanciaId`
 * (FR-008).
 */
export async function obtenerPerfil(contactoId: string, instanciaId: string): Promise<PerfilCliente | null> {
  const contacto = await prisma.contacto.findFirst({ where: { id: contactoId, instanciaId }, select: { id: true } });
  if (!contacto) return null;

  const existente = await obtenerSnapshotVigente(contactoId, instanciaId);
  if (existente) return existente;

  return recalcular(contactoId, instanciaId);
}

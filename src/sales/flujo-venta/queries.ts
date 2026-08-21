import { prisma } from "@/shared/db/prisma";

/**
 * Solo los ids + flags de cierre de las etapas del flujo activo — para KPIs
 * que necesitan saber qué etapas son "abiertas"/"finales"/"cancelación" sin
 * traer reglas, condiciones ni el resto del payload pesado de
 * obtenerFlujoVenta (evita over-fetching en una ruta de agregación).
 */
export async function obtenerEtapasFlujoActivo(instanciaId: string) {
  const flujo = await prisma.flujoVenta.findFirst({
    where: { instanciaId, activo: true },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
    select: {
      etapas: {
        where: { activo: true },
        select: { id: true, esFinal: true, esCancelacion: true },
      },
    },
  });
  return flujo?.etapas ?? [];
}

export async function obtenerFlujoVenta(instanciaId: string) {
  return prisma.flujoVenta.findFirst({
    where: { instanciaId, activo: true },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
    include: {
      etapas: {
        where: { activo: true },
        orderBy: { orden: "asc" },
        include: {
          reglas: {
            where: { activo: true },
            orderBy: { prioridad: "asc" },
            include: { condiciones: true },
          },
        },
      },
    },
  });
}

export async function obtenerFlujoVentaCompleto(instanciaId: string) {
  return prisma.flujoVenta.findFirst({
    where: { instanciaId },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
    include: {
      etapas: {
        orderBy: { orden: "asc" },
        include: {
          reglas: {
            orderBy: { prioridad: "asc" },
            include: { condiciones: true },
          },
          disparadores: {
            where: { activo: true },
            orderBy: { orden: "asc" },
          },
        },
      },
    },
  });
}

export async function inicializarFlujoVentaPorDefecto(instanciaId: string): Promise<void> {
  await prisma.flujoVenta.create({
    data: { nombre: "Flujo de venta", esDefault: true, instanciaId },
  });
}

export async function obtenerHistorialPedido(pedidoId: string) {
  return prisma.pedidoHistorialEtapa.findMany({
    where: { pedidoId },
    include: { etapa: { select: { nombre: true, color: true } } },
    orderBy: { creadoEn: "desc" },
  });
}

import { prisma } from "@/shared/db/prisma";

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
        },
      },
    },
  });
}

export async function obtenerHistorialPedido(pedidoId: string) {
  return prisma.pedidoHistorialEtapa.findMany({
    where: { pedidoId },
    include: { etapa: { select: { nombre: true, color: true } } },
    orderBy: { creadoEn: "desc" },
  });
}

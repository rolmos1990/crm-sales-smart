import { prisma } from "@/shared/db/prisma";

export async function obtenerConfigIA(instanciaId: string) {
  return prisma.configuracionIA.findUnique({
    where: { instanciaId },
  });
}

export async function obtenerProveedoresIA(instanciaId: string) {
  return prisma.proveedorIA.findMany({
    where: { instanciaId },
    orderBy: { prioridad: "desc" },
    select: {
      id: true,
      proveedor: true,
      activo: true,
      prioridad: true,
      modelosDisponibles: true,
      limitePorMinuto: true,
      limitePorDia: true,
      timeoutMs: true,
      reintentosMax: true,
      baseUrl: true,
      costoInputPorMilToken: true,
      costoOutputPorMilToken: true,
      creadoEn: true,
      // La API key nunca se devuelve al cliente
    },
  });
}

export async function obtenerProveedorIA(id: string, instanciaId: string) {
  return prisma.proveedorIA.findFirst({
    where: { id, instanciaId },
    select: {
      id: true,
      proveedor: true,
      activo: true,
      prioridad: true,
      modelosDisponibles: true,
      limitePorMinuto: true,
      limitePorDia: true,
      timeoutMs: true,
      reintentosMax: true,
      baseUrl: true,
    },
  });
}

export async function obtenerResumenUsoIA(instanciaId: string) {
  const [hoy, mes] = await Promise.all([
    prisma.usoIA.aggregate({
      where: {
        instanciaId,
        exito: true,
        creadoEn: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { tokensInput: true, tokensOutput: true },
      _count: { id: true },
    }),
    prisma.usoIA.aggregate({
      where: {
        instanciaId,
        exito: true,
        creadoEn: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { tokensInput: true, tokensOutput: true },
      _count: { id: true },
    }),
  ]);

  return {
    hoy: {
      llamadas: hoy._count.id,
      tokens: (hoy._sum.tokensInput ?? 0) + (hoy._sum.tokensOutput ?? 0),
    },
    mes: {
      llamadas: mes._count.id,
      tokens: (mes._sum.tokensInput ?? 0) + (mes._sum.tokensOutput ?? 0),
    },
  };
}

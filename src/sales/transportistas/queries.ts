import { prisma } from "@/shared/db/prisma";

export async function obtenerTransportistas(instanciaId: string) {
  const transportistas = await prisma.transportista.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { tarifas: { where: { activa: true } } } } },
  });

  return transportistas.map((t) => ({ ...t, zonasActivas: t._count.tarifas }));
}

// 022-transportistas-zonas-tarifas — panel de configuración /[id] (T028).
export async function obtenerTransportista(id: string, instanciaId: string) {
  const transportista = await prisma.transportista.findFirst({
    where: { id, instanciaId },
    include: {
      condiciones: true,
      servicios: { orderBy: { nombre: "asc" } },
      _count: { select: { tarifas: { where: { activa: true } } } },
    },
  });
  if (!transportista) return null;
  return { ...transportista, zonasActivas: transportista._count.tarifas };
}

import { prisma } from "@/shared/db/prisma";

// 022-transportistas-zonas-tarifas — catálogo reutilizable por empresa
// (FR-009), independiente de cualquier transportista.
export async function listarZonasEntrega(instanciaId: string, busqueda?: string) {
  return prisma.zonaEntrega.findMany({
    where: {
      instanciaId,
      ...(busqueda ? { nombre: { contains: busqueda, mode: "insensitive" } } : {}),
    },
    include: { ubicaciones: true, _count: { select: { tarifas: true } } },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
  });
}

export async function obtenerZonaEntrega(id: string, instanciaId: string) {
  return prisma.zonaEntrega.findFirst({
    where: { id, instanciaId },
    include: { ubicaciones: { include: { pais: true } } },
  });
}

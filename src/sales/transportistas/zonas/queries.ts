import { prisma } from "@/shared/db/prisma";

// 022-transportistas-zonas-tarifas — catálogo reutilizable por empresa
// (FR-009), independiente de cualquier transportista.
// 023-transportistas-por-pais — `paisId` opcional (research.md Decisión 1):
// el catálogo sigue siendo global, pero al consultarlo desde el contexto de
// un transportista se filtra a solo las zonas con alguna ubicación en su país.
export async function listarZonasEntrega(instanciaId: string, busqueda?: string, paisId?: string) {
  return prisma.zonaEntrega.findMany({
    where: {
      instanciaId,
      ...(busqueda ? { nombre: { contains: busqueda, mode: "insensitive" } } : {}),
      ...(paisId ? { ubicaciones: { some: { paisId } } } : {}),
    },
    include: { ubicaciones: { include: { pais: true } }, _count: { select: { tarifas: true } } },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
  });
}

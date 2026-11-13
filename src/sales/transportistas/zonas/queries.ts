import { prisma } from "@/shared/db/prisma";

// Zonas de UN transportista. Antes era el catálogo compartido de la empresa
// (FR-009 de la 022); se acotó porque importar destinos para un transportista
// terminaba modificando la cobertura de otro — ver ZonaEntrega.transportistaId
// en schema.prisma.
//
// `instanciaId` se sigue exigiendo aunque el transportista ya la implique:
// es la barrera multi-tenant, no un filtro de conveniencia.
export async function listarZonasEntrega(
  instanciaId: string,
  transportistaId: string,
  busqueda?: string,
  paisId?: string,
) {
  return prisma.zonaEntrega.findMany({
    where: {
      instanciaId,
      transportistaId,
      ...(busqueda ? { nombre: { contains: busqueda, mode: "insensitive" } } : {}),
      ...(paisId ? { ubicaciones: { some: { paisId } } } : {}),
    },
    include: { ubicaciones: { include: { pais: true } }, _count: { select: { tarifas: true } } },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
  });
}

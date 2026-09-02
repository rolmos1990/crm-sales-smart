import { prisma } from "@/shared/db/prisma";

export async function obtenerTransportistas(instanciaId: string) {
  const transportistas = await prisma.transportista.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      // 023-transportistas-por-pais — bandera/nombre en la lista (FR-003)
      pais: true,
      _count: { select: { tarifas: { where: { activa: true } } } },
    },
  });

  const totalesPorTransportista = await obtenerTotalTarifasPorTransportista(transportistas.map((t) => t.id));

  return transportistas.map((t) => ({
    ...t,
    zonasActivas: t._count.tarifas,
    // 023-transportistas-por-pais — research.md Decisión 3: bloqueado en
    // cuanto tiene alguna tarifa, activa o no (a diferencia de zonasActivas).
    tienePaisBloqueado: (totalesPorTransportista.get(t.id) ?? 0) > 0,
  }));
}

// 022-transportistas-zonas-tarifas — panel de configuración /[id] (T028).
export async function obtenerTransportista(id: string, instanciaId: string) {
  const transportista = await prisma.transportista.findFirst({
    where: { id, instanciaId },
    include: {
      // 023-transportistas-por-pais — bandera/nombre en el encabezado (FR-003)
      pais: true,
      condiciones: true,
      servicios: { orderBy: { nombre: "asc" } },
      _count: { select: { tarifas: { where: { activa: true } } } },
    },
  });
  if (!transportista) return null;

  const totalTarifas = await prisma.tarifaTransportistaZona.count({ where: { transportistaId: id } });

  return {
    ...transportista,
    zonasActivas: transportista._count.tarifas,
    tienePaisBloqueado: totalTarifas > 0,
  };
}

// 023-transportistas-por-pais — conteo de TODAS las tarifas (sin filtrar por
// activa) por transportista, usado solo para decidir si el país queda
// bloqueado (research.md Decisión 3); una tarifa desactivada igual "ató" al
// transportista a un país y no debe liberar el campo.
async function obtenerTotalTarifasPorTransportista(transportistaIds: string[]) {
  if (transportistaIds.length === 0) return new Map<string, number>();

  const conteos = await prisma.tarifaTransportistaZona.groupBy({
    by: ["transportistaId"],
    where: { transportistaId: { in: transportistaIds } },
    _count: { _all: true },
  });

  return new Map(conteos.map((c) => [c.transportistaId, c._count._all]));
}

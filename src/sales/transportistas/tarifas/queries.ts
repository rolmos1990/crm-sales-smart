import { prisma } from "@/shared/db/prisma";
import { obtenerCandidatosEnvioPorZona, type DestinoEnvioZona } from "@/shared/entregas/resolver-costo-envio";

// 022-transportistas-zonas-tarifas — tabla editable de tarifas (FR-014),
// con flag `usada` precalculado para habilitar/deshabilitar "Eliminar"
// (FR-020) sin una consulta extra por fila en la UI.
export async function listarTarifas(transportistaId: string) {
  const tarifas = await prisma.tarifaTransportistaZona.findMany({
    where: { transportistaId },
    include: {
      zonaEntrega: { select: { id: true, nombre: true } },
      servicioTransportista: { select: { id: true, nombre: true } },
    },
    orderBy: [{ activa: "desc" }, { zonaEntrega: { nombre: "asc" } }],
  });

  const ids = tarifas.map((t) => t.id);
  const [usadasCotizacion, usadasPedido] = ids.length === 0 ? [[], []] : await Promise.all([
    prisma.entregaCotizacion.findMany({ where: { tarifaTransportistaZonaId: { in: ids } }, select: { tarifaTransportistaZonaId: true } }),
    prisma.entregaPedido.findMany({ where: { tarifaTransportistaZonaId: { in: ids } }, select: { tarifaTransportistaZonaId: true } }),
  ]);
  const idsUsados = new Set([...usadasCotizacion, ...usadasPedido].map((e) => e.tarifaTransportistaZonaId));

  return tarifas.map((t) => ({
    ...t,
    costoInterno: Number(t.costoInterno),
    precioCliente: Number(t.precioCliente),
    margen: Number(t.precioCliente) - Number(t.costoInterno),
    usada: idsUsados.has(t.id),
  }));
}

// FR-022 — costo promedio y margen promedio de las tarifas activas.
export async function obtenerPromedioTarifas(transportistaId: string) {
  const activas = await prisma.tarifaTransportistaZona.findMany({
    where: { transportistaId, activa: true },
    select: { costoInterno: true, precioCliente: true },
  });
  if (activas.length === 0) return { costoPromedio: 0, margenPromedio: 0, cantidad: 0 };

  const costoTotal = activas.reduce((acc, t) => acc + Number(t.costoInterno), 0);
  const margenTotal = activas.reduce((acc, t) => acc + (Number(t.precioCliente) - Number(t.costoInterno)), 0);
  return {
    costoPromedio: costoTotal / activas.length,
    margenPromedio: margenTotal / activas.length,
    cantidad: activas.length,
  };
}

// FR-036 — opciones de envío para un destino, ordenadas de menor a mayor
// precio al cliente (T039). Consumida por obtenerOpcionesEnvioAction en
// actions.ts (Client Component form-cotizacion.tsx).
export async function obtenerOpcionesEnvio(instanciaId: string, destino: Omit<DestinoEnvioZona, "instanciaId">) {
  const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId, ...destino });
  return [...candidatos].sort((a, b) => a.precioCliente - b.precioCliente);
}

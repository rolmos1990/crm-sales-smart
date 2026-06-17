import { prisma } from "@/shared/db/prisma";

/**
 * Cancela jobs PENDIENTE del pedido para etapas distintas a la actual,
 * y encola nuevos jobs para todos los disparadores activos de la nueva etapa.
 */
export async function procesarCambioEtapaPedido(
  pedidoId: string,
  etapaId: string,
  flujoVentaId: string,
) {
  await prisma.disparadorJob.updateMany({
    where: {
      pedidoId,
      flujoVentaId,
      flujoVentaEtapaId: { not: etapaId },
      estado: "PENDIENTE",
    },
    data: { estado: "CANCELADO" },
  });

  const disparadores = await prisma.disparador.findMany({
    where: { flujoVentaEtapaId: etapaId, flujoVentaId, activo: true },
    orderBy: { orden: "asc" },
  });

  if (disparadores.length === 0) return;

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { numero: true, total: true, moneda: true, instanciaId: true },
  });

  const ahora = new Date();
  await prisma.disparadorJob.createMany({
    data: disparadores.map((d) => ({
      disparadorId: d.id,
      pedidoId,
      flujoVentaEtapaId: etapaId,
      flujoVentaId,
      estado: "PENDIENTE" as const,
      ejecutarEn: d.delayMinutos
        ? new Date(ahora.getTime() + d.delayMinutos * 60 * 1000)
        : ahora,
      payload: {
        disparadorNombre: d.nombre,
        tipo: d.tipo,
        config: d.config,
        pedido: pedido ?? { numero: "—", total: 0, moneda: "PEN" },
        instanciaId: pedido?.instanciaId ?? null,
      },
    })),
  });
}

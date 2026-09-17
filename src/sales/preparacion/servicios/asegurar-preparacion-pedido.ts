import { prisma } from "@/shared/db/prisma";
import { asegurarFlujoPreparacion } from "./asegurar-flujo-preparacion";
import { iniciadaEnAlMaterializar } from "./sellado";

/**
 * Materializa la `PreparacionPedido` de los pedidos que están en el tablero y
 * todavía no tienen registro.
 *
 * Perezoso a propósito: la pertenencia al tablero se deriva de la etapa del
 * pedido, y `flujoVentaEtapaId` se escribe desde cuatro lugares distintos —
 * dos de los cuales crean el pedido ya en su etapa inicial, sin pasar por el
 * motor de etapas. Con un hook en el motor, un pedido creado directamente en
 * "Confirmado" nunca entraría al tablero (research.md Decisión 1).
 *
 * Idempotente: `createMany` con `skipDuplicates` sobre `pedidoId @unique`.
 */
export async function asegurarPreparacionesPedidos(
  instanciaId: string,
  pedidoIds: string[],
): Promise<void> {
  if (pedidoIds.length === 0) return;

  const flujo = await asegurarFlujoPreparacion(instanciaId);
  const estadoInicial = flujo.estados.find((e) => e.esInicial) ?? flujo.estados[0];
  if (!estadoInicial) return;

  const yaTienen = await prisma.preparacionPedido.findMany({
    where: { pedidoId: { in: pedidoIds } },
    select: { pedidoId: true },
  });
  const existentes = new Set(yaTienen.map((p) => p.pedidoId));
  const faltantes = pedidoIds.filter((id) => !existentes.has(id));
  if (faltantes.length === 0) return;

  const iniciadaEn = iniciadaEnAlMaterializar({
    algunEstadoMarcaInicio: flujo.estados.some((e) => e.marcaInicio),
    estadoInicialMarcaInicio: estadoInicial.marcaInicio,
    ahora: new Date(),
  });

  await prisma.preparacionPedido.createMany({
    data: faltantes.map((pedidoId) => ({
      pedidoId,
      estadoId: estadoInicial.id,
      iniciadaEn,
    })),
    skipDuplicates: true,
  });
}

/** Igual que el anterior, para un solo pedido — devuelve la preparación lista
 *  para mover. */
export async function asegurarPreparacionPedido(
  pedidoId: string,
  instanciaId: string,
): Promise<{ id: string; estadoId: string } | null> {
  await asegurarPreparacionesPedidos(instanciaId, [pedidoId]);
  return prisma.preparacionPedido.findUnique({
    where: { pedidoId },
    select: { id: true, estadoId: true },
  });
}

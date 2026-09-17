import type { Prisma } from "@/generated/prisma/client";

export interface EtapaEntradaConfigurada {
  flujoVentaEtapaId: string;
  flujoVentaEtapa: { id: string; nombre: string; color: string | null; activo: boolean } | null;
}

/**
 * Condición de pertenencia al tablero, derivada de la etapa del pedido.
 *
 * Se deriva a propósito en vez de mantener una bandera: `flujoVentaEtapaId` se
 * escribe desde cuatro lugares distintos (motor de etapas, ejecutor de
 * disparadores, conversión de cotización y creación manual de pedido), y dos de
 * ellos asignan la etapa inicial al CREAR el pedido, sin pasar por el motor.
 * Con una bandera, un pedido creado directamente en "Confirmado" nunca
 * aparecería en el tablero (research.md Decisión 1).
 *
 * Sin etapas de entrada configuradas, el default es: entran los pedidos cuya
 * etapa no es final ni de cancelación.
 */
export function construirWhereEntrada(
  instanciaId: string,
  entradas: EtapaEntradaConfigurada[],
): Prisma.PedidoWhereInput {
  const etapasActivas = entradas
    .filter((e) => e.flujoVentaEtapa?.activo)
    .map((e) => e.flujoVentaEtapaId);

  if (etapasActivas.length > 0) {
    return { instanciaId, flujoVentaEtapaId: { in: etapasActivas } };
  }

  // Default: cualquier etapa que no cierre ni cancele el pedido. Los pedidos
  // sin etapa (instancias sin flujo dinámico) entran por el enum legacy.
  return {
    instanciaId,
    OR: [
      { flujoVentaEtapa: { is: { esFinal: false, esCancelacion: false, activo: true } } },
      { flujoVentaEtapaId: null, estado: { notIn: ["ENTREGADO", "CANCELADO"] } },
    ],
  };
}

/** Etapas configuradas como entrada que ya no sirven: eliminadas del flujo o
 *  desactivadas. El tablero no se rompe; la configuración lo avisa (FR-009). */
export function detectarEntradasInvalidas(entradas: EtapaEntradaConfigurada[]): string[] {
  return entradas
    .filter((e) => !e.flujoVentaEtapa || !e.flujoVentaEtapa.activo)
    .map((e) => e.flujoVentaEtapa?.nombre ?? e.flujoVentaEtapaId);
}

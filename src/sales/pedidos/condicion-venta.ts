import type { Prisma } from "@/generated/prisma/client";

/**
 * Condiciones de población de los KPIs del listado, derivadas de la
 * configuración vigente del Flujo de Venta.
 *
 * Viven en su propio módulo —sin importar Prisma en runtime, solo su tipo—
 * por el mismo motivo que `construirWhereEntrada` en Preparación
 * (src/sales/preparacion/utils/entrada.ts): son funciones puras y así se
 * prueban como tales, sin doble de base de datos.
 *
 * El punto central de 038: `cuentaComoVenta` se LEE ACÁ en cada consulta y
 * nunca se copia al Pedido. Por eso marcar o desmarcar una etapa se refleja
 * en los totales en el siguiente render, sin recálculo ni migración (FR-008).
 * Si alguna vez aparece la tentación de materializarlo "para optimizar", se
 * pierde esa garantía entera.
 */
export interface EtapaParaKpis {
  id: string;
  esFinal: boolean;
  esCancelacion: boolean;
  cuentaComoVenta: boolean;
}

/**
 * Pedidos que cuentan como venta: los que están en una etapa marcada
 * `cuentaComoVenta`.
 *
 * Sin flujo dinámico (arreglo vacío) cae al enum legacy, igual que antes de
 * 038 — esas instancias no cambian de comportamiento (FR-010).
 *
 * Con flujo dinámico pero ninguna etapa marcada, `in: []` no matchea ninguna
 * fila y los totales dan 0 (FR-009). Es a propósito y NO debe "simplificarse"
 * a un objeto vacío: eso haría que los totales volvieran a sumar todos los
 * pedidos, que es exactamente el problema que 038 corrige.
 */
export function construirCondicionVenta(etapasFlujo: EtapaParaKpis[]): Prisma.PedidoWhereInput {
  if (etapasFlujo.length === 0) return { estado: "ENTREGADO" };

  const idsVenta = etapasFlujo.filter((e) => e.cuentaComoVenta).map((e) => e.id);
  return { flujoVentaEtapaId: { in: idsVenta } };
}

/**
 * Pedidos todavía abiertos: ni cerrados ni cancelados. Es la población de las
 * tarjetas "Pendientes" y "Expirados".
 *
 * Se usa el enum `estado` solo cuando no hay flujo dinámico: con flujo, ese
 * enum queda congelado desde la creación del pedido y no sirve para esto (ver
 * motor.ts:_moverInterno, que solo actualiza `flujoVentaEtapaId`).
 */
export function construirCondicionAbiertos(etapasFlujo: EtapaParaKpis[]): Prisma.PedidoWhereInput {
  if (etapasFlujo.length === 0) return { estado: { notIn: ["ENTREGADO", "CANCELADO"] } };

  const idsCerrados = etapasFlujo.filter((e) => e.esFinal || e.esCancelacion).map((e) => e.id);
  // Sin etapas de cierre configuradas, todos los pedidos están abiertos.
  return idsCerrados.length > 0 ? { flujoVentaEtapaId: { notIn: idsCerrados } } : {};
}

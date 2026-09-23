import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  diferenciaConsumo,
  expandirConsumo,
  validarDeltas,
  type ComponenteSnapshot,
  type Consumo,
  type LineaConsumo,
  type StockProducto,
} from "./inventario";

// Acepta el cliente global o el `tx` de una transacción: el pedido generado
// desde una cotización descuenta dentro de su transacción; crear/editar
// pedido lo siguen haciendo fuera (mismo comportamiento que antes de 029).
type Db = Prisma.TransactionClient;

export interface ComposicionCombo {
  nombre: string;
  componentes: ComponenteSnapshot[];
}

/** Composición vigente de los combos entre `productoIds`, solo de la instancia. */
export async function cargarComposiciones(
  productoIds: (string | null | undefined)[],
  instanciaId: string,
  db: Db,
): Promise<Map<string, ComposicionCombo>> {
  const ids = [...new Set(productoIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();

  const combos = await db.producto.findMany({
    where: { id: { in: ids }, instanciaId, esCombo: true },
    select: {
      id: true,
      nombre: true,
      componentes: {
        where: { componente: { instanciaId } },
        select: { cantidad: true, componente: { select: { id: true, nombre: true } } },
      },
    },
  });

  return new Map(
    combos.map((c) => [
      c.id,
      {
        nombre: c.nombre,
        componentes: c.componentes.map((k) => ({ productoId: k.componente.id, nombre: k.componente.nombre, cantidad: k.cantidad })),
      },
    ]),
  );
}

/** Líneas nuevas: si su producto es combo, llevan la composición vigente. */
export function lineasConComposicionActual(
  lineas: { productoId?: string | null; cantidad: number }[],
  composiciones: Map<string, ComposicionCombo>,
): LineaConsumo[] {
  return lineas.map((l) => {
    const combo = l.productoId ? composiciones.get(l.productoId) : undefined;
    return {
      productoId: l.productoId || null,
      cantidad: l.cantidad,
      nombre: combo?.nombre,
      composicion: combo?.componentes ?? null,
    };
  });
}

/** Valor a guardar en PedidoLinea.composicionCombo al crear una línea. */
export function snapshotComposicion(
  productoId: string | null | undefined,
  composiciones: Map<string, ComposicionCombo>,
): Prisma.InputJsonValue | undefined {
  const componentes = productoId ? composiciones.get(productoId)?.componentes : undefined;
  return componentes ? componentes.map((c) => ({ productoId: c.productoId, nombre: c.nombre, cantidad: c.cantidad })) : undefined;
}

/** Composición guardada en una línea de pedido (snapshot), o null. */
export function parsearComposicion(valor: unknown): ComponenteSnapshot[] | null {
  if (!Array.isArray(valor)) return null;
  const lista = valor.filter(
    (c): c is ComponenteSnapshot =>
      typeof c === "object" && c !== null && typeof c.productoId === "string" && typeof c.cantidad === "number",
  );
  return lista.length > 0 ? lista : null;
}

export async function cargarStock(productoIds: Iterable<string>, db: Db): Promise<Map<string, StockProducto>> {
  const ids = [...new Set(productoIds)];
  if (ids.length === 0) return new Map();
  const productos = await db.producto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true },
  });
  return new Map(
    productos.map((p) => [p.id, { nombre: p.nombre, manejaStock: p.manejaStock, cantidadDisponible: Number(p.cantidadDisponible) }]),
  );
}

export interface PlanStock {
  deltas: Map<string, { delta: number; origenes: string[] }>;
  stock: Map<string, StockProducto>;
  errores: string[];
}

/** Calcula y valida el movimiento de stock entre dos estados de un documento. */
export async function planificarStock(anterior: LineaConsumo[], nuevo: LineaConsumo[], db: Db): Promise<PlanStock> {
  const consumoAnterior: Map<string, Consumo> = expandirConsumo(anterior);
  const deltas = diferenciaConsumo(consumoAnterior, expandirConsumo(nuevo));
  const stock = await cargarStock(deltas.keys(), db);
  return { deltas, stock, errores: validarDeltas(deltas, stock, consumoAnterior) };
}

/** Aplica los deltas solo a productos con control de stock. */
export async function aplicarDeltas(plan: Pick<PlanStock, "deltas" | "stock">, db: Db): Promise<void> {
  const operaciones: Promise<unknown>[] = [];
  for (const [id, { delta }] of plan.deltas) {
    if (!plan.stock.get(id)?.manejaStock) continue;
    operaciones.push(
      db.producto.update({
        where: { id },
        data: { cantidadDisponible: delta > 0 ? { decrement: delta } : { increment: -delta } },
      }),
    );
  }
  if (operaciones.length > 0) await Promise.all(operaciones);
}

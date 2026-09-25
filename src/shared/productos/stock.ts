// Sin `import "server-only"`: el worker (tsx, fuera de Next) importa este
// módulo vía generar-pedido-desde-cotizacion.service, y ahí el paquete no
// existe — el worker entero no arrancaba y dejaba de procesar mensajes.
import type { Prisma } from "@/generated/prisma/client";
import {
  claveStockVariante,
  diferenciaConsumo,
  expandirConsumo,
  PREFIJO_VARIANTE,
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
  lineas: { productoId?: string | null; varianteId?: string | null; cantidad: number }[],
  composiciones: Map<string, ComposicionCombo>,
): LineaConsumo[] {
  return lineas.map((l) => {
    const combo = l.productoId ? composiciones.get(l.productoId) : undefined;
    return {
      productoId: l.productoId || null,
      varianteId: l.varianteId || null,
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

/**
 * Stock de las claves de consumo: ids de producto y `variante:<id>` (030).
 * Una variante controla stock si su producto lo hace. Un producto con
 * variantes se informa sin control de stock: su `cantidadDisponible` dejó de
 * ser la fuente de verdad (quedó repartido en las variantes al convertirlo),
 * así que ninguna línea sin variante puede moverlo.
 */
export async function cargarStock(claves: Iterable<string>, db: Db): Promise<Map<string, StockProducto>> {
  const todas = [...new Set(claves)];
  if (todas.length === 0) return new Map();
  const idsVariante = todas.filter((c) => c.startsWith(PREFIJO_VARIANTE)).map((c) => c.slice(PREFIJO_VARIANTE.length));
  const idsProducto = todas.filter((c) => !c.startsWith(PREFIJO_VARIANTE));

  const [productos, variantes] = await Promise.all([
    idsProducto.length > 0
      ? db.producto.findMany({
          where: { id: { in: idsProducto } },
          select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true, tieneVariantes: true },
        })
      : [],
    idsVariante.length > 0
      ? db.productoVariante.findMany({
          where: { id: { in: idsVariante } },
          select: { id: true, nombre: true, cantidadDisponible: true, producto: { select: { nombre: true, manejaStock: true } } },
        })
      : [],
  ]);

  const stock = new Map<string, StockProducto>();
  for (const p of productos) {
    stock.set(p.id, {
      nombre: p.nombre,
      manejaStock: p.manejaStock && !p.tieneVariantes,
      cantidadDisponible: Number(p.cantidadDisponible),
    });
  }
  for (const v of variantes) {
    stock.set(claveStockVariante(v.id), {
      nombre: `${v.producto.nombre} — ${v.nombre}`,
      manejaStock: v.producto.manejaStock,
      cantidadDisponible: Number(v.cantidadDisponible),
    });
  }
  return stock;
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
    const data = { cantidadDisponible: delta > 0 ? { decrement: delta } : { increment: -delta } };
    operaciones.push(
      id.startsWith(PREFIJO_VARIANTE)
        ? db.productoVariante.update({ where: { id: id.slice(PREFIJO_VARIANTE.length) }, data })
        : db.producto.update({ where: { id }, data }),
    );
  }
  if (operaciones.length > 0) await Promise.all(operaciones);
}

// ── 030-variantes-producto — validación de variantes en líneas de venta ────

export interface LineaConVariante {
  productoId?: string | null;
  varianteId?: string | null;
}

/** Par producto+variante de una línea, para comparar contra lo ya guardado. */
export const parLinea = (l: LineaConVariante) => `${l.productoId || ""}|${l.varianteId || ""}`;

/**
 * Nunca se confía en la selección del cliente: una variante tiene que ser de
 * ese producto (y de la instancia), estar activa, y un producto con variantes
 * no se vende sin elegir una. Las líneas cuyo par producto+variante ya estaba
 * guardado (`existentes`) se aceptan tal cual aunque la variante esté hoy
 * inactiva o el producto haya activado variantes después: son historial.
 *
 * Devuelve el nombre vigente de cada variante usada, para el snapshot.
 */
export async function validarVariantesLineas(
  lineas: LineaConVariante[],
  params: { instanciaId: string; existentes?: Set<string> },
  db: Db,
): Promise<{ error: string | null; nombres: Map<string, string> }> {
  const nombres = new Map<string, string>();
  const aValidar = lineas.filter((l) => l.productoId && !params.existentes?.has(parLinea(l)));
  const existentesConVariante = lineas.filter((l) => l.varianteId && params.existentes?.has(parLinea(l)));
  if (aValidar.length === 0 && existentesConVariante.length === 0) return { error: null, nombres };

  const productoIds = [...new Set(aValidar.map((l) => l.productoId!))];
  const varianteIds = [...new Set(lineas.map((l) => l.varianteId).filter((id): id is string => !!id))];

  const [productos, variantes] = await Promise.all([
    productoIds.length > 0
      ? db.producto.findMany({
          where: { id: { in: productoIds }, instanciaId: params.instanciaId },
          select: { id: true, nombre: true, tieneVariantes: true },
        })
      : [],
    varianteIds.length > 0
      ? db.productoVariante.findMany({
          where: { id: { in: varianteIds }, producto: { instanciaId: params.instanciaId } },
          select: { id: true, nombre: true, activo: true, productoId: true },
        })
      : [],
  ]);
  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const variantePorId = new Map(variantes.map((v) => [v.id, v]));
  for (const v of variantes) nombres.set(v.id, v.nombre);

  for (const linea of aValidar) {
    const producto = productoPorId.get(linea.productoId!);
    // Producto inexistente o de otra instancia: se mantiene el comportamiento
    // previo (la línea no mueve stock), no es un caso de variantes.
    if (!producto) continue;

    if (!producto.tieneVariantes) {
      if (linea.varianteId) return { error: `«${producto.nombre}» no tiene variantes`, nombres };
      continue;
    }
    if (!linea.varianteId) return { error: `Selecciona una variante de «${producto.nombre}»`, nombres };
    const variante = variantePorId.get(linea.varianteId);
    if (!variante || variante.productoId !== producto.id) {
      return { error: `La variante seleccionada no pertenece a «${producto.nombre}»`, nombres };
    }
    if (!variante.activo) return { error: `La variante «${variante.nombre}» de «${producto.nombre}» no está activa`, nombres };
  }
  return { error: null, nombres };
}

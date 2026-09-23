// 029-combos-productos-compuestos — reglas puras de inventario (sin I/O).
//
// Antes, cada punto que mueve stock (crear pedido, editar pedido, aprobar
// cotización, generar pedido desde cotización) repetía su propio chequeo y
// descuento por línea. Ahora todos traducen sus líneas a "consumo por
// producto" con estas funciones y aplican la diferencia: un combo se expande
// en sus componentes y el combo en sí nunca mueve stock.

export interface ComponenteSnapshot {
  productoId: string;
  nombre: string;
  cantidad: number;
}

export interface LineaConsumo {
  productoId: string | null;
  cantidad: number;
  /** Composición del combo de esta línea. null = consume su propio producto. */
  composicion: ComponenteSnapshot[] | null;
  /** Nombre del producto de la línea, para decir de qué combo viene la demanda. */
  nombre?: string;
}

export interface Consumo {
  cantidad: number;
  /** Nombres de los combos que generan parte de esta demanda. */
  origenes: string[];
}

export interface StockProducto {
  nombre: string;
  manejaStock: boolean;
  cantidadDisponible: number;
}

export function expandirConsumo(lineas: LineaConsumo[]): Map<string, Consumo> {
  const consumo = new Map<string, Consumo>();
  const sumar = (productoId: string, cantidad: number, origen?: string) => {
    const actual = consumo.get(productoId) ?? { cantidad: 0, origenes: [] };
    actual.cantidad += cantidad;
    if (origen && !actual.origenes.includes(origen)) actual.origenes.push(origen);
    consumo.set(productoId, actual);
  };

  for (const linea of lineas) {
    if (linea.composicion && linea.composicion.length > 0) {
      for (const c of linea.composicion) sumar(c.productoId, linea.cantidad * c.cantidad, linea.nombre);
    } else if (linea.productoId) {
      sumar(linea.productoId, linea.cantidad);
    }
  }
  return consumo;
}

/** delta > 0 = descontar; delta < 0 = devolver. Omite los productos sin cambio. */
export function diferenciaConsumo(
  anterior: Map<string, Consumo>,
  nuevo: Map<string, Consumo>,
): Map<string, { delta: number; origenes: string[] }> {
  const deltas = new Map<string, { delta: number; origenes: string[] }>();
  for (const id of new Set([...anterior.keys(), ...nuevo.keys()])) {
    const delta = (nuevo.get(id)?.cantidad ?? 0) - (anterior.get(id)?.cantidad ?? 0);
    if (delta === 0) continue;
    deltas.set(id, { delta, origenes: nuevo.get(id)?.origenes ?? anterior.get(id)?.origenes ?? [] });
  }
  return deltas;
}

/**
 * Mensajes de stock insuficiente. Mantiene el formato de siempre para un
 * producto común ("solicitado" si no había consumo previo, "adicional
 * requerido" si lo había), y nombra el combo cuando la demanda viene de uno.
 */
export function validarDeltas(
  deltas: Map<string, { delta: number; origenes: string[] }>,
  stock: Map<string, StockProducto>,
  anterior: Map<string, Consumo> = new Map(),
): string[] {
  const errores: string[] = [];
  for (const [id, { delta, origenes }] of deltas) {
    if (delta <= 0) continue;
    const producto = stock.get(id);
    if (!producto?.manejaStock) continue;
    if (producto.cantidadDisponible >= delta) continue;

    const deCombo = origenes.length > 0 ? ` (componente de ${origenes.map((o) => `"${o}"`).join(", ")})` : "";
    const etiqueta = (anterior.get(id)?.cantidad ?? 0) > 0 ? "adicional requerido" : "solicitado";
    errores.push(
      `Stock insuficiente para "${producto.nombre}"${deCombo}. Disponible: ${producto.cantidadDisponible} — ${etiqueta}: ${delta}`,
    );
  }
  return errores;
}

export interface ComponenteParaDisponibilidad {
  cantidad: number;
  manejaStock: boolean;
  cantidadDisponible: number;
  activo: boolean;
}

/**
 * Unidades del combo que se pueden armar: MIN(⌊stock / cantidad⌋) sobre los
 * componentes con control de stock. null = ningún componente controla stock.
 * Un componente inactivo impide armar el combo (0).
 */
export function calcularDisponibilidadCombo(componentes: ComponenteParaDisponibilidad[]): number | null {
  if (componentes.length === 0) return 0;
  if (componentes.some((c) => !c.activo)) return 0;

  const conStock = componentes.filter((c) => c.manejaStock);
  if (conStock.length === 0) return null;

  return Math.max(
    0,
    Math.min(...conStock.map((c) => Math.floor(Math.max(0, c.cantidadDisponible) / Math.max(1, c.cantidad)))),
  );
}

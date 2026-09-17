export interface LineaConAvance {
  cantidad: number;
  cantidadPreparada: number;
}

/** Una línea está completa cuando lo preparado alcanza lo pedido. */
export function lineaCompleta(linea: LineaConAvance): boolean {
  if (linea.cantidad <= 0) return true;
  return linea.cantidadPreparada >= linea.cantidad;
}

/**
 * Avance del pedido: derivado de sus líneas, nunca persistido.
 *
 * Guardarlo en el pedido sería un segundo lugar que se puede desincronizar —
 * y se desincronizaría justo en el caso que importa: al editar el pedido y
 * agregarle una línea nueva (data-model.md, `PedidoLinea`).
 */
export function pedidoCompleto(lineas: LineaConAvance[]): boolean {
  if (lineas.length === 0) return false;
  return lineas.every(lineaCompleta);
}

/** Unidades pedidas vs. preparadas, para el resumen y los totales de la tarjeta. */
export function totalizarAvance(lineas: LineaConAvance[]): {
  unidadesRequeridas: number;
  unidadesPreparadas: number;
  lineasCompletas: number;
} {
  return lineas.reduce(
    (acc, l) => ({
      unidadesRequeridas: acc.unidadesRequeridas + l.cantidad,
      unidadesPreparadas: acc.unidadesPreparadas + Math.min(l.cantidadPreparada, l.cantidad),
      lineasCompletas: acc.lineasCompletas + (lineaCompleta(l) ? 1 : 0),
    }),
    { unidadesRequeridas: 0, unidadesPreparadas: 0, lineasCompletas: 0 },
  );
}

export type ValidacionAvance =
  | { valido: true }
  | { valido: false; error: string };

/** Techo del avance: no se puede preparar más de lo pedido (FR-029). */
export function validarCantidadPreparada(cantidadPreparada: number, cantidadPedida: number): ValidacionAvance {
  if (Number.isNaN(cantidadPreparada)) return { valido: false, error: "La cantidad preparada no es un número" };
  if (cantidadPreparada < 0) return { valido: false, error: "La cantidad preparada no puede ser negativa" };
  if (cantidadPreparada > cantidadPedida) {
    return {
      valido: false,
      error: `No se puede preparar ${cantidadPreparada} de una línea de ${cantidadPedida} unidades`,
    };
  }
  return { valido: true };
}

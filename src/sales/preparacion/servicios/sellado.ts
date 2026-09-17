/**
 * Reglas de sellado de fechas y responsable de una preparación.
 *
 * Vive separado del motor (y sin importar Prisma) para que las reglas se puedan
 * testear como lo que son: una función pura. La tabla de verdad está en
 * `data-model.md` → "Transiciones de estado".
 */

export interface EstadoDestino {
  id: string;
  nombre: string;
  marcaInicio: boolean;
  esFinal: boolean;
}

export interface PreparacionActual {
  estadoId: string;
  iniciadaEn: Date | null;
  completadaEn: Date | null;
  asignadaAId: string | null;
  /** Nombre del estado en el que está hoy — va al historial como origen. */
  estadoNombre: string | null;
  estadoActualEsFinal: boolean;
}

export interface Sellado {
  iniciadaEn: Date | null;
  completadaEn: Date | null;
  asignadaAId: string | null;
  /** True solo en la transición que sella el inicio — dispara el evento. */
  sellaInicio: boolean;
  /** True solo al entrar al estado final — dispara el evento. */
  completa: boolean;
  /** True al salir del estado final: se limpian fin y responsable. */
  reabre: boolean;
}

export function calcularSellado(params: {
  actual: PreparacionActual;
  destino: EstadoDestino;
  usuarioId: string | null;
  ahora: Date;
}): Sellado {
  const { actual, destino, usuarioId, ahora } = params;

  // El inicio es el primero, no el último: una vez sellado no se re-sella,
  // aunque el pedido vuelva a pasar por el estado que lo marca.
  const sellaInicio = destino.marcaInicio && actual.iniciadaEn === null;
  const iniciadaEn = sellaInicio ? ahora : actual.iniciadaEn;

  if (destino.esFinal) {
    return {
      iniciadaEn,
      completadaEn: ahora,
      asignadaAId: usuarioId,
      sellaInicio,
      completa: true,
      reabre: false,
    };
  }

  // Retroceso desde el estado final: se limpian fin y responsable. El historial
  // conserva ambos movimientos, así que no se pierde quién lo había cerrado.
  const reabre = actual.estadoActualEsFinal;

  return {
    iniciadaEn,
    completadaEn: reabre ? null : actual.completadaEn,
    asignadaAId: reabre ? null : actual.asignadaAId,
    sellaInicio,
    completa: false,
    reabre,
  };
}

/** Inicio al materializarse la preparación: si ningún estado marca el inicio,
 *  se sella al entrar al tablero para que `iniciadaEn` nunca quede vacía en
 *  flujos de dos estados (FR-013). */
export function iniciadaEnAlMaterializar(params: {
  algunEstadoMarcaInicio: boolean;
  estadoInicialMarcaInicio: boolean;
  ahora: Date;
}): Date | null {
  if (params.estadoInicialMarcaInicio) return params.ahora;
  if (!params.algunEstadoMarcaInicio) return params.ahora;
  return null;
}

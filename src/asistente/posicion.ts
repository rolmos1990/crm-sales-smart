/**
 * Geometría del asistente flotante arrastrable. Pura (sin DOM) para poder
 * testearla: el componente le pasa medidas reales de la ventana y del botón.
 */

export type Posicion = { x: number; y: number };
export type Tamano = { ancho: number; alto: number };

/** Distancia mínima a los bordes de la ventana, en px. */
export const MARGEN_BORDE = 8;

/** Por debajo de este desplazamiento un gesto es un clic, no un arrastre. */
export const UMBRAL_ARRASTRE_PX = 5;

/** Paso de las flechas del teclado (con Shift, ×4). */
export const PASO_TECLADO_PX = 16;

export function limitarPosicion(pos: Posicion, boton: Tamano, ventana: Tamano): Posicion {
  const maxX = Math.max(MARGEN_BORDE, ventana.ancho - boton.ancho - MARGEN_BORDE);
  const maxY = Math.max(MARGEN_BORDE, ventana.alto - boton.alto - MARGEN_BORDE);
  return {
    x: Math.min(Math.max(pos.x, MARGEN_BORDE), maxX),
    y: Math.min(Math.max(pos.y, MARGEN_BORDE), maxY),
  };
}

export function superaUmbral(desde: Posicion, hasta: Posicion) {
  return Math.hypot(hasta.x - desde.x, hasta.y - desde.y) >= UMBRAL_ARRASTRE_PX;
}

/** Valida lo leído de localStorage: puede venir corrupto o de otra versión. */
export function parsearPosicion(crudo: string | null): Posicion | null {
  if (!crudo) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    if (
      typeof valor === "object" &&
      valor !== null &&
      "x" in valor &&
      "y" in valor &&
      Number.isFinite(valor.x) &&
      Number.isFinite(valor.y)
    ) {
      return { x: valor.x as number, y: valor.y as number };
    }
  } catch {
    // JSON inválido: se vuelve a la posición por defecto.
  }
  return null;
}

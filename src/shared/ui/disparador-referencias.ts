// Decide si el menú de referencias `@` debe estar abierto y con qué filtro,
// mirando solo el texto y la posición del cursor. Separado del componente
// porque es lógica pura: es donde se rompe la UX si se toca y donde van los
// tests.

export interface DisparadorReferencia {
  /** Lo escrito entre el `@` y el cursor — el filtro del menú. */
  consulta: string;
  /** Índice del `@`, para saber desde dónde reemplazar al insertar. */
  inicio: number;
}

export function consultaActiva(valor: string, cursor: number): DisparadorReferencia | null {
  const antes = valor.slice(0, cursor);
  const inicio = antes.lastIndexOf("@");
  if (inicio === -1) return null;

  // Un `@` pegado a una palabra es un email o un handle, no un disparador.
  const anterior = inicio > 0 ? antes[inicio - 1] : " ";
  if (/[\w@]/.test(anterior)) return null;

  const consulta = antes.slice(inicio + 1);
  // Cualquier espacio o salto de línea cierra el menú: las claves no los tienen.
  if (/\s/.test(consulta)) return null;

  return { consulta, inicio };
}

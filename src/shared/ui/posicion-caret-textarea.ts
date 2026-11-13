// Coordenadas de viewport del cursor dentro de un <textarea>.
//
// `window.getSelection()` —lo que usa getCaretViewportPos en
// editor-contenido-plantilla.tsx— no funciona sobre un textarea: su contenido
// no son nodos del DOM. La técnica estándar es un div espejo: se clona el
// textarea con sus mismos estilos de layout, se le mete el texto hasta el
// cursor y se mide dónde quedó.

// Propiedades que afectan dónde cae un carácter. Si el espejo no las copia,
// la medición se desfasa.
const PROPIEDADES_ESPEJO = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
] as const;

export interface PosicionCaret {
  /** Coordenada del cursor dentro del textarea, relativa al viewport. */
  top: number;
  left: number;
  /** Alto de la línea — para no tapar el texto al abrir el menú debajo. */
  altoLinea: number;
}

export function posicionCaretTextarea(
  textarea: HTMLTextAreaElement,
  posicion: number,
): PosicionCaret {
  const estilos = window.getComputedStyle(textarea);
  const espejo = document.createElement("div");

  for (const prop of PROPIEDADES_ESPEJO) {
    espejo.style[prop] = estilos[prop];
  }
  espejo.style.position = "absolute";
  espejo.style.visibility = "hidden";
  espejo.style.top = "0";
  espejo.style.left = "-9999px";
  espejo.style.height = "auto";
  espejo.style.overflow = "hidden";
  // El textarea siempre envuelve; sin esto el espejo mediría todo en una línea.
  if (estilos.whiteSpace === "normal") espejo.style.whiteSpace = "pre-wrap";

  espejo.textContent = textarea.value.slice(0, posicion);

  // Un <span> vacío colapsa y no se puede medir; el zero-width space le da
  // una caja real sin alterar el ancho del texto que lo precede.
  const marcador = document.createElement("span");
  marcador.textContent = "​";
  espejo.appendChild(marcador);

  document.body.appendChild(espejo);
  const offsetTop = marcador.offsetTop;
  const offsetLeft = marcador.offsetLeft;
  const altoLinea = marcador.offsetHeight || parseFloat(estilos.lineHeight) || 16;
  document.body.removeChild(espejo);

  const caja = textarea.getBoundingClientRect();

  return {
    top: caja.top + offsetTop - textarea.scrollTop,
    left: caja.left + offsetLeft - textarea.scrollLeft,
    altoLinea,
  };
}

/**
 * Coloca un menú junto al cursor sin que se salga de la pantalla: debajo si
 * entra, arriba si no. Mismo criterio que getCaretViewportPos.
 */
export function ubicarMenuJuntoAlCaret(
  caret: PosicionCaret,
  ancho: number,
  alto: number,
): { top: number; left: number } {
  const espacioAbajo = window.innerHeight - (caret.top + caret.altoLinea);
  const top =
    espacioAbajo >= alto + 12
      ? caret.top + caret.altoLinea + 4
      : caret.top - alto - 4;

  return {
    top: Math.max(8, top),
    left: Math.max(8, Math.min(caret.left, window.innerWidth - ancho - 12)),
  };
}

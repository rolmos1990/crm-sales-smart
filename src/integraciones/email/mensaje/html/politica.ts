// 035 — Política de limpieza del HTML de un correo entrante.
//
// Es una LISTA BLANCA: lo que no está acá, se descarta. Cambiar algo de este
// archivo cambia la superficie de ataque de Karia; cualquier ampliación exige
// su caso en limpiar-html.test.ts y subir VERSION_POLITICA.
//
// Apto para el worker: nada de `server-only` ni de Next
// (src/worker/grafo-importaciones.test.ts).
import type { IOptions } from "sanitize-html";

/** Se guarda con cada correo: indica con qué política se generó su HTML. */
export const VERSION_POLITICA = 1;

// ─── Límites (research.md R3) ────────────────────────────────────────────────
export const MAX_BYTES_HTML_ENTRADA = 1_048_576;
export const MAX_BYTES_HTML_LIMPIO = 524_288;
/** Más hondo que esto, las etiquetas se descartan y se conserva su texto. */
export const PROFUNDIDAD_ANIDAMIENTO = 64;
/** Más hondo que esto, el correo se considera hostil y no se muestra con formato. */
export const PROFUNDIDAD_MAXIMA_RECHAZO = 2000;
export const MAX_MS_LIMPIEZA = 2000;
export const MAX_IMAGENES_EXTERNAS = 50;

/** Atributo con el que una imagen remota queda marcada como bloqueada. */
export const ATRIBUTO_IMAGEN_EXTERNA = "data-karia-externa";

const ETIQUETAS_PERMITIDAS = [
  // Estructura y texto
  "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "b", "strong", "i", "em", "u", "s", "strike", "small", "big", "sub", "sup", "center", "font",
  "abbr", "address", "cite", "q", "mark", "del", "ins", "wbr",
  // Listas
  "ul", "ol", "li", "dl", "dt", "dd",
  // Tablas: el correo comercial se maqueta con tablas.
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  // Enlaces e imágenes
  "a", "img",
];

// Atributos de presentación heredados de HTML 4: los clientes de correo los
// siguen usando porque Outlook ignora buena parte del CSS.
const PRESENTACION = [
  "align", "valign", "width", "height", "bgcolor", "color", "border",
  "cellpadding", "cellspacing", "colspan", "rowspan", "dir", "lang", "title",
  "face", "size", "style",
];

// ─── Estilos en línea ────────────────────────────────────────────────────────
// Cada propiedad lleva una regex sobre su VALOR. Ningún valor puede contener
// paréntesis salvo los de color (rgb/rgba/hsl/hsla), y ninguno puede contener
// `\`, `:`, `@`, `/*`, comillas ni `<`: eso deja afuera url(), expression(),
// image-set(), @import, escapes CSS y `javascript:`.
const LONGITUD = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|pt|pc|cm|mm|in|ex|ch|vw|vh)?$/i;
const LONGITUDES = /^(?:-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|pt|pc|cm|mm|in|ex|ch|vw|vh)?|auto)(?:\s+(?:-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|pt|pc|cm|mm|in|ex|ch|vw|vh)?|auto)){0,3}$/i;
const COLOR =
  /^(?:#[0-9a-f]{3,8}|[a-z]{3,30}|rgba?\(\s*[\d.%\s,/]+\)|hsla?\(\s*[\d.%\s,/deg]+\))$/i;
const BORDE =
  /^(?:(?:-?\d+(?:\.\d+)?(?:px|em|rem|pt)?|thin|medium|thick|none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset|#[0-9a-f]{3,8}|[a-z]{3,30}|rgba?\(\s*[\d.%\s,/]+\))\s*){1,4}$/i;
const FUENTE = /^[a-z0-9\s,'"-]{1,200}$/i;
const PALABRA = /^[a-z-]{1,30}$/i;

const ESTILOS: Record<string, RegExp[]> = {
  color: [COLOR],
  "background-color": [COLOR],
  background: [COLOR],
  "font-family": [FUENTE],
  "font-size": [LONGITUD, /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/i],
  "font-weight": [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
  "font-style": [/^(?:normal|italic|oblique)$/i],
  "font-variant": [PALABRA],
  "text-align": [/^(?:left|right|center|justify|start|end)$/i],
  "text-decoration": [/^(?:none|underline|overline|line-through)(?:\s+[a-z#0-9]+){0,2}$/i],
  "text-transform": [/^(?:none|uppercase|lowercase|capitalize)$/i],
  "text-indent": [LONGITUD],
  "letter-spacing": [LONGITUD, /^normal$/i],
  "line-height": [LONGITUD, /^normal$/i],
  "white-space": [/^(?:normal|nowrap|pre|pre-wrap|pre-line)$/i],
  "word-break": [/^(?:normal|break-all|keep-all|break-word)$/i],
  "vertical-align": [/^(?:baseline|top|middle|bottom|text-top|text-bottom|sub|super)$/i, LONGITUD],
  margin: [LONGITUDES],
  "margin-top": [LONGITUD, /^auto$/i],
  "margin-right": [LONGITUD, /^auto$/i],
  "margin-bottom": [LONGITUD, /^auto$/i],
  "margin-left": [LONGITUD, /^auto$/i],
  padding: [LONGITUDES],
  "padding-top": [LONGITUD],
  "padding-right": [LONGITUD],
  "padding-bottom": [LONGITUD],
  "padding-left": [LONGITUD],
  border: [BORDE],
  "border-top": [BORDE],
  "border-right": [BORDE],
  "border-bottom": [BORDE],
  "border-left": [BORDE],
  "border-color": [BORDE],
  "border-style": [BORDE],
  "border-width": [BORDE],
  "border-radius": [LONGITUDES],
  "border-collapse": [/^(?:collapse|separate)$/i],
  "border-spacing": [LONGITUDES],
  width: [LONGITUD, /^auto$/i],
  "max-width": [LONGITUD, /^none$/i],
  "min-width": [LONGITUD],
  height: [LONGITUD, /^auto$/i],
  "max-height": [LONGITUD, /^none$/i],
  "min-height": [LONGITUD],
  // Sin `position` en la lista: con fixed/absolute/sticky un correo podría
  // superponer contenido (ej. un "inicie sesión de nuevo" falso).
  display: [/^(?:block|inline|inline-block|table|table-row|table-cell|none|list-item)$/i],
  "list-style-type": [PALABRA],
  "table-layout": [/^(?:auto|fixed)$/i],
  overflow: [/^(?:visible|hidden|auto|scroll)$/i],
};

/**
 * Opciones base de sanitize-html. `transformTags` lo agrega cada uso (al recibir
 * y al servir), porque ahí es donde se reescriben imágenes y enlaces.
 *
 * Por qué no se aceptan bloques <style>: sanitize-html limpia atributos de
 * estilo pero NO el contenido de un <style>, que podría traer selectores que
 * imiten la interfaz de Karia o reglas `position: fixed`. El correo comercial
 * pensado para Gmail ya trae los estilos en línea (research.md R2).
 */
export function opcionesBase(): IOptions {
  return {
    allowedTags: ETIQUETAS_PERMITIDAS,
    allowedAttributes: {
      "*": PRESENTACION,
      a: [...PRESENTACION, "href", "target", "rel"],
      img: [...PRESENTACION, "src", "alt"],
      font: [...PRESENTACION],
      td: [...PRESENTACION, "nowrap"],
      th: [...PRESENTACION, "nowrap", "scope"],
      ol: [...PRESENTACION, "start", "type", "reversed"],
      ul: [...PRESENTACION, "type"],
      li: [...PRESENTACION, "value"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "cid"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
    allowedStyles: { "*": ESTILOS },
    // Las etiquetas no permitidas se descartan; su texto se conserva salvo en
    // las que nunca tienen texto legible (script, style, etc.).
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "title", "head", "template", "svg", "math", "xml"],
    allowVulnerableTags: false,
    nestingLimit: PROFUNDIDAD_ANIDAMIENTO,
    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true, decodeEntities: true },
  };
}

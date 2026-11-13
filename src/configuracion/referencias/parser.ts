import {
  TIPOS_REFERENCIA,
  type Referencia,
  type ReferenciaResuelta,
  type TipoReferencia,
} from "./tipos";

// Funciones puras, sin I/O — mismo patrón que decidirCoincidenciaCosto
// (src/shared/entregas/resolver-costo-envio.ts): el caller resuelve contra la
// base y le pasa los datos ya cargados. Es donde vive toda la lógica de
// formato del token, y por eso donde están los tests densos.

/**
 * `@tipo:clave`. La clave admite `-` y `_` porque las dos convenciones
 * conviven: `PlantillaCRM.alias` usa `_` (ver normalizarAlias en
 * plantillas/schema.ts) y `generarSlug` produce `-`.
 *
 * El `(?<![\w@])` evita capturar un token dentro de un email
 * ("juan@plantilla:x" no es una referencia) y un `@@` doble.
 */
const PATRON_REFERENCIA = new RegExp(
  `(?<![\\w@])@(${TIPOS_REFERENCIA.join("|")}):([a-z0-9_-]+)`,
  "g",
);

/** Tope de referencias resueltas por agente — acota cuánto puede crecer el prompt. */
export const MAX_REFERENCIAS = 20;

/** Tope de caracteres del bloque de contenido referenciado completo. */
export const MAX_CARACTERES_CONTENIDO = 4000;

/** true si el texto no puede contener ninguna referencia — evita todo el trabajo. */
export function sinReferencias(texto: string | null | undefined): boolean {
  return !texto || !texto.includes("@");
}

/**
 * Extrae las referencias de un texto, deduplicadas por `tipo:clave` y en el
 * orden en que aparecen.
 */
export function extraerReferencias(texto: string | null | undefined): Referencia[] {
  if (sinReferencias(texto)) return [];

  const vistas = new Set<string>();
  const referencias: Referencia[] = [];

  for (const match of texto!.matchAll(PATRON_REFERENCIA)) {
    const tipo = match[1] as TipoReferencia;
    const clave = match[2];
    const id = `${tipo}:${clave}`;
    if (vistas.has(id)) continue;
    vistas.add(id);
    referencias.push({ tipo, clave, token: `@${id}` });
  }

  return referencias;
}

/**
 * Reemplaza cada token resuelto por su etiqueta entre comillas angulares. Un
 * token sin resolver se deja literal a propósito: romper la frase sería peor
 * que dejar un `@plantilla:x` visible, y el editor ya lo marca en rojo.
 */
export function reemplazarTokens(
  texto: string,
  resueltas: Map<string, ReferenciaResuelta>,
): string {
  return texto.replace(PATRON_REFERENCIA, (token, tipo: string, clave: string) => {
    const resuelta = resueltas.get(`${tipo}:${clave}`);
    return resuelta ? `«${resuelta.etiqueta}»` : token;
  });
}

export function claveDeReferencia(ref: Pick<Referencia, "tipo" | "clave">): string {
  return `${ref.tipo}:${ref.clave}`;
}

/**
 * Bloque que se anexa al final de las instrucciones con el contenido vivo de
 * todo lo referenciado. Va una sola vez por referencia aunque el token
 * aparezca en varios campos.
 */
export function construirBloqueReferencias(resueltas: ReferenciaResuelta[]): string {
  if (resueltas.length === 0) return "";

  const partes: string[] = [];
  let usados = 0;

  for (const r of resueltas) {
    const encabezado = `[${r.etiqueta}]`;
    const disponible = MAX_CARACTERES_CONTENIDO - usados - encabezado.length - 1;
    if (disponible <= 0) break;

    const contenido =
      r.contenido.length > disponible ? `${r.contenido.slice(0, disponible)}…` : r.contenido;
    partes.push(`${encabezado}\n${contenido}`);
    usados += encabezado.length + 1 + contenido.length;
  }

  if (partes.length === 0) return "";

  return [
    "Contenido referenciado (usalo como base, adaptándolo con naturalidad):",
    ...partes,
    "Los marcadores {{...}} que aparezcan ahí son variables: reemplazalos con los datos reales del cliente de este contexto, nunca los dejes literales.",
  ].join("\n");
}

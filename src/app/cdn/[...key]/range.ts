export interface RangoBytes {
  inicio: number;
  fin: number;
}

/**
 * Interpreta un header `Range` de un solo rango (RFC 9110 §14.1.2) contra un
 * archivo de `total` bytes. Sin esto, Safari/iOS no reproduce <video> y ningún
 * navegador puede adelantar sin bajar el archivo entero (048, research.md R4).
 *
 * - `null`: servir el archivo completo (sin header, otra unidad o multi-rango —
 *   que el estándar permite ignorar).
 * - `"INVALIDO"`: el rango no se puede satisfacer → 416.
 */
export function parsearRange(header: string | null, total: number): RangoBytes | "INVALIDO" | null {
  if (!header) return null;
  const valor = header.trim();
  if (!valor.startsWith("bytes=")) return null;

  const especificacion = valor.slice("bytes=".length).trim();
  if (especificacion.includes(",")) return null;

  const coincidencia = /^(\d*)-(\d*)$/.exec(especificacion);
  if (!coincidencia) return "INVALIDO";
  const [, desdeTexto, hastaTexto] = coincidencia;

  if (total <= 0) return "INVALIDO";

  // Sufijo: "bytes=-500" son los últimos 500 bytes.
  if (desdeTexto === "") {
    if (hastaTexto === "") return "INVALIDO";
    const sufijo = Number(hastaTexto);
    if (sufijo === 0) return "INVALIDO";
    return { inicio: Math.max(0, total - sufijo), fin: total - 1 };
  }

  const inicio = Number(desdeTexto);
  const fin = hastaTexto === "" ? total - 1 : Math.min(Number(hastaTexto), total - 1);

  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin)) return "INVALIDO";
  if (inicio >= total || inicio > fin) return "INVALIDO";

  return { inicio, fin };
}

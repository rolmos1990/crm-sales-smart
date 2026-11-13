import { normalizarTexto } from "@/shared/lib/normalizar-texto";
import {
  COLUMNAS_DESTINO,
  ETIQUETAS_COLUMNA_DESTINO,
  type ColumnaDestino,
  type MapeoColumnasDestino,
} from "../types";

// Propone el mapeo inicial del paso 2 a partir de los encabezados del
// archivo. Sin esto, bajar los destinos de un transportista y volver a
// subirlos obligaba a elegir a mano las once columnas una por una, aunque los
// encabezados fueran exactamente los que generó el sistema.
//
// Solo propone: el usuario sigue viendo cada fila y puede cambiarla. Una
// columna que no reconoce queda sin mapear ("ignorar"), nunca adivinada a la
// fuerza.

/** "Costo transportista *" y "costo transportista" son la misma columna. */
function clave(encabezado: string): string {
  return normalizarTexto(encabezado.replace(/\*/g, ""));
}

const POR_ETIQUETA = new Map<string, ColumnaDestino>(
  COLUMNAS_DESTINO.map((columna) => [clave(ETIQUETAS_COLUMNA_DESTINO[columna]), columna]),
);

// El nombre interno también se acepta: un archivo armado a mano o por un
// sistema externo suele traer "zonaNombre" en vez de "Nombre de la zona".
const POR_NOMBRE_INTERNO = new Map<string, ColumnaDestino>(
  COLUMNAS_DESTINO.map((columna) => [clave(columna), columna]),
);

export function automapearColumnasDestino(encabezados: string[]): MapeoColumnasDestino {
  const mapeo: MapeoColumnasDestino = {};
  // Una misma columna del dominio no puede quedar asignada dos veces: si dos
  // encabezados distintos apuntan a la misma, gana el primero.
  const yaUsadas = new Set<ColumnaDestino>();

  for (const encabezado of encabezados) {
    // El mapeo se indexa por el texto del encabezado, así que dos encabezados
    // idénticos son una sola entrada: la decisión ya está tomada y volver a
    // evaluarla la borraría (la columna figura como usada por él mismo).
    if (encabezado in mapeo) continue;

    const k = clave(encabezado);
    const columna = POR_ETIQUETA.get(k) ?? POR_NOMBRE_INTERNO.get(k);
    if (columna && !yaUsadas.has(columna)) {
      mapeo[encabezado] = columna;
      yaUsadas.add(columna);
    } else {
      mapeo[encabezado] = "";
    }
  }

  return mapeo;
}

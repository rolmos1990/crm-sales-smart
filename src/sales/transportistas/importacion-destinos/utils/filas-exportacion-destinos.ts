import {
  COLUMNAS_DESTINO,
  COLUMNAS_DESTINO_REQUERIDAS,
  ETIQUETAS_COLUMNA_DESTINO,
  type ColumnaDestino,
} from "../types";

// Arma el archivo de destinos de un transportista con EXACTAMENTE las mismas
// columnas que entiende la importación, derivadas de COLUMNAS_DESTINO igual
// que la plantilla de ejemplo. Esa es la garantía que hace útil al export: lo
// que se baja se puede volver a subir sin tocarlo, y si mañana cambia el
// dominio de columnas, plantilla, export e importación cambian juntos.
//
// Por eso los encabezados llevan el mismo sufijo " *" en las obligatorias que
// la plantilla: el paso de mapeo reconoce la columna por su etiqueta, y si el
// export usara otra el archivo propio llegaría sin mapear.

/** Una tarifa del transportista, aplanada al nivel de fila del archivo. */
export interface DestinoExportable {
  zonaNombre: string;
  provinciaEstado: string | null;
  distritoCiudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
  /** Alias de la ubicación; en el archivo van separados por ";". */
  alias: string[];
  servicioNombre: string;
  costoInterno: number;
  precioCliente: number;
  tiempoMinimoDias: number | null;
  tiempoMaximoDias: number | null;
}

export interface ArchivoDestinos {
  encabezados: string[];
  filas: string[][];
}

function etiquetaConMarcado(columna: ColumnaDestino): string {
  const requerida = (COLUMNAS_DESTINO_REQUERIDAS as readonly ColumnaDestino[]).includes(columna);
  return requerida ? `${ETIQUETAS_COLUMNA_DESTINO[columna]} *` : ETIQUETAS_COLUMNA_DESTINO[columna];
}

/** Los números van sin separador de miles: el importador los parsea con Number. */
function numero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

function celda(destino: DestinoExportable, columna: ColumnaDestino): string {
  switch (columna) {
    case "zonaNombre":           return destino.zonaNombre;
    case "provinciaEstado":      return destino.provinciaEstado ?? "";
    case "distritoCiudad":       return destino.distritoCiudad ?? "";
    case "corregimiento":        return destino.corregimiento ?? "";
    case "sectorOCodigoPostal":  return destino.sectorOCodigoPostal ?? "";
    case "alias":                return destino.alias.join(";");
    case "servicioNombre":       return destino.servicioNombre;
    case "costoInterno":         return numero(destino.costoInterno);
    case "precioCliente":        return numero(destino.precioCliente);
    case "tiempoMinimoDias":     return numero(destino.tiempoMinimoDias);
    case "tiempoMaximoDias":     return numero(destino.tiempoMaximoDias);
  }
}

export function construirArchivoDestinos(destinos: DestinoExportable[]): ArchivoDestinos {
  return {
    encabezados: COLUMNAS_DESTINO.map(etiquetaConMarcado),
    filas: destinos.map((d) => COLUMNAS_DESTINO.map((columna) => celda(d, columna))),
  };
}

/** Nombre de archivo legible y sin caracteres que molesten al sistema de archivos. */
export function nombreArchivoDestinos(transportistaNombre: string, hoy: string): string {
  const base = transportistaNombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  return `destinos-${base || "transportista"}-${hoy}`;
}

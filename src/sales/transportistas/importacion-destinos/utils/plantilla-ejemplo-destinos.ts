import { COLUMNAS_DESTINO, COLUMNAS_DESTINO_REQUERIDAS, ETIQUETAS_COLUMNA_DESTINO, type ColumnaDestino } from "../types";

// 025-plantilla-ejemplo-importacion-destinos — encabezados y fila de ejemplo
// se derivan siempre de COLUMNAS_DESTINO/ETIQUETAS_COLUMNA_DESTINO/
// COLUMNAS_DESTINO_REQUERIDAS (nunca una lista paralela hardcodeada), para
// que la plantilla nunca quede desincronizada si cambia el dominio de
// columnas (plan.md, Constraints). El sufijo " *" en el encabezado marca las
// columnas obligatorias (FR-004) sin arriesgar el re-parseo del archivo si
// el usuario lo sube tal cual (research.md Decisión 4 — se descartó una fila
// de notas separada por esa misma razón).
const VALORES_EJEMPLO: Record<ColumnaDestino, string> = {
  zonaNombre: "David Centro",
  provinciaEstado: "Chiriquí",
  distritoCiudad: "David",
  corregimiento: "David Centro",
  sectorOCodigoPostal: "0427",
  alias: "David Centro;Zona David",
  servicioNombre: "Estándar",
  costoInterno: "12.50",
  precioCliente: "18.00",
  tiempoMinimoDias: "2",
  tiempoMaximoDias: "5",
};

export interface PlantillaEjemploDestinos {
  encabezados: string[];
  filaEjemplo: string[];
}

function etiquetaConMarcado(columna: ColumnaDestino): string {
  const requerida = (COLUMNAS_DESTINO_REQUERIDAS as readonly ColumnaDestino[]).includes(columna);
  return requerida ? `${ETIQUETAS_COLUMNA_DESTINO[columna]} *` : ETIQUETAS_COLUMNA_DESTINO[columna];
}

export function construirPlantillaEjemploDestinos(): PlantillaEjemploDestinos {
  return {
    encabezados: COLUMNAS_DESTINO.map(etiquetaConMarcado),
    filaEjemplo: COLUMNAS_DESTINO.map((columna) => VALORES_EJEMPLO[columna]),
  };
}

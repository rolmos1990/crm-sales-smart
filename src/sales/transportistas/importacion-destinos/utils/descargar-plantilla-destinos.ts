"use client";

import { construirPlantillaEjemploDestinos } from "./plantilla-ejemplo-destinos";
import { descargarCsv, descargarExcel } from "./descargar-tabla";

const NOMBRE_ARCHIVO_BASE = "plantilla-destinos-transportista";

// 025-plantilla-ejemplo-importacion-destinos — el archivo en sí (escapado,
// BOM para Excel, disparo de la descarga) vive en descargar-tabla.ts,
// compartido con la exportación de destinos.
export function descargarPlantillaDestinosCsv() {
  const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
  descargarCsv([encabezados, filaEjemplo], NOMBRE_ARCHIVO_BASE);
}

export function descargarPlantillaDestinosExcel() {
  const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
  descargarExcel([encabezados, filaEjemplo], NOMBRE_ARCHIVO_BASE);
}

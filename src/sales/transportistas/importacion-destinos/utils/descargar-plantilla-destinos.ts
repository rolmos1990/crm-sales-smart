"use client";

import * as XLSX from "xlsx";
import { construirPlantillaEjemploDestinos } from "./plantilla-ejemplo-destinos";

const NOMBRE_ARCHIVO_BASE = "plantilla-destinos-transportista";

function escaparCelda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

// 025-plantilla-ejemplo-importacion-destinos — mismo criterio que
// src/sales/pedidos/utils/exportar-csv.ts (research.md Decisión 6): BOM al
// inicio del Blob para que Excel detecte UTF-8 (tildes, "ñ") y celdas
// escapadas si contienen coma/comillas/salto de línea.
export function descargarPlantillaDestinosCsv() {
  const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
  const contenido = [encabezados, filaEjemplo]
    .map((fila) => fila.map((celda) => escaparCelda(celda)).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${NOMBRE_ARCHIVO_BASE}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// Reutiliza xlsx (ya usada para leer en src/crm/datos/utils/parsear-archivo.ts)
// también para escribir — evita agregar una dependencia nueva (research.md
// Decisión 5). XLSX.writeFile ya dispara la descarga en el navegador.
export function descargarPlantillaDestinosExcel() {
  const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, filaEjemplo]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Destinos");
  XLSX.writeFile(libro, `${NOMBRE_ARCHIVO_BASE}.xlsx`);
}

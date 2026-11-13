"use client";

import * as XLSX from "xlsx";

// Descarga de una tabla (encabezados + filas) como CSV o Excel. Extraído de
// descargar-plantilla-destinos.ts al sumarse la exportación de destinos: los
// dos bajan el mismo formato y tener dos copias del escapado era la forma
// segura de que se separaran.
//
// 025-plantilla-ejemplo-importacion-destinos — mismo criterio que
// src/sales/pedidos/utils/exportar-csv.ts (research.md Decisión 6): BOM al
// inicio del Blob para que Excel detecte UTF-8 (tildes, "ñ") y celdas
// escapadas si contienen coma, comillas o salto de línea.
function escaparCelda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

export function descargarCsv(filas: string[][], nombreArchivoSinExtension: string) {
  const contenido = filas.map((fila) => fila.map(escaparCelda).join(",")).join("\n");

  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${nombreArchivoSinExtension}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// Reutiliza xlsx (ya usada para leer en src/crm/datos/utils/parsear-archivo.ts)
// también para escribir — evita agregar una dependencia nueva (research.md
// Decisión 5). XLSX.writeFile ya dispara la descarga en el navegador.
export function descargarExcel(filas: string[][], nombreArchivoSinExtension: string, hojaNombre = "Destinos") {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, hojaNombre);
  XLSX.writeFile(libro, `${nombreArchivoSinExtension}.xlsx`);
}

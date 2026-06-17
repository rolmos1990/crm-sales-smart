"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { detectarSeparador } from "./detectar-separador";
import type { DatosArchivo, FormatoArchivo, SeparadorCSV } from "../types";

export async function parsearArchivo(
  archivo: File,
  separadorOverride?: SeparadorCSV,
): Promise<DatosArchivo> {
  const extension = archivo.name
    .split(".")
    .pop()
    ?.toLowerCase() as FormatoArchivo;

  if (extension === "csv") {
    return parsearCSV(archivo, separadorOverride);
  }
  return parsearExcel(archivo, extension);
}

async function parsearCSV(
  archivo: File,
  separadorOverride?: SeparadorCSV,
): Promise<DatosArchivo> {
  const texto = await archivo.text();
  const separador = separadorOverride ?? detectarSeparador(texto);

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(texto, {
      delimiter: separador,
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        const encabezados = resultado.meta.fields ?? [];
        const filasTotales = resultado.data.length;
        resolve({
          nombre: archivo.name,
          tipo: "csv",
          peso: archivo.size,
          separador,
          encabezados,
          filas: resultado.data.slice(0, 50),
          filasTotales,
        });
      },
      error: reject,
    });
  });
}

async function parsearExcel(
  archivo: File,
  tipo: "xls" | "xlsx",
): Promise<DatosArchivo> {
  const buffer = await archivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1 });

  const [encabezadosFila, ...datosFilas] = filas as string[][];
  const encabezados = (encabezadosFila ?? []).map(String);

  const datos: Record<string, string>[] = datosFilas
    .filter((fila) =>
      fila.some((c) => c !== null && c !== undefined && c !== ""),
    )
    .map((fila) =>
      Object.fromEntries(
        encabezados.map((h, i) => [h, String(fila[i] ?? "")]),
      ),
    );

  return {
    nombre: archivo.name,
    tipo,
    peso: archivo.size,
    encabezados,
    filas: datos.slice(0, 50),
    filasTotales: datos.length,
  };
}

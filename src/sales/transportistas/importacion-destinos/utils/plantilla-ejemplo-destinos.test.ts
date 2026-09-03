import { describe, expect, it } from "vitest";
import { construirPlantillaEjemploDestinos } from "./plantilla-ejemplo-destinos";
import { COLUMNAS_DESTINO, COLUMNAS_DESTINO_REQUERIDAS } from "../types";

describe("construirPlantillaEjemploDestinos", () => {
  it("genera un encabezado y una fila de ejemplo por cada columna del dominio", () => {
    const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
    expect(encabezados).toHaveLength(COLUMNAS_DESTINO.length);
    expect(filaEjemplo).toHaveLength(COLUMNAS_DESTINO.length);
  });

  it("incluye al menos dos alias separados por \";\" en la fila de ejemplo", () => {
    const { encabezados, filaEjemplo } = construirPlantillaEjemploDestinos();
    const indiceAlias = COLUMNAS_DESTINO.indexOf("alias");
    const valorAlias = filaEjemplo[indiceAlias];
    expect(encabezados[indiceAlias]).toContain("Alias");
    expect(valorAlias.split(";").length).toBeGreaterThanOrEqual(2);
  });

  // 025-plantilla-ejemplo-importacion-destinos (US3/FR-004) — regresión
  // dedicada: exactamente las columnas de COLUMNAS_DESTINO_REQUERIDAS deben
  // quedar marcadas con " *", ninguna otra.
  it("marca con \" *\" únicamente las columnas obligatorias", () => {
    const { encabezados } = construirPlantillaEjemploDestinos();
    const requeridas = new Set<string>(COLUMNAS_DESTINO_REQUERIDAS);

    COLUMNAS_DESTINO.forEach((columna, indice) => {
      if (requeridas.has(columna)) {
        expect(encabezados[indice]).toMatch(/ \*$/);
      } else {
        expect(encabezados[indice]).not.toMatch(/ \*$/);
      }
    });
  });
});

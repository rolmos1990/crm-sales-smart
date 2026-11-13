import { describe, expect, it } from "vitest";
import {
  construirArchivoDestinos,
  nombreArchivoDestinos,
  type DestinoExportable,
} from "./filas-exportacion-destinos";
import { automapearColumnasDestino } from "./automapeo-columnas";
import { construirPlantillaEjemploDestinos } from "./plantilla-ejemplo-destinos";
import { COLUMNAS_DESTINO, COLUMNAS_DESTINO_REQUERIDAS } from "../types";

const DESTINO: DestinoExportable = {
  zonaNombre: "Chiriquí (Volcán, Puerto Armuelles)",
  provinciaEstado: "Chiriquí",
  distritoCiudad: "Volcán",
  corregimiento: null,
  sectorOCodigoPostal: null,
  alias: ["Volcan", "Cerro Punta"],
  servicioNombre: "Estándar",
  costoInterno: 7.5,
  precioCliente: 7.5,
  tiempoMinimoDias: 1,
  tiempoMaximoDias: 2,
};

describe("construirArchivoDestinos", () => {
  it("usa exactamente las columnas que entiende la importación", () => {
    const { encabezados } = construirArchivoDestinos([DESTINO]);
    expect(encabezados).toHaveLength(COLUMNAS_DESTINO.length);
  });

  it("los encabezados son idénticos a los de la plantilla — si no, el archivo propio llegaría sin mapear", () => {
    const { encabezados } = construirArchivoDestinos([]);
    expect(encabezados).toEqual(construirPlantillaEjemploDestinos().encabezados);
  });

  it("marca las obligatorias con el mismo sufijo que la plantilla", () => {
    const { encabezados } = construirArchivoDestinos([]);
    for (const columna of COLUMNAS_DESTINO_REQUERIDAS) {
      const i = COLUMNAS_DESTINO.indexOf(columna);
      expect(encabezados[i].endsWith(" *"), `"${encabezados[i]}" debería ir marcada`).toBe(true);
    }
  });

  it("vuelca los valores en el orden de las columnas", () => {
    const { filas } = construirArchivoDestinos([DESTINO]);
    expect(filas[0]).toEqual([
      "Chiriquí (Volcán, Puerto Armuelles)",
      "Chiriquí",
      "Volcán",
      "",
      "",
      "Volcan;Cerro Punta",
      "Estándar",
      "7.5",
      "7.5",
      "1",
      "2",
    ]);
  });

  it("los vacíos quedan vacíos, no 'null' ni '0'", () => {
    const { filas } = construirArchivoDestinos([
      { ...DESTINO, corregimiento: null, tiempoMinimoDias: null, tiempoMaximoDias: null },
    ]);
    expect(filas[0]).not.toContain("null");
    expect(filas[0][3]).toBe("");
    expect(filas[0][9]).toBe("");
  });

  it("un costo de 0 se exporta como 0, no como vacío", () => {
    const { filas } = construirArchivoDestinos([{ ...DESTINO, costoInterno: 0 }]);
    expect(filas[0][7]).toBe("0");
  });

  it("sin destinos devuelve solo los encabezados — el archivo sirve de plantilla", () => {
    const { encabezados, filas } = construirArchivoDestinos([]);
    expect(filas).toEqual([]);
    expect(encabezados.length).toBeGreaterThan(0);
  });
});

describe("ida y vuelta: lo exportado se re-importa sin mapear a mano", () => {
  it("cada encabezado exportado se automapea a su columna", () => {
    const { encabezados } = construirArchivoDestinos([DESTINO]);

    const mapeo = automapearColumnasDestino(encabezados);

    expect(Object.values(mapeo)).toEqual([...COLUMNAS_DESTINO]);
  });

  it("no queda ninguna columna obligatoria sin mapear", () => {
    const { encabezados } = construirArchivoDestinos([DESTINO]);
    const mapeadas = new Set(Object.values(automapearColumnasDestino(encabezados)));

    for (const requerida of COLUMNAS_DESTINO_REQUERIDAS) {
      expect(mapeadas.has(requerida), `falta mapear "${requerida}"`).toBe(true);
    }
  });

  it("la plantilla de ejemplo también se automapea", () => {
    const mapeo = automapearColumnasDestino(construirPlantillaEjemploDestinos().encabezados);
    expect(Object.values(mapeo)).toEqual([...COLUMNAS_DESTINO]);
  });
});

describe("automapearColumnasDestino", () => {
  it("tolera mayúsculas, tildes y el asterisco de obligatoria", () => {
    const mapeo = automapearColumnasDestino(["COSTO TRANSPORTISTA *", "precio al cliente"]);
    expect(mapeo["COSTO TRANSPORTISTA *"]).toBe("costoInterno");
    expect(mapeo["precio al cliente"]).toBe("precioCliente");
  });

  it("acepta también el nombre interno de la columna", () => {
    expect(automapearColumnasDestino(["zonaNombre"])["zonaNombre"]).toBe("zonaNombre");
  });

  it("una columna desconocida queda sin mapear, no adivinada", () => {
    expect(automapearColumnasDestino(["Comentarios del vendedor"])["Comentarios del vendedor"]).toBe("");
  });

  it("un encabezado repetido no asigna dos veces la misma columna", () => {
    const mapeo = automapearColumnasDestino(["Servicio", "Servicio"]);
    expect(Object.values(mapeo).filter((c) => c === "servicioNombre")).toHaveLength(1);
  });
});

describe("nombreArchivoDestinos", () => {
  it("usa el nombre del transportista y la fecha", () => {
    expect(nombreArchivoDestinos("UnoExpress", "2026-11-13")).toBe("destinos-unoexpress-2026-11-13");
  });

  it("limpia tildes, espacios y símbolos", () => {
    expect(nombreArchivoDestinos("Envíos Rápidos S.A.", "2026-11-13")).toBe("destinos-envios-rapidos-s-a-2026-11-13");
  });

  it("un nombre sin caracteres usables no deja el archivo sin nombre", () => {
    expect(nombreArchivoDestinos("///", "2026-11-13")).toBe("destinos-transportista-2026-11-13");
  });
});

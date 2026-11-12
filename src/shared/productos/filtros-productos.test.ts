import { describe, expect, it } from "vitest";
import {
  FILTROS_INICIALES,
  categoriasDisponibles,
  contarPorPestana,
  filtrarProductos,
  hayFiltrosActivos,
  type FiltrosProductos,
} from "./filtros-productos";
import type { ProductoListado } from "./types";

const ESFERA = { id: "e1", nombre: "Esfera", color: "#60a5fa" };
const BASE = { id: "e2", nombre: "Base", color: "#fbbf24" };
const PEQUENA = { id: "e3", nombre: "Pequeña", color: "#2dd4bf" };

function producto(p: Partial<ProductoListado> & { id: string; nombre: string }): ProductoListado {
  return {
    sku: null, descripcion: null, precio: 10, moneda: "USD", categoria: "Detalle", tipo: "FISICO", unidad: "unid",
    imagenUrl: null, activo: true, esCombo: false, ventaDirecta: true, stock: null, etiquetas: [], ...p,
  };
}

const CATALOGO: ProductoListado[] = [
  producto({ id: "1", nombre: "Esfera Luna (Pequeña)", sku: "ES-01", etiquetas: [ESFERA, PEQUENA] }),
  producto({ id: "2", nombre: "Base Fija Pequeña", sku: "BS-01", etiquetas: [BASE, PEQUENA], ventaDirecta: false }),
  producto({ id: "3", nombre: "Esfera con base", esCombo: true, etiquetas: [ESFERA, BASE] }),
  producto({ id: "4", nombre: "Instalación", tipo: "SERVICIO", categoria: "Servicios" }),
  producto({ id: "5", nombre: "Manual PDF", tipo: "DIGITAL", activo: false }),
];

const filtrar = (cambios: Partial<FiltrosProductos>) =>
  filtrarProductos(CATALOGO, { ...FILTROS_INICIALES, ...cambios }).map((p) => p.id);

describe("filtrarProductos", () => {
  it("por defecto muestra solo activos", () => {
    expect(filtrar({})).toEqual(["1", "2", "3", "4"]);
  });

  it("estado inactivos y todos", () => {
    expect(filtrar({ estado: "INACTIVOS" })).toEqual(["5"]);
    expect(filtrar({ estado: "TODOS" })).toHaveLength(5);
  });

  it("pestañas", () => {
    expect(filtrar({ pestana: "COMBOS" })).toEqual(["3"]);
    expect(filtrar({ pestana: "VENTA_DIRECTA" })).toEqual(["1", "3", "4"]);
    expect(filtrar({ pestana: "SERVICIOS" })).toEqual(["4"]);
    expect(filtrar({ pestana: "DIGITALES", estado: "TODOS" })).toEqual(["5"]);
  });

  it("tipo y venta", () => {
    expect(filtrar({ tipo: "SERVICIO" })).toEqual(["4"]);
    expect(filtrar({ venta: "SOLO_COMBOS" })).toEqual(["2"]);
    expect(filtrar({ venta: "VENTA_DIRECTA" })).toEqual(["1", "3", "4"]);
  });

  it("categorías: cualquiera de las elegidas", () => {
    expect(filtrar({ categorias: ["Servicios"] })).toEqual(["4"]);
    expect(filtrar({ categorias: ["Servicios", "Detalle"] })).toEqual(["1", "2", "3", "4"]);
  });

  it("etiquetas: debe tener todas las elegidas", () => {
    expect(filtrar({ etiquetaIds: ["e1"] })).toEqual(["1", "3"]);
    expect(filtrar({ etiquetaIds: ["e1", "e3"] })).toEqual(["1"]);
  });

  it("búsqueda por nombre, SKU y etiqueta, sin importar tildes", () => {
    expect(filtrar({ busqueda: "bs-01" })).toEqual(["2"]);
    expect(filtrar({ busqueda: "pequena" })).toEqual(["1", "2"]);
    expect(filtrar({ busqueda: "esfera base" })).toEqual(["3"]);
  });
});

describe("contarPorPestana", () => {
  it("cuenta cada pestaña con el resto de los filtros aplicados", () => {
    expect(contarPorPestana(CATALOGO, FILTROS_INICIALES)).toEqual({
      TODOS: 4, COMBOS: 1, VENTA_DIRECTA: 3, SERVICIOS: 1, DIGITALES: 0,
    });
    expect(contarPorPestana(CATALOGO, { ...FILTROS_INICIALES, etiquetaIds: ["e1"] }).TODOS).toBe(2);
  });
});

describe("hayFiltrosActivos / categoriasDisponibles", () => {
  it("la pestaña no cuenta como filtro", () => {
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, pestana: "COMBOS" })).toBe(false);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, busqueda: "luna" })).toBe(true);
    expect(hayFiltrosActivos({ ...FILTROS_INICIALES, estado: "TODOS" })).toBe(true);
  });

  it("lista categorías únicas ordenadas", () => {
    expect(categoriasDisponibles(CATALOGO)).toEqual(["Detalle", "Servicios"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  claveVariante,
  generarCombinaciones,
  nombreVariante,
  planConversionStock,
  validarConfiguracionVariantes,
  type AtributoVariante,
} from "./variantes";

const color: AtributoVariante = { nombre: "Color", valores: ["Negro", "Blanco"] };
const talla: AtributoVariante = { nombre: "Talla", valores: ["S", "M", "L"] };

describe("generarCombinaciones (030)", () => {
  it("un atributo con varios valores genera una variante por valor", () => {
    const combinaciones = generarCombinaciones([{ nombre: "Color de luz", valores: ["Amarilla", "Multicolor", "Blanca"] }]);
    expect(combinaciones).toEqual([{ "Color de luz": "Amarilla" }, { "Color de luz": "Multicolor" }, { "Color de luz": "Blanca" }]);
  });

  it("múltiples atributos generan el producto cartesiano en orden estable", () => {
    const combinaciones = generarCombinaciones([color, talla]);
    expect(combinaciones).toHaveLength(6);
    expect(combinaciones.map((v) => nombreVariante(v, [color, talla]))).toEqual([
      "Negro / S", "Negro / M", "Negro / L", "Blanco / S", "Blanco / M", "Blanco / L",
    ]);
  });

  it("ignora valores vacíos y atributos sin valores", () => {
    expect(generarCombinaciones([{ nombre: "Color", valores: ["Rojo", " "] }, { nombre: "Vacío", valores: [] }])).toEqual([{ Color: "Rojo" }]);
    expect(generarCombinaciones([])).toEqual([]);
  });
});

describe("claveVariante (030)", () => {
  it("es insensible a mayúsculas y espacios", () => {
    expect(claveVariante({ Color: "Negro ", Talla: "s" }, [color, talla])).toBe(claveVariante({ Color: "negro", Talla: "S" }, [color, talla]));
  });

  it("sigue el orden de los atributos", () => {
    expect(claveVariante({ Talla: "S", Color: "Negro" }, [color, talla])).toBe("color=negro|talla=s");
  });
});

describe("validarConfiguracionVariantes (030)", () => {
  const todas = generarCombinaciones([color, talla]).map((valores) => ({ valores }));

  it("acepta una configuración válida con SKU independientes", () => {
    const conSku = todas.map((v, i) => ({ ...v, sku: `CAM-${i}` }));
    expect(validarConfiguracionVariantes([color, talla], conSku)).toBeNull();
  });

  it("rechaza combinaciones duplicadas (aunque difieran en mayúsculas)", () => {
    expect(validarConfiguracionVariantes([color], [{ valores: { Color: "Negro" } }, { valores: { Color: "negro" } }])).toBe(
      "La combinación «negro» está duplicada",
    );
  });

  it("rechaza un valor repetido dentro de un atributo", () => {
    expect(validarConfiguracionVariantes([{ nombre: "Color", valores: ["Negro", "NEGRO"] }], [{ valores: { Color: "Negro" } }])).toBe(
      "El valor «Negro» está repetido en «Color»",
    );
  });

  it("rechaza SKU repetidos entre variantes", () => {
    expect(
      validarConfiguracionVariantes([color], [{ valores: { Color: "Negro" }, sku: "A1" }, { valores: { Color: "Blanco" }, sku: "a1" }]),
    ).toBe("El SKU «a1» se repite en más de una variante");
  });

  it("rechaza atributos repetidos, más de 3 atributos y sin valores", () => {
    expect(validarConfiguracionVariantes([color, { ...color }], [])).toBe("El atributo «Color» está repetido");
    const cuatro = ["A", "B", "C", "D"].map((n) => ({ nombre: n, valores: ["x"] }));
    expect(validarConfiguracionVariantes(cuatro, [])).toBe("Máximo 3 atributos por producto");
    expect(validarConfiguracionVariantes([], [])).toBe("Agrega al menos un atributo con valores");
  });

  it("rechaza más de 100 variantes", () => {
    const grande = Array.from({ length: 11 }, (_, i) => `v${i}`);
    const atributos = [{ nombre: "A", valores: grande }, { nombre: "B", valores: grande }];
    expect(validarConfiguracionVariantes(atributos, generarCombinaciones(atributos).map((valores) => ({ valores })))).toBe(
      "Máximo 100 variantes por producto",
    );
  });

  it("rechaza una variante que no coincide con los atributos del producto", () => {
    expect(validarConfiguracionVariantes([color], [{ valores: { Color: "Rojo" } }])).toBe(
      "La variante «Rojo» no coincide con los atributos del producto",
    );
    expect(validarConfiguracionVariantes([color, talla], [{ valores: { Color: "Negro" } }])).toContain("no coincide");
  });
});

describe("planConversionStock (030) — convertir no duplica ni pierde stock", () => {
  it("acepta una distribución que suma exactamente el stock actual", () => {
    expect(planConversionStock({ stockActual: 10, manejaStock: true, stockVariantes: [6, 4] })).toEqual({ ok: true });
  });

  it("rechaza una distribución que no suma el total (de menos o de más)", () => {
    expect(planConversionStock({ stockActual: 10, manejaStock: true, stockVariantes: [5, 4] })).toEqual({
      ok: false,
      error: "Distribuye el stock actual (10) entre las variantes: asignado 9",
    });
    expect(planConversionStock({ stockActual: 10, manejaStock: true, stockVariantes: [10, 10] }).ok).toBe(false);
  });

  it("sin control de stock o sin stock, no exige distribución", () => {
    expect(planConversionStock({ stockActual: 10, manejaStock: false, stockVariantes: [0, 0] })).toEqual({ ok: true });
    expect(planConversionStock({ stockActual: 0, manejaStock: true, stockVariantes: [3, 2] })).toEqual({ ok: true });
  });
});

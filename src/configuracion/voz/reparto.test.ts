import { describe, it, expect } from "vitest";
import { repartirRedondeo } from "./reparto";

function suma(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Compara sumas de decimales sin arrastrar el error de punto flotante. */
function sumaEn(xs: number[], decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(suma(xs) * f) / f;
}

describe("repartirRedondeo", () => {
  it("mantiene el invariante: la suma de las filas ES el total redondeado", () => {
    const casos: Array<{ valores: number[]; decimales: number }> = [
      { valores: [12.34, 12.34, 12.34], decimales: 1 },
      { valores: [1.05, 2.05, 3.05], decimales: 1 },
      { valores: [0.04, 0.04, 0.04, 0.04, 0.04], decimales: 1 },
      { valores: [98.0, 44.3, 12.0], decimales: 1 },
      { valores: [2.6149, 1.3351, 0.9999], decimales: 2 },
      { valores: [1 / 3, 1 / 3, 1 / 3], decimales: 2 },
      { valores: [10, 20, 30], decimales: 0 },
    ];

    for (const { valores, decimales } of casos) {
      const repartido = repartirRedondeo(valores, decimales);
      const esperado = Math.round(suma(valores) * 10 ** decimales) / 10 ** decimales;
      expect(sumaEn(repartido, decimales)).toBe(esperado);
    }
  });

  it("es el caso que motiva la función: 12.34 x3 suma 37.0, no 36.9", () => {
    const repartido = repartirRedondeo([12.34, 12.34, 12.34], 1);

    // Redondeando cada fila por su cuenta daría [12.3, 12.3, 12.3] = 36.9.
    expect(sumaEn(repartido, 1)).toBe(37.0);
    expect(repartido).toEqual([12.4, 12.3, 12.3]);
  });

  it("respeta un objetivo externo aunque difiera del redondeo de la suma", () => {
    // El llamador calcula el total con la expresión de la tarjeta, sobre los
    // segundos enteros. Las filas tienen que dar ESE número, no el suyo.
    const repartido = repartirRedondeo([12.34, 12.34, 12.34], 1, 37.1);

    expect(sumaEn(repartido, 1)).toBe(37.1);
  });

  it("nunca desplaza el ajuste a una entrada en cero", () => {
    const repartido = repartirRedondeo([0, 12.34, 12.34, 12.34], 1);

    expect(repartido[0]).toBe(0);
    expect(sumaEn(repartido, 1)).toBe(37.0);
  });

  it("deja en cero a todas las entradas sin consumo", () => {
    expect(repartirRedondeo([0, 0, 0], 1)).toEqual([0, 0, 0]);
  });

  it("no toca los valores cuando los redondeos ya cuadran", () => {
    expect(repartirRedondeo([1.1, 2.2, 3.3], 1)).toEqual([1.1, 2.2, 3.3]);
  });

  it("devuelve arreglo vacío para entrada vacía", () => {
    expect(repartirRedondeo([], 1)).toEqual([]);
  });

  it("redondea un único valor sin inventar resto", () => {
    expect(repartirRedondeo([12.34], 1)).toEqual([12.3]);
    expect(repartirRedondeo([12.36], 1)).toEqual([12.4]);
  });

  it("es determinista ante restos empatados: gana el índice menor", () => {
    const a = repartirRedondeo([1.25, 1.25, 1.25], 1);
    const b = repartirRedondeo([1.25, 1.25, 1.25], 1);

    expect(a).toEqual(b);
    expect(sumaEn(a, 1)).toBe(Math.round(3.75 * 10) / 10);
  });
});

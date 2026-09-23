import { describe, expect, it } from "vitest";
import { filtrarCatalogo } from "./filtro-catalogo";

const catalogo = [
  { id: "base", esCombo: false, ventaDirecta: false },
  { id: "esfera", esCombo: false, ventaDirecta: false },
  { id: "cojin", esCombo: false, ventaDirecta: true },
  { id: "luminaria", esCombo: true, ventaDirecta: true },
  { id: "combo-oculto", esCombo: true, ventaDirecta: false },
];
const ids = (lista: { id: string }[]) => lista.map((p) => p.id);

describe("filtrarCatalogo (029)", () => {
  it("Combos: solo combos de venta directa", () => {
    expect(ids(filtrarCatalogo(catalogo, "COMBOS"))).toEqual(["luminaria"]);
  });

  it("Productos: solo productos de venta directa que no son combos", () => {
    expect(ids(filtrarCatalogo(catalogo, "PRODUCTOS"))).toEqual(["cojin"]);
  });

  it("Todos: todo lo de venta directa, combos incluidos", () => {
    expect(ids(filtrarCatalogo(catalogo, "TODOS"))).toEqual(["cojin", "luminaria"]);
  });

  it("los componentes con venta directa desactivada no aparecen en ningún filtro", () => {
    for (const filtro of ["TODOS", "PRODUCTOS", "COMBOS"] as const) {
      expect(ids(filtrarCatalogo(catalogo, filtro))).not.toContain("base");
      expect(ids(filtrarCatalogo(catalogo, filtro))).not.toContain("esfera");
    }
  });

  it("un producto existente sin los campos nuevos sigue apareciendo como producto", () => {
    const viejo = { id: "viejo" } as unknown as { id: string; esCombo: boolean; ventaDirecta: boolean };
    expect(ids(filtrarCatalogo([viejo], "TODOS"))).toEqual(["viejo"]);
    expect(ids(filtrarCatalogo([viejo], "PRODUCTOS"))).toEqual(["viejo"]);
    expect(ids(filtrarCatalogo([viejo], "COMBOS"))).toEqual([]);
  });
});

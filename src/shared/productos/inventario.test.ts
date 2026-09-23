import { describe, expect, it } from "vitest";
import {
  calcularDisponibilidadCombo,
  diferenciaConsumo,
  expandirConsumo,
  validarDeltas,
  type LineaConsumo,
  type StockProducto,
} from "./inventario";

const BASE = "base";
const ESFERA = "esfera";

const combo11 = [
  { productoId: BASE, nombre: "Base Luminaria Grande", cantidad: 1 },
  { productoId: ESFERA, nombre: "Esfera Luna Grande", cantidad: 1 },
];
const combo21 = [
  { productoId: BASE, nombre: "Base Luminaria Grande", cantidad: 2 },
  { productoId: ESFERA, nombre: "Esfera Luna Grande", cantidad: 1 },
];

const lineaCombo = (cantidad: number, composicion = combo11): LineaConsumo => ({
  productoId: "luminaria",
  nombre: "Luminaria Luna Grande",
  cantidad,
  composicion,
});

const componente = (cantidadDisponible: number, cantidad = 1, extra: Partial<{ manejaStock: boolean; activo: boolean }> = {}) => ({
  cantidad,
  cantidadDisponible,
  manejaStock: true,
  activo: true,
  ...extra,
});

/** Simula el stock resultante de aplicar deltas a un estado inicial. */
function aplicar(stock: Record<string, number>, anterior: LineaConsumo[], nuevo: LineaConsumo[]) {
  const deltas = diferenciaConsumo(expandirConsumo(anterior), expandirConsumo(nuevo));
  const resultado = { ...stock };
  for (const [id, { delta }] of deltas) resultado[id] = (resultado[id] ?? 0) - delta;
  return resultado;
}

describe("calcularDisponibilidadCombo", () => {
  it("Base 15 + Esfera 10, 1+1 → 10", () => {
    expect(calcularDisponibilidadCombo([componente(15), componente(10)])).toBe(10);
  });

  it("componentes con cantidad > 1: Base 20 (×2) + Esfera 10 (×1) → 10", () => {
    expect(calcularDisponibilidadCombo([componente(20, 2), componente(10, 1)])).toBe(10);
  });

  it("división entera: Base 7 (×2) → 3", () => {
    expect(calcularDisponibilidadCombo([componente(7, 2), componente(10)])).toBe(3);
  });

  it("un componente sin stock → 0", () => {
    expect(calcularDisponibilidadCombo([componente(15), componente(0)])).toBe(0);
  });

  it("un componente inactivo → 0", () => {
    expect(calcularDisponibilidadCombo([componente(15), componente(10, 1, { activo: false })])).toBe(0);
  });

  it("solo cuentan los componentes con control de stock", () => {
    expect(calcularDisponibilidadCombo([componente(4), componente(0, 1, { manejaStock: false })])).toBe(4);
  });

  it("ningún componente controla stock → null (sin control)", () => {
    expect(calcularDisponibilidadCombo([componente(0, 1, { manejaStock: false })])).toBeNull();
  });

  it("stock negativo heredado no da disponibilidad negativa", () => {
    expect(calcularDisponibilidadCombo([componente(-3)])).toBe(0);
  });
});

describe("expandirConsumo", () => {
  it("un producto común consume su propio id (comportamiento de siempre)", () => {
    const consumo = expandirConsumo([{ productoId: "p1", cantidad: 3, composicion: null }]);
    expect(consumo.get("p1")?.cantidad).toBe(3);
  });

  it("venta de varias unidades de un combo descuenta cada componente", () => {
    const consumo = expandirConsumo([lineaCombo(2)]);
    expect(consumo.get(BASE)?.cantidad).toBe(2);
    expect(consumo.get(ESFERA)?.cantidad).toBe(2);
    expect(consumo.has("luminaria")).toBe(false);
  });

  it("cantidades por combo > 1: 3 combos de 2 Bases + 1 Esfera → 6 Bases y 3 Esferas", () => {
    const consumo = expandirConsumo([lineaCombo(3, combo21)]);
    expect(consumo.get(BASE)?.cantidad).toBe(6);
    expect(consumo.get(ESFERA)?.cantidad).toBe(3);
  });

  it("suma la demanda del combo y de la venta directa del mismo componente", () => {
    const consumo = expandirConsumo([lineaCombo(2), { productoId: BASE, cantidad: 1, composicion: null }]);
    expect(consumo.get(BASE)?.cantidad).toBe(3);
    expect(consumo.get(BASE)?.origenes).toEqual(["Luminaria Luna Grande"]);
  });

  it("líneas sin producto (texto libre) no consumen nada", () => {
    expect(expandirConsumo([{ productoId: null, cantidad: 5, composicion: null }]).size).toBe(0);
  });
});

describe("flujos de pedido (descuento y reversión)", () => {
  const inicial = { [BASE]: 15, [ESFERA]: 10 };

  it("crear pedido con 2 combos → Base 13 / Esfera 8", () => {
    expect(aplicar(inicial, [], [lineaCombo(2)])).toEqual({ [BASE]: 13, [ESFERA]: 8 });
  });

  it("editar de 2 a 1 combo devuelve 1 de cada componente", () => {
    expect(aplicar({ [BASE]: 13, [ESFERA]: 8 }, [lineaCombo(2)], [lineaCombo(1)])).toEqual({ [BASE]: 14, [ESFERA]: 9 });
  });

  it("quitar la línea devuelve todo", () => {
    expect(aplicar({ [BASE]: 14, [ESFERA]: 9 }, [lineaCombo(1)], [])).toEqual(inicial);
  });

  it("editar hacia arriba descuenta solo la diferencia", () => {
    expect(aplicar({ [BASE]: 13, [ESFERA]: 8 }, [lineaCombo(2)], [lineaCombo(5)])).toEqual({ [BASE]: 10, [ESFERA]: 5 });
  });

  it("la reversión usa el snapshot, no la composición vigente del combo", () => {
    // El pedido se creó con Base×1; hoy el combo pide Base×2. Al quitar la
    // línea se devuelve lo que se descontó (snapshot), no lo que pide hoy.
    const guardada = lineaCombo(2, combo11);
    expect(aplicar({ [BASE]: 13, [ESFERA]: 8 }, [guardada], [])).toEqual(inicial);
  });

  it("un producto común se comporta exactamente como antes", () => {
    const linea = (cantidad: number): LineaConsumo => ({ productoId: "p1", cantidad, composicion: null });
    expect(aplicar({ p1: 10 }, [], [linea(3)])).toEqual({ p1: 7 });
    expect(aplicar({ p1: 7 }, [linea(3)], [linea(1)])).toEqual({ p1: 9 });
    expect(aplicar({ p1: 9 }, [linea(1)], [])).toEqual({ p1: 10 });
  });

  it("cambiar el producto de una línea devuelve al anterior y descuenta del nuevo", () => {
    const antes: LineaConsumo = { productoId: "p1", cantidad: 2, composicion: null };
    const despues: LineaConsumo = { productoId: "p2", cantidad: 2, composicion: null };
    expect(aplicar({ p1: 8, p2: 10 }, [antes], [despues])).toEqual({ p1: 10, p2: 8 });
  });
});

describe("validarDeltas", () => {
  const stock = new Map<string, StockProducto>([
    [BASE, { nombre: "Base Luminaria Grande", manejaStock: true, cantidadDisponible: 1 }],
    [ESFERA, { nombre: "Esfera Luna Grande", manejaStock: true, cantidadDisponible: 10 }],
    ["servicio", { nombre: "Instalación", manejaStock: false, cantidadDisponible: 0 }],
  ]);

  it("nombra el componente y el combo cuando falta stock de un componente", () => {
    const deltas = diferenciaConsumo(new Map(), expandirConsumo([lineaCombo(2)]));
    expect(validarDeltas(deltas, stock)).toEqual([
      'Stock insuficiente para "Base Luminaria Grande" (componente de "Luminaria Luna Grande"). Disponible: 1 — solicitado: 2',
    ]);
  });

  it("mantiene el mensaje de siempre para un producto común", () => {
    const deltas = diferenciaConsumo(new Map(), expandirConsumo([{ productoId: BASE, cantidad: 3, composicion: null }]));
    expect(validarDeltas(deltas, stock)).toEqual(['Stock insuficiente para "Base Luminaria Grande". Disponible: 1 — solicitado: 3']);
  });

  it("en una edición dice 'adicional requerido'", () => {
    const anterior = expandirConsumo([{ productoId: BASE, cantidad: 1, composicion: null }]);
    const deltas = diferenciaConsumo(anterior, expandirConsumo([{ productoId: BASE, cantidad: 3, composicion: null }]));
    expect(validarDeltas(deltas, stock, anterior)[0]).toContain("adicional requerido: 2");
  });

  it("ignora devoluciones, productos sin control de stock y demanda cubierta", () => {
    const deltas = diferenciaConsumo(
      expandirConsumo([{ productoId: BASE, cantidad: 5, composicion: null }]),
      expandirConsumo([
        { productoId: "servicio", cantidad: 9, composicion: null },
        { productoId: ESFERA, cantidad: 10, composicion: null },
      ]),
    );
    expect(validarDeltas(deltas, stock)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { lineaCompleta, pedidoCompleto, totalizarAvance, validarCantidadPreparada } from "./avance";

describe("avance por línea (026)", () => {
  it("una línea está completa cuando lo preparado alcanza lo pedido", () => {
    expect(lineaCompleta({ cantidad: 3, cantidadPreparada: 3 })).toBe(true);
    expect(lineaCompleta({ cantidad: 3, cantidadPreparada: 2 })).toBe(false);
    expect(lineaCompleta({ cantidad: 3, cantidadPreparada: 0 })).toBe(false);
  });

  it("trata una línea de cantidad 0 como completa (no hay nada que preparar)", () => {
    expect(lineaCompleta({ cantidad: 0, cantidadPreparada: 0 })).toBe(true);
  });
});

describe("avance del pedido — derivado, nunca persistido", () => {
  it("el pedido está completo solo si todas sus líneas lo están", () => {
    expect(pedidoCompleto([
      { cantidad: 2, cantidadPreparada: 2 },
      { cantidad: 1, cantidadPreparada: 1 },
    ])).toBe(true);

    expect(pedidoCompleto([
      { cantidad: 2, cantidadPreparada: 2 },
      { cantidad: 3, cantidadPreparada: 2 },
    ])).toBe(false);
  });

  it("un pedido sin líneas no cuenta como completo", () => {
    expect(pedidoCompleto([])).toBe(false);
  });

  it("agregar una línea nueva devuelve el pedido a incompleto (FR-030)", () => {
    const lineas = [{ cantidad: 2, cantidadPreparada: 2 }];
    expect(pedidoCompleto(lineas)).toBe(true);

    // Esto es exactamente lo que pasa al editar el pedido: la línea nueva nace
    // con cantidadPreparada = 0. Como el avance es derivado, el pedido vuelve
    // a incompleto sin que nadie tenga que recalcular ni limpiar una bandera.
    const conNueva = [...lineas, { cantidad: 5, cantidadPreparada: 0 }];
    expect(pedidoCompleto(conNueva)).toBe(false);
  });

  it("quitar la línea pendiente vuelve a dejar el pedido completo", () => {
    const conPendiente = [
      { cantidad: 2, cantidadPreparada: 2 },
      { cantidad: 5, cantidadPreparada: 0 },
    ];
    expect(pedidoCompleto(conPendiente)).toBe(false);
    expect(pedidoCompleto(conPendiente.slice(0, 1))).toBe(true);
  });
});

describe("totalizarAvance", () => {
  it("suma unidades requeridas y preparadas, y cuenta líneas completas", () => {
    const r = totalizarAvance([
      { cantidad: 3, cantidadPreparada: 3 },
      { cantidad: 4, cantidadPreparada: 2 },
      { cantidad: 1, cantidadPreparada: 0 },
    ]);

    expect(r.unidadesRequeridas).toBe(8);
    expect(r.unidadesPreparadas).toBe(5);
    expect(r.lineasCompletas).toBe(1);
  });

  it("no deja que un dato sucio infle las unidades preparadas por encima de las pedidas", () => {
    const r = totalizarAvance([{ cantidad: 2, cantidadPreparada: 10 }]);
    expect(r.unidadesPreparadas).toBe(2);
  });
});

describe("validarCantidadPreparada (FR-029)", () => {
  it("rechaza preparar más unidades que las pedidas", () => {
    const r = validarCantidadPreparada(4, 3);
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.error).toContain("3 unidades");
  });

  it("rechaza cantidades negativas", () => {
    expect(validarCantidadPreparada(-1, 3).valido).toBe(false);
  });

  it("acepta 0 (sin avance) y el tope exacto", () => {
    expect(validarCantidadPreparada(0, 3).valido).toBe(true);
    expect(validarCantidadPreparada(3, 3).valido).toBe(true);
  });

  it("acepta parciales", () => {
    expect(validarCantidadPreparada(2, 3).valido).toBe(true);
  });
});

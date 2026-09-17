import { describe, it, expect } from "vitest";
import { calcularSellado, iniciadaEnAlMaterializar, type EstadoDestino, type PreparacionActual } from "./sellado";

const AHORA = new Date("2026-09-17T15:00:00.000Z");
const ANTES = new Date("2026-09-17T09:30:00.000Z");

const porPreparar: EstadoDestino = { id: "e1", nombre: "Por preparar", marcaInicio: false, esFinal: false };
const preparando: EstadoDestino = { id: "e2", nombre: "Preparando", marcaInicio: true, esFinal: false };
const preparado: EstadoDestino = { id: "e3", nombre: "Preparado", marcaInicio: false, esFinal: true };

function actual(over: Partial<PreparacionActual> = {}): PreparacionActual {
  return {
    estadoId: "e1",
    iniciadaEn: null,
    completadaEn: null,
    asignadaAId: null,
    estadoNombre: "Por preparar",
    estadoActualEsFinal: false,
    ...over,
  };
}

describe("calcularSellado (026) — reglas de sellado de fechas y responsable", () => {
  it("sella iniciadaEn al entrar al estado con marcaInicio", () => {
    const r = calcularSellado({ actual: actual(), destino: preparando, usuarioId: "u1", ahora: AHORA });

    expect(r.iniciadaEn).toEqual(AHORA);
    expect(r.sellaInicio).toBe(true);
    expect(r.completadaEn).toBeNull();
    expect(r.asignadaAId).toBeNull();
  });

  it("NO re-sella iniciadaEn si el pedido vuelve a pasar por el estado que la marca", () => {
    const r = calcularSellado({
      actual: actual({ iniciadaEn: ANTES, estadoId: "e1" }),
      destino: preparando,
      usuarioId: "u2",
      ahora: AHORA,
    });

    expect(r.iniciadaEn).toEqual(ANTES);
    expect(r.sellaInicio).toBe(false);
  });

  it("sella completadaEn y asignadaAId con el usuario que movió al estado final", () => {
    const r = calcularSellado({
      actual: actual({ iniciadaEn: ANTES, estadoId: "e2" }),
      destino: preparado,
      usuarioId: "u-cierra",
      ahora: AHORA,
    });

    expect(r.completadaEn).toEqual(AHORA);
    expect(r.asignadaAId).toBe("u-cierra");
    expect(r.completa).toBe(true);
    expect(r.iniciadaEn).toEqual(ANTES);
  });

  it("limpia completadaEn y asignadaAId al retroceder desde el estado final", () => {
    const r = calcularSellado({
      actual: actual({
        estadoId: "e3",
        iniciadaEn: ANTES,
        completadaEn: AHORA,
        asignadaAId: "u-cierra",
        estadoNombre: "Preparado",
        estadoActualEsFinal: true,
      }),
      destino: preparando,
      usuarioId: "u-reabre",
      ahora: new Date("2026-09-17T16:00:00.000Z"),
    });

    expect(r.completadaEn).toBeNull();
    expect(r.asignadaAId).toBeNull();
    expect(r.reabre).toBe(true);
    // El inicio original se conserva: reabrir no borra cuándo empezó el armado.
    expect(r.iniciadaEn).toEqual(ANTES);
  });

  it("no toca fin ni responsable en un movimiento entre estados intermedios", () => {
    const r = calcularSellado({
      actual: actual({ estadoId: "e2", iniciadaEn: ANTES }),
      destino: porPreparar,
      usuarioId: "u1",
      ahora: AHORA,
    });

    expect(r.completadaEn).toBeNull();
    expect(r.asignadaAId).toBeNull();
    expect(r.completa).toBe(false);
    expect(r.reabre).toBe(false);
  });
});

describe("invariantes de PreparacionPedido (data-model.md)", () => {
  it("completadaEn no nulo ⟺ el destino es el estado final", () => {
    const alFinal = calcularSellado({ actual: actual({ iniciadaEn: ANTES }), destino: preparado, usuarioId: "u1", ahora: AHORA });
    const intermedio = calcularSellado({ actual: actual({ iniciadaEn: ANTES }), destino: preparando, usuarioId: "u1", ahora: AHORA });

    expect(alFinal.completadaEn).not.toBeNull();
    expect(intermedio.completadaEn).toBeNull();
  });

  it("completadaEn no nulo ⟹ iniciadaEn no nulo, incluso si nadie pasó por el estado de inicio", () => {
    // Caso real: flujo de 2 estados donde el pedido salta directo a "Preparado".
    // iniciadaEn viene sellada de la materialización, no de esta transición.
    const r = calcularSellado({ actual: actual({ iniciadaEn: ANTES }), destino: preparado, usuarioId: "u1", ahora: AHORA });

    expect(r.completadaEn).not.toBeNull();
    expect(r.iniciadaEn).not.toBeNull();
  });

  it("asignadaAId no nulo ⟹ completadaEn no nulo", () => {
    const r = calcularSellado({ actual: actual({ iniciadaEn: ANTES }), destino: preparado, usuarioId: "u1", ahora: AHORA });
    expect(r.asignadaAId).not.toBeNull();
    expect(r.completadaEn).not.toBeNull();

    const intermedio = calcularSellado({ actual: actual(), destino: preparando, usuarioId: "u1", ahora: AHORA });
    expect(intermedio.asignadaAId).toBeNull();
  });

  it("cerrar sin usuario en sesión deja responsable nulo pero completa igual", () => {
    const r = calcularSellado({ actual: actual({ iniciadaEn: ANTES }), destino: preparado, usuarioId: null, ahora: AHORA });

    expect(r.completa).toBe(true);
    expect(r.completadaEn).toEqual(AHORA);
    expect(r.asignadaAId).toBeNull();
  });
});

describe("iniciadaEnAlMaterializar (FR-013)", () => {
  it("sella el inicio al entrar al tablero cuando ningún estado marca inicio (flujo de 2 estados)", () => {
    const r = iniciadaEnAlMaterializar({ algunEstadoMarcaInicio: false, estadoInicialMarcaInicio: false, ahora: AHORA });
    expect(r).toEqual(AHORA);
  });

  it("sella el inicio si el propio estado inicial marca inicio", () => {
    const r = iniciadaEnAlMaterializar({ algunEstadoMarcaInicio: true, estadoInicialMarcaInicio: true, ahora: AHORA });
    expect(r).toEqual(AHORA);
  });

  it("no sella nada si hay un estado posterior que marca el inicio", () => {
    const r = iniciadaEnAlMaterializar({ algunEstadoMarcaInicio: true, estadoInicialMarcaInicio: false, ahora: AHORA });
    expect(r).toBeNull();
  });
});

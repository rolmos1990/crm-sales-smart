import { describe, expect, it } from "vitest";
import { fusionarConsumoProveedores } from "./fusion";
import type { ConsumoProveedor, ConsumoVoz, ProveedorVozListado } from "./queries";

function proveedor(id: string, alias: string, activo = true): ProveedorVozListado {
  return {
    id,
    alias,
    proveedor: "ELEVENLABS",
    baseUrl: null,
    modelo: "scribe_v3",
    activo,
    prioridad: 1,
    costoPorHora: "0.40",
    limiteMinutosDia: null,
    timeoutMs: 30000,
    reintentosMax: 2,
    tieneCredencial: true,
  };
}

function consumo(minutos: number, costo: number | null, transcripciones = 1): ConsumoVoz {
  return {
    minutos,
    costo,
    costoCobertura: costo === null ? "NO_ESTIMABLE" : "COMPLETO",
    transcripciones,
  };
}

function grupo(proveedorVozId: string | null, c: ConsumoVoz): ConsumoProveedor {
  return { proveedorVozId, consumo: c };
}

describe("fusionarConsumoProveedores", () => {
  it("asigna a cada proveedor su consumo", () => {
    const { conConsumo } = fusionarConsumoProveedores(
      [proveedor("a", "ElevenLabs prod"), proveedor("b", "Groq respaldo")],
      [grupo("a", consumo(98.0, 2.61, 40)), grupo("b", consumo(44.3, 1.35, 21))],
    );

    expect(conConsumo.map((p) => p.consumoMes.minutos)).toEqual([98.0, 44.3]);
    expect(conConsumo.map((p) => p.consumoMes.costo)).toEqual([2.61, 1.35]);
  });

  it("un proveedor sin consumo queda en cero y con transcripciones 0", () => {
    const { conConsumo } = fusionarConsumoProveedores(
      [proveedor("a", "ElevenLabs"), proveedor("b", "Groq")],
      [grupo("a", consumo(98.0, 2.61, 40))],
    );

    expect(conConsumo[1]!.consumoMes).toEqual({
      minutos: 0,
      costo: null,
      costoCobertura: "NO_ESTIMABLE",
      transcripciones: 0,
    });
  });

  it("preserva el orden de la lista con activos e inactivos mezclados", () => {
    const { conConsumo } = fusionarConsumoProveedores(
      [
        proveedor("a", "Activo uno"),
        proveedor("b", "Inactivo", false),
        proveedor("c", "Activo dos"),
      ],
      [grupo("c", consumo(10, 1)), grupo("a", consumo(20, 2))],
    );

    expect(conConsumo.map((p) => p.alias)).toEqual(["Activo uno", "Inactivo", "Activo dos"]);
  });

  it("un proveedor desactivado conserva lo que ya consumió", () => {
    const { conConsumo } = fusionarConsumoProveedores(
      [proveedor("a", "Apagado", false)],
      [grupo("a", consumo(98.0, 2.61, 40))],
    );

    expect(conConsumo[0]!.consumoMes.minutos).toBe(98.0);
  });

  it("no filtra credenciales: el listado de entrada ya las excluye", () => {
    const { conConsumo } = fusionarConsumoProveedores([proveedor("a", "X")], []);

    expect(conConsumo[0]).not.toHaveProperty("apiKeyEncriptada");
  });

  // --- Proveedores eliminados (US2) ---

  it("saca el grupo huérfano por 'eliminados'", () => {
    const { conConsumo, eliminados } = fusionarConsumoProveedores(
      [proveedor("a", "ElevenLabs")],
      [grupo("a", consumo(98.0, 2.61, 40)), grupo(null, consumo(12.0, 0.31, 6))],
    );

    expect(conConsumo).toHaveLength(1);
    expect(eliminados).toEqual({
      minutos: 12.0,
      costo: 0.31,
      costoCobertura: "COMPLETO",
      transcripciones: 6,
    });
  });

  it("sin grupo huérfano, 'eliminados' es null", () => {
    const { eliminados } = fusionarConsumoProveedores(
      [proveedor("a", "ElevenLabs")],
      [grupo("a", consumo(98.0, 2.61, 40))],
    );

    expect(eliminados).toBeNull();
  });

  it("dos proveedores eliminados colapsan en UNA entrada con la suma", () => {
    // El groupBy devuelve un solo grupo con proveedorVozId null, pero si por
    // cualquier razón llegaran separados, la fusión igual los suma.
    const { eliminados } = fusionarConsumoProveedores(
      [],
      [grupo(null, consumo(12.0, 0.31, 6)), grupo("ya-borrado", consumo(8.5, 0.22, 4))],
    );

    expect(eliminados).toEqual({
      minutos: 20.5,
      costo: 0.53,
      costoCobertura: "COMPLETO",
      transcripciones: 10,
    });
  });

  it("acumula en 'eliminados' un grupo con id que no está configurado, en vez de descartarlo", () => {
    // Preservar que las filas sumen el total pesa más que la prolijidad de la
    // atribución: descartarlo dejaría la pantalla descuadrada sin síntoma.
    const { conConsumo, eliminados } = fusionarConsumoProveedores(
      [proveedor("a", "ElevenLabs")],
      [grupo("a", consumo(10, 1)), grupo("fantasma", consumo(5, 0.5))],
    );

    expect(conConsumo[0]!.consumoMes.minutos).toBe(10);
    expect(eliminados?.minutos).toBe(5);
  });

  it("lista de proveedores vacía con consumo huérfano deja solo 'eliminados'", () => {
    const { conConsumo, eliminados } = fusionarConsumoProveedores(
      [],
      [grupo(null, consumo(12.0, 0.31, 6))],
    );

    expect(conConsumo).toEqual([]);
    expect(eliminados?.minutos).toBe(12.0);
  });

  it("mezcla de huérfanos con y sin tarifa da cobertura PARCIAL", () => {
    const { eliminados } = fusionarConsumoProveedores(
      [],
      [grupo(null, consumo(12.0, 0.31, 6)), grupo("fantasma", consumo(8.0, null, 4))],
    );

    expect(eliminados?.costo).toBe(0.31);
    expect(eliminados?.costoCobertura).toBe("PARCIAL");
  });

  it("huérfanos todos sin tarifa dan costo null, nunca cero", () => {
    const { eliminados } = fusionarConsumoProveedores([], [grupo(null, consumo(8.0, null, 4))]);

    expect(eliminados?.costo).toBeNull();
    expect(eliminados?.costoCobertura).toBe("NO_ESTIMABLE");
  });
});

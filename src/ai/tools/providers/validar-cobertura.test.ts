import { describe, expect, it, vi, beforeEach } from "vitest";

const resolverCostoEnvioMock = vi.fn();
vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  resolverCostoEnvio: (...a: unknown[]) => resolverCostoEnvioMock(...a),
}));

const transferirAHumanoInternoMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/ai/tools/shared/transferir-a-humano-interno", () => ({
  transferirAHumanoInterno: (...a: unknown[]) => transferirAHumanoInternoMock(...a),
}));

await import("./validar-cobertura.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["validar_cobertura"] };

describe("validar_cobertura (019, Historia 3)", () => {
  beforeEach(() => {
    resolverCostoEnvioMock.mockReset();
    transferirAHumanoInternoMock.mockClear();
  });

  it("coincidencia clara: responde cubierta=true con los métodos que cubren", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: true, costo: 20, diasMin: null, diasMax: null, metodosQueCubren: ["COURIER_EXTERNO"] });
    const tool = registroHerramientas.get("validar_cobertura")!;
    const resultado = await tool.execute({ estadoProvincia: "Lima" }, ctx);
    expect(resultado.data).toEqual({ cubierta: true, metodosQueCubren: ["COURIER_EXTERNO"] });
    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });

  it("modo TODOS_LADOS_CON_EXCEPCIONES con zona en la lista de excepciones: cubierta=false, sin escalar", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: false, motivo: "Zona configurada como excepción — sin cobertura" });
    const tool = registroHerramientas.get("validar_cobertura")!;
    const resultado = await tool.execute({ estadoProvincia: "Centro Histórico" }, ctx);
    expect(resultado.data).toEqual({ cubierta: false, mensaje: "Zona configurada como excepción — sin cobertura" });
    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });

  it("modo SOLO_ZONAS_EVALUADAS con zona no listada: transfiere a humano en vez de responder 'no cubierta'", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "SIN_COINCIDENCIA_CLARA", motivo: "Zona pendiente de evaluación caso por caso" });
    const tool = registroHerramientas.get("validar_cobertura")!;
    const resultado = await tool.execute({ estadoProvincia: "Zona Sur" }, ctx);
    expect(transferirAHumanoInternoMock).toHaveBeenCalledTimes(1);
    const data = resultado.data as { transferidoAHumano: boolean };
    expect(data.transferidoAHumano).toBe(true);
  });

  it("dos transportistas cubren la misma zona con costos distintos: transfiere a humano (ambigüedad cruzada)", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "SIN_COINCIDENCIA_CLARA", motivo: "Más de un costo aplicable sin criterio para elegir" });
    const tool = registroHerramientas.get("validar_cobertura")!;
    const resultado = await tool.execute({ estadoProvincia: "Arequipa" }, ctx);
    expect(transferirAHumanoInternoMock).toHaveBeenCalledTimes(1);
    expect((resultado.data as { transferidoAHumano: boolean }).transferidoAHumano).toBe(true);
  });
});

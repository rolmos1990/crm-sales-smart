import { describe, expect, it, vi, beforeEach } from "vitest";

const resolverCostoEnvioMock = vi.fn();
vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  resolverCostoEnvio: (...a: unknown[]) => resolverCostoEnvioMock(...a),
}));

const transferirAHumanoInternoMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/ai/tools/shared/transferir-a-humano-interno", () => ({
  transferirAHumanoInterno: (...a: unknown[]) => transferirAHumanoInternoMock(...a),
}));

await import("./estimar-fecha-entrega.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["estimar_fecha_entrega"] };

describe("estimar_fecha_entrega (019, Historia 3)", () => {
  beforeEach(() => {
    resolverCostoEnvioMock.mockReset();
    transferirAHumanoInternoMock.mockClear();
  });

  it("coincidencia clara con rango configurado: responde diasMin/diasMax", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: true, costo: 20, diasMin: 2, diasMax: 5, metodosQueCubren: ["COURIER_EXTERNO"] });
    const tool = registroHerramientas.get("estimar_fecha_entrega")!;
    const resultado = await tool.execute({ estadoProvincia: "Lima" }, ctx);
    expect(resultado.data).toEqual({ diasMin: 2, diasMax: 5 });
  });

  it("coincidencia clara sin rango configurado: mensaje explicativo, sin inventar fechas", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: true, costo: 20, diasMin: null, diasMax: null, metodosQueCubren: ["COURIER_EXTERNO"] });
    const tool = registroHerramientas.get("estimar_fecha_entrega")!;
    const resultado = await tool.execute({ estadoProvincia: "Lima" }, ctx);
    expect(resultado.data).toEqual({ mensaje: "Sin tiempo estimado configurado para esta ubicación" });
  });

  it("sin coincidencia clara: transfiere a humano en vez de estimar una fecha", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "SIN_COINCIDENCIA_CLARA", motivo: "Ubicación no reconocida y sin configuración aplicable" });
    const tool = registroHerramientas.get("estimar_fecha_entrega")!;
    const resultado = await tool.execute({ estadoProvincia: "Ubicación desconocida" }, ctx);
    expect(transferirAHumanoInternoMock).toHaveBeenCalledTimes(1);
    expect((resultado.data as { transferidoAHumano: boolean }).transferidoAHumano).toBe(true);
  });
});

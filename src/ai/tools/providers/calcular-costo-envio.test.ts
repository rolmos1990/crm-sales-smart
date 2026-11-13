import { describe, expect, it, vi, beforeEach } from "vitest";

const resolverCostoEnvioMock = vi.fn();
const listarCiudadesCubiertasMock = vi.fn().mockResolvedValue([]);
vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  resolverCostoEnvio: (...a: unknown[]) => resolverCostoEnvioMock(...a),
  // Por defecto sin distritos que ofrecer: así los casos de abajo siguen
  // comprobando la escalación tal como antes de que se pudiera preguntar
  // la ciudad.
  listarCiudadesCubiertasPorProvincia: (...a: unknown[]) => listarCiudadesCubiertasMock(...a),
}));

const transferirAHumanoInternoMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/ai/tools/shared/transferir-a-humano-interno", () => ({
  transferirAHumanoInterno: (...a: unknown[]) => transferirAHumanoInternoMock(...a),
}));

await import("./calcular-costo-envio.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["calcular_costo_envio"] };

describe("calcular_costo_envio (019, Historia 3)", () => {
  beforeEach(() => {
    resolverCostoEnvioMock.mockReset();
    transferirAHumanoInternoMock.mockClear();
  });

  it("coincidencia clara: responde el costo exacto, sin escalar", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: true, costo: 25, diasMin: 1, diasMax: 3, metodosQueCubren: ["COURIER_EXTERNO"] });
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ estadoProvincia: "Lima" }, ctx);
    expect(resultado.data).toEqual({ cubierto: true, costo: 25 });
    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });

  it("excepción explícita (clara, negativa): responde no cubierto, sin escalar", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "CLARA", cubierto: false, motivo: "Zona configurada como excepción — sin cobertura" });
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ estadoProvincia: "Centro Histórico" }, ctx);
    expect(resultado.data).toEqual({ cubierto: false, mensaje: "Zona configurada como excepción — sin cobertura" });
    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });

  it("sin coincidencia clara: transfiere a humano de inmediato y no informa costo (FR-009, muy importante)", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "SIN_COINCIDENCIA_CLARA", motivo: "Más de un costo aplicable sin criterio para elegir" });
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ estadoProvincia: "Cusco" }, ctx);
    expect(transferirAHumanoInternoMock).toHaveBeenCalledTimes(1);
    expect(transferirAHumanoInternoMock).toHaveBeenCalledWith(ctx, expect.stringContaining("Más de un costo aplicable"));
    const data = resultado.data as { transferidoAHumano: boolean; mensaje: string };
    expect(data.transferidoAHumano).toBe(true);
    expect(data).not.toHaveProperty("costo");
  });

  it("argumentos inválidos: error sin invocar el resolver", async () => {
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({}, ctx);
    expect(resultado.ok).toBe(false);
    expect(resolverCostoEnvioMock).not.toHaveBeenCalled();
  });
});

describe("calcular_costo_envio — provincia sin distrito (caso Chiriquí)", () => {
  beforeEach(() => {
    resolverCostoEnvioMock.mockReset();
    listarCiudadesCubiertasMock.mockReset().mockResolvedValue([]);
    transferirAHumanoInternoMock.mockClear();
  });

  it("devuelve los distritos a preguntar en vez de escalar", async () => {
    // Lo que pasa de verdad: obtenerCandidatosEnvioPorZona exige cada nivel
    // que la zona define, así que la provincia sola no da candidatos.
    resolverCostoEnvioMock.mockResolvedValue({
      estado: "SIN_COINCIDENCIA_CLARA",
      motivo: "Sin configuración de costo para esta ubicación",
    });
    listarCiudadesCubiertasMock.mockResolvedValue(["David", "Boquete"]);

    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ estadoProvincia: "Chiriquí" }, ctx);
    const data = resultado.data as { requiereCiudad?: boolean; ciudades?: string[]; transferidoAHumano?: boolean };

    expect(data.transferidoAHumano).toBeUndefined();
    expect(data.requiereCiudad).toBe(true);
    expect(data.ciudades).toEqual(["David", "Boquete"]);
  });

  it("la conversación NO queda marcada en atención humana", async () => {
    resolverCostoEnvioMock.mockResolvedValue({ estado: "SIN_COINCIDENCIA_CLARA", motivo: "x" });
    listarCiudadesCubiertasMock.mockResolvedValue(["David"]);

    await registroHerramientas.get("calcular_costo_envio")!.execute({ estadoProvincia: "Chiriquí" }, ctx);

    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });
});

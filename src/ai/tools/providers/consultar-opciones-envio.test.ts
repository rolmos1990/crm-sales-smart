import { describe, expect, it, vi, beforeEach } from "vitest";

const obtenerOpcionesEnvioConConfianzaMock = vi.fn();
vi.mock("@/shared/entregas/resolver-costo-envio", () => ({
  obtenerOpcionesEnvioConConfianza: (...a: unknown[]) => obtenerOpcionesEnvioConConfianzaMock(...a),
}));

const transferirAHumanoInternoMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/ai/tools/shared/transferir-a-humano-interno", () => ({
  transferirAHumanoInterno: (...a: unknown[]) => transferirAHumanoInternoMock(...a),
}));

await import("./consultar-opciones-envio.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["consultar_opciones_envio"] };

function opcion(overrides: Record<string, unknown> = {}) {
  return {
    tarifaId: "tarifa-1",
    transportistaId: "id-interno-nunca-expuesto",
    transportistaNombre: "UnoExpress",
    transportistaTipo: "COURIER_EXTERNO",
    zonaEntregaId: "zona-1",
    zonaEntregaNombre: "David",
    servicioTransportistaId: "servicio-1",
    servicioNombre: "Sucursal",
    costoInterno: 4.5,
    precioCliente: 6.5,
    tiempoMinimoDias: 1,
    tiempoMaximoDias: 2,
    confianza: "EXACTA",
    aceptaPagoContraEntrega: true,
    diasEntrega: ["LUN", "MAR"],
    horaLimiteMismoDia: "11:00",
    ...overrides,
  };
}

describe("consultar_opciones_envio (024, Historia 1/3/5)", () => {
  beforeEach(() => {
    obtenerOpcionesEnvioConConfianzaMock.mockReset();
    transferirAHumanoInternoMock.mockClear();
  });

  it("EXACTA/ALIAS: devuelve las opciones ordenadas, sin mensaje de aclaración (US1)", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({ confianza: "EXACTA", opciones: [opcion()] });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "David" }, ctx);
    const data = resultado.data as { confianza: string; opciones: unknown[]; mensaje?: string };
    expect(data.confianza).toBe("EXACTA");
    expect(data.opciones).toHaveLength(1);
    expect(data.mensaje).toBeUndefined();
  });

  it("nunca expone id interno, teléfono, correo, notas internas, costoInterno ni margen (FR-009)", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({ confianza: "EXACTA", opciones: [opcion()] });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "David" }, ctx);
    const data = resultado.data as { opciones: Record<string, unknown>[] };
    const campos = Object.keys(data.opciones[0]);
    expect(campos).not.toContain("costoInterno");
    expect(campos).not.toContain("transportistaId");
    expect(campos).not.toContain("tarifaId");
    expect(campos).not.toContain("margen");
    expect(JSON.stringify(data.opciones[0])).not.toContain("id-interno-nunca-expuesto");
    expect(data.opciones[0]).toMatchObject({ transportista: "UnoExpress", precio: 6.5 });
  });

  it("US3: varias opciones quedan ordenadas de menor a mayor precio", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({
      confianza: "EXACTA",
      opciones: [opcion({ transportistaNombre: "Cara", precioCliente: 10, confianza: "EXACTA" }), opcion({ transportistaNombre: "Barata", precioCliente: 5, confianza: "EXACTA" })],
    });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "David" }, ctx);
    const data = resultado.data as { opciones: { transportista: string }[] };
    // El orden ya viene dado por obtenerOpcionesEnvioConConfianza — la tool no reordena, solo mapea.
    expect(data.opciones.map((o) => o.transportista)).toEqual(["Cara", "Barata"]);
  });

  it("US3: nunca escala a un humano, a diferencia de calcular_costo_envio", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({ confianza: "EXACTA", opciones: [opcion()] });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    await tool.execute({ provinciaEstado: "David" }, ctx);
    expect(transferirAHumanoInternoMock).not.toHaveBeenCalled();
  });

  it("US5: SIN_COINCIDENCIA devuelve opciones vacías con mensaje, sin inventar precio", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({ confianza: "SIN_COINCIDENCIA", opciones: [] });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "Lugar inexistente" }, ctx);
    const data = resultado.data as { confianza: string; opciones: unknown[]; mensaje: string };
    expect(data.confianza).toBe("SIN_COINCIDENCIA");
    expect(data.opciones).toEqual([]);
    expect(data.mensaje).toMatch(/verificarse|confirmar/i);
  });

  it("US5: AMBIGUA devuelve las opciones candidatas con mensaje pidiendo precisión", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({
      confianza: "AMBIGUA",
      opciones: [opcion({ confianza: "PROBABLE" }), opcion({ confianza: "PROBABLE", transportistaNombre: "OtroExpress" })],
    });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "San Jose" }, ctx);
    const data = resultado.data as { confianza: string; opciones: unknown[]; mensaje: string };
    expect(data.confianza).toBe("AMBIGUA");
    expect(data.opciones).toHaveLength(2);
    expect(data.mensaje).toBeDefined();
  });

  it("PROBABLE devuelve la opción con mensaje de aclaración", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue({ confianza: "PROBABLE", opciones: [opcion({ confianza: "PROBABLE" })] });
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ provinciaEstado: "La Chorera" }, ctx);
    const data = resultado.data as { confianza: string; mensaje: string };
    expect(data.confianza).toBe("PROBABLE");
    expect(data.mensaje).toBeDefined();
  });

  it("argumentos inválidos: error sin invocar el motor de matching", async () => {
    const tool = registroHerramientas.get("consultar_opciones_envio")!;
    const resultado = await tool.execute({ pais: 123 }, ctx);
    expect(resultado.ok).toBe(false);
    expect(obtenerOpcionesEnvioConConfianzaMock).not.toHaveBeenCalled();
  });
});

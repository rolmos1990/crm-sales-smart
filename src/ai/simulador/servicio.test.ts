import { describe, expect, it, vi, beforeEach } from "vitest";

const agenteIAConfigFindUniqueMock = vi.fn();
const agenteIAConfigVersionFindFirstMock = vi.fn();
const metodoEntregaConfigCountMock = vi.fn();
const cotizacionCountMock = vi.fn();
const cotizacionCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
    agenteIAConfigVersion: { findFirst: (...a: unknown[]) => agenteIAConfigVersionFindFirstMock(...a) },
    metodoEntregaConfig: { count: (...a: unknown[]) => metodoEntregaConfigCountMock(...a) },
    cotizacion: { count: (...a: unknown[]) => cotizacionCountMock(...a), create: (...a: unknown[]) => cotizacionCreateMock(...a) },
  },
}));

vi.mock("@/ai/contexto/context-builder", () => ({
  construirContextoCompuesto: vi.fn().mockResolvedValue({
    systemPrompt: "Eres un asistente de ventas.",
    estrategiaSeleccionada: null,
    perfilClienteUsado: true,
    ejemplosUtilizadosIds: [],
  }),
}));

vi.mock("@/ai/piloto/recuperador-ejemplos", () => ({
  recuperadorEjemplos: { recuperar: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/ai/autonomia/queries", () => ({
  obtenerAutonomiaPorAgente: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/ai/autonomia/clasificador", () => ({
  clasificarCategoriaIntencion: vi.fn().mockResolvedValue(null),
}));

const generarRespuestaMock = vi.fn();
const generarConHerramientasMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a),
  generarConHerramientas: (...a: unknown[]) => generarConHerramientasMock(...a),
}));

const { simuladorService } = await import("./servicio");

const escenarioBase = {
  agenteIAConfigId: "agente-1",
  instanciaId: "instancia-1",
  cliente: { tipoRelacion: "CLIENTE_NUEVO" as const, intencion: "EXPLORANDO" as const },
  usarBorrador: false,
  mensajes: ["Hola, ¿tienen el producto X?"],
};

describe("SimuladorService.ejecutar (018, Historia 1)", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({ herramientas: null, objetivo: "ventas" });
    agenteIAConfigVersionFindFirstMock.mockReset();
    metodoEntregaConfigCountMock.mockReset().mockResolvedValue(1);
    cotizacionCountMock.mockReset();
    cotizacionCreateMock.mockReset();
    generarRespuestaMock.mockReset().mockResolvedValue({ contenido: "Sí, tenemos el producto X disponible." });
    generarConHerramientasMock.mockReset();
  });

  it("devuelve un DiagnosticoRespuestaSimulada con todos los campos disponibles poblados", async () => {
    const diagnosticos = await simuladorService.ejecutar(escenarioBase);
    expect(diagnosticos).toHaveLength(1);
    const [d] = diagnosticos;
    expect(d.respuesta).toBe("Sí, tenemos el producto X disponible.");
    expect(d.perfilClienteUsado).toEqual(escenarioBase.cliente);
    expect(d.informacionFaltante).toEqual([]);
    expect(d.herramientasEjecutadas).toEqual([]);
  });

  it("SC-002 — tras ejecutar una simulación que invoca crear_cotizacion, no existe ninguna Cotización nueva", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue({ herramientas: ["crear_cotizacion"], objetivo: "ventas" });
    generarConHerramientasMock
      .mockResolvedValueOnce({
        tipo: "tool_use",
        contenidoAsistente: [{ type: "tool_use", id: "call-1", name: "crear_cotizacion", input: { lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] } }],
        herramientasLlamadas: [{ id: "call-1", name: "crear_cotizacion", input: { lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] } }],
      })
      .mockResolvedValueOnce({ tipo: "texto", contenido: "Listo, preparé una cotización de prueba." });

    await simuladorService.ejecutar(escenarioBase);

    expect(cotizacionCountMock).not.toHaveBeenCalled();
    expect(cotizacionCreateMock).not.toHaveBeenCalled();
  });

  it("marca herramientasEjecutadas con previsualizado: true para tools que escriben", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue({ herramientas: ["crear_cotizacion"], objetivo: "ventas" });
    generarConHerramientasMock
      .mockResolvedValueOnce({
        tipo: "tool_use",
        contenidoAsistente: [{ type: "tool_use", id: "call-1", name: "crear_cotizacion", input: { lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] } }],
        herramientasLlamadas: [{ id: "call-1", name: "crear_cotizacion", input: { lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 100 }] } }],
      })
      .mockResolvedValueOnce({ tipo: "texto", contenido: "Listo." });

    const [d] = await simuladorService.ejecutar(escenarioBase);
    expect(d.herramientasEjecutadas).toEqual([
      expect.objectContaining({ nombre: "crear_cotizacion", previsualizado: true }),
    ]);
  });

  it("sin ningún MetodoEntregaConfig, la información faltante queda señalada en el diagnóstico (Escenario 2)", async () => {
    metodoEntregaConfigCountMock.mockResolvedValue(0);
    const [d] = await simuladorService.ejecutar(escenarioBase);
    expect(d.informacionFaltante).toContain("Sin métodos de entrega configurados — el agente no puede informar costos/plazos de envío reales.");
  });

  it("usarBorrador: true resuelve la configuración desde AgenteIAConfigVersion BORRADOR, no la vigente", async () => {
    agenteIAConfigVersionFindFirstMock.mockResolvedValue({ contenido: { objetivo: "ventas (borrador)" } });
    await simuladorService.ejecutar({ ...escenarioBase, usarBorrador: true });
    expect(agenteIAConfigVersionFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agenteIAConfigId: "agente-1", estado: "BORRADOR" } }),
    );
  });

  it("agente sin configuración: devuelve lista vacía sin lanzar", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue(null);
    const diagnosticos = await simuladorService.ejecutar(escenarioBase);
    expect(diagnosticos).toEqual([]);
  });
});

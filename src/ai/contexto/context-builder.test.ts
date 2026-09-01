import { describe, expect, it, vi, beforeEach } from "vitest";
import { construirSystemPrompt, type ConfigAgenteParaPrompt } from "@/ai/prompt/builder";

const producirCapaEstrategiaMock = vi.fn();
const producirCapaPerfilClienteMock = vi.fn();
const producirCapaEjemplosPilotoMock = vi.fn().mockResolvedValue({ texto: null, ejemplosIds: [] });

vi.mock("./capas/estrategia-activa", () => ({
  producirCapaEstrategia: (...a: unknown[]) => producirCapaEstrategiaMock(...a),
}));
vi.mock("./capas/perfil-cliente", () => ({
  producirCapaPerfilCliente: (...a: unknown[]) => producirCapaPerfilClienteMock(...a),
}));
// 014-conversaciones-piloto-ejemplos-relevantes — capa 9 ya no es un
// placeholder; se mockea acá para mantener este test como unitario puro de
// composición (sin tocar Prisma vía recuperador-ejemplos.ts).
vi.mock("./capas/ejemplos-piloto", () => ({
  producirCapaEjemplosPiloto: (...a: unknown[]) => producirCapaEjemplosPilotoMock(...a),
}));

const { construirContextoCompuesto } = await import("./context-builder");

const CONFIG_BASE: ConfigAgenteParaPrompt = {
  objetivo: "ventas",
  comportamientosProhibidos: ["Presionar para comprar"],
};

describe("construirContextoCompuesto (013, Historia 1 — retrocompatibilidad)", () => {
  beforeEach(() => {
    producirCapaEstrategiaMock.mockReset();
    producirCapaPerfilClienteMock.mockReset();
    producirCapaEjemplosPilotoMock.mockReset().mockResolvedValue({ texto: null, ejemplosIds: [] });
  });

  it("sin agenteIAConfigId ni contactoId, el systemPrompt es idéntico al de construirSystemPrompt directo (SC-001)", async () => {
    const esperado = construirSystemPrompt(CONFIG_BASE);
    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );
    expect(resultado.systemPrompt).toBe(esperado);
    expect(resultado.estrategiaSeleccionada).toBeNull();
    expect(resultado.perfilClienteUsado).toBe(false);
  });

  it("cuando las capas de estrategia y perfil resuelven null, el resultado es idéntico al de siempre (agente con agenteIAConfigId/contactoId pero sin datos)", async () => {
    producirCapaEstrategiaMock.mockResolvedValue({ texto: null, estrategiaSeleccionada: null });
    producirCapaPerfilClienteMock.mockResolvedValue(null);

    const esperado = construirSystemPrompt(CONFIG_BASE);
    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1", agenteIAConfigId: "agente-1", contactoId: "contacto-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );
    expect(resultado.systemPrompt).toBe(esperado);
  });
});

describe("construirContextoCompuesto (013, Historia 2 — estrategia y perfil reales)", () => {
  beforeEach(() => {
    producirCapaEstrategiaMock.mockReset();
    producirCapaPerfilClienteMock.mockReset();
    producirCapaEjemplosPilotoMock.mockReset().mockResolvedValue({ texto: null, ejemplosIds: [] });
  });

  it("incluye el texto de la estrategia seleccionada y expone su metadata", async () => {
    producirCapaEstrategiaMock.mockResolvedValue({
      texto: "Estrategia activa para esta conversación (Cliente nuevo):\n- Generar confianza",
      estrategiaSeleccionada: { id: "pb-1", nombre: "Cliente nuevo" },
    });
    producirCapaPerfilClienteMock.mockResolvedValue(null);

    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1", agenteIAConfigId: "agente-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );

    expect(resultado.systemPrompt).toContain("Cliente nuevo");
    expect(resultado.estrategiaSeleccionada).toEqual({ id: "pb-1", nombre: "Cliente nuevo" });
  });

  it("la regla obligatoria (capa 3) queda posicionada antes que el contenido de la estrategia (capa 4), nunca al revés", async () => {
    producirCapaEstrategiaMock.mockResolvedValue({
      texto: "Estrategia activa para esta conversación (Descuento agresivo):\n- Ofrecer un descuento si el cliente duda",
      estrategiaSeleccionada: { id: "pb-2", nombre: "Descuento agresivo" },
    });
    producirCapaPerfilClienteMock.mockResolvedValue(null);

    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1", agenteIAConfigId: "agente-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );

    const indiceReglaObligatoria = resultado.systemPrompt.indexOf("No hagas esto: Presionar para comprar");
    const indiceEstrategia = resultado.systemPrompt.indexOf("Descuento agresivo");
    expect(indiceReglaObligatoria).toBeGreaterThanOrEqual(0);
    expect(indiceEstrategia).toBeGreaterThan(indiceReglaObligatoria);
  });

  it("separa perfil objetivo de interpretado, y expone perfilClienteUsado=true", async () => {
    producirCapaEstrategiaMock.mockResolvedValue({ texto: null, estrategiaSeleccionada: null });
    producirCapaPerfilClienteMock.mockResolvedValue({
      contactoId: "contacto-1",
      tipoRelacion: "CLIENTE_REGULAR",
      datosObjetivos: {} as never,
      datosInterpretados: { intencionComercialActual: "EXPLORANDO", productosConsultados: [], preferenciasIdentificadas: [], presupuestoConocido: null, ocasionActual: null, fechaRequerida: null, confianza: 0.7, extraidoEn: new Date().toISOString() },
      senalesObjetivas: ["Ha completado 3 pedidos."],
      calculadoEn: new Date().toISOString(),
      disparadoPor: null,
    });

    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1", agenteIAConfigId: "agente-1", contactoId: "contacto-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );

    expect(resultado.perfilClienteUsado).toBe(true);
    expect(resultado.systemPrompt).toContain("Datos objetivos del cliente:");
    expect(resultado.systemPrompt).toContain("Ha completado 3 pedidos.");
    expect(resultado.systemPrompt).toContain("interpretada, no confirmada");
  });

  it("agente sin configuración (null) devuelve systemPrompt vacío sin lanzar", async () => {
    const resultado = await construirContextoCompuesto({ instanciaId: "instancia-1" }, { configAgente: null, contextoDinamico: {} });
    expect(resultado.systemPrompt).toBe("");
    expect(producirCapaEstrategiaMock).not.toHaveBeenCalled();
  });

  it("014 — incluye el contenido de la capa de ejemplos piloto cuando la capa produce texto", async () => {
    producirCapaEstrategiaMock.mockResolvedValue({ texto: null, estrategiaSeleccionada: null });
    producirCapaPerfilClienteMock.mockResolvedValue(null);
    producirCapaEjemplosPilotoMock.mockResolvedValue({ texto: "Ejemplos de referencia de conversaciones anteriores:\nEjemplo 1:\nuser: hola\nassistant: hola, ¿en qué te ayudo?", ejemplosIds: ["ej-1"] });

    const resultado = await construirContextoCompuesto(
      { instanciaId: "instancia-1", agenteIAConfigId: "agente-1" },
      { configAgente: CONFIG_BASE, contextoDinamico: {} },
    );

    expect(resultado.systemPrompt).toContain("Ejemplos de referencia de conversaciones anteriores");
    expect(resultado.ejemplosUtilizadosIds).toEqual(["ej-1"]);
  });
});

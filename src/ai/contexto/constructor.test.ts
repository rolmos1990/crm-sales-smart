import { describe, expect, it, vi, beforeEach } from "vitest";

// Regresión de la cadena real de una conversación (la que usa
// responderConAgente), que es distinta de la del simulador: el simulador lee
// la fila entera de AgenteIAConfig y acá hay un `select` explícito. Cuando
// ese select se quedó sin `instruccionesAgente`, el bloque de instrucciones
// que el negocio escribe en el modal no llegaba al modelo en producción
// aunque en el Simulador se viera perfecto.

const agenteFindUniqueMock = vi.fn();
const construirContextoCompuestoMock = vi.fn();
const conversacionFindUniqueMock = vi.fn();
const mensajeFindFirstMock = vi.fn();
const resolverDecisionContextoMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findUnique: (...a: unknown[]) => conversacionFindUniqueMock(...a) },
    contacto: { findUnique: vi.fn().mockResolvedValue(null) },
    oportunidad: { findUnique: vi.fn().mockResolvedValue(null) },
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteFindUniqueMock(...a) },
    mensajeConversacion: { findFirst: (...a: unknown[]) => mensajeFindFirstMock(...a) },
  },
}));
vi.mock("./context-builder", () => ({
  construirContextoCompuesto: (...a: unknown[]) => construirContextoCompuestoMock(...a),
}));
vi.mock("./router", () => ({
  resolverDecisionContexto: (...a: unknown[]) => resolverDecisionContextoMock(...a),
}));

const { construirContexto } = await import("./constructor");

const INSTRUCCIONES = "# Rol\nSos el asesor de Decostore.\n7. Métodos de pago: se le comparte @plantilla:metodo_de_pago";

/** Conversación de `total` mensajes alternando cliente/agente, más recientes primero. */
function conversacionCon(total: number, opciones: { sinTextoEnIndices?: number[] } = {}) {
  const mensajes = Array.from({ length: total }, (_, i) => ({
    contenido: opciones.sinTextoEnIndices?.includes(i) ? null : `mensaje-${i}`,
    remitente: i % 2 === 0 ? "CONTACTO" : "AGENTE",
    creadoEn: new Date(2026, 0, 1, 12, total - i),
  }));
  return {
    id: "conv-1",
    cuentaCanal: { canal: "WHATSAPP" },
    contacto: { nombre: "Ana" },
    _count: { mensajes: total },
    mensajes,
  };
}

beforeEach(() => {
  conversacionFindUniqueMock.mockReset().mockResolvedValue(null);
  mensajeFindFirstMock.mockReset().mockResolvedValue(null);
  resolverDecisionContextoMock.mockReset().mockReturnValue({ mensajesAIncluir: 10 });
  agenteFindUniqueMock.mockReset().mockResolvedValue({
    instruccionesAgente: INSTRUCCIONES,
    objetivo: "ventas",
    personalidad: null,
    especialidad: null,
    instrucciones: null,
    sistemaPrompt: null,
    configuracionTono: null,
    limiteTokensCtx: 4000,
    respuestasGuia: null,
    catalogoEnContexto: true,
    limiteCatalogoContexto: 30,
  });
  construirContextoCompuestoMock.mockReset().mockResolvedValue({
    systemPrompt: "prompt",
    estrategiaSeleccionada: null,
    perfilClienteUsado: false,
    ejemplosUtilizadosIds: [],
  });
});

describe("construirContexto — instrucciones del agente", () => {
  it("pide instruccionesAgente en el select", async () => {
    await construirContexto({ instanciaId: "inst-1", agenteIAConfigId: "ag-1" });

    expect(agenteFindUniqueMock.mock.calls[0][0].select).toMatchObject({ instruccionesAgente: true });
  });

  it("se lo pasa a construirContextoCompuesto, que es quien expande las referencias `@`", async () => {
    await construirContexto({ instanciaId: "inst-1", agenteIAConfigId: "ag-1" });

    const { configAgente } = construirContextoCompuestoMock.mock.calls[0][1];
    expect(configAgente.instruccionesAgente).toBe(INSTRUCCIONES);
  });
});

// 031-memoria-y-ficha-conversacion (FR-002) — red de seguridad: sin
// configuración de memoria, la cantidad de mensajes la sigue decidiendo el
// presupuesto de tokens, exactamente como antes de la feature.
describe("construirContexto — sin configuración de memoria (031, FR-002)", () => {
  it("no le pasa ningún override al router: manda el presupuesto de tokens", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(20));

    await construirContexto({ instanciaId: "inst-1", conversacionId: "conv-1", agenteIAConfigId: "ag-1" });

    const opciones = resolverDecisionContextoMock.mock.calls[0][0];
    expect(opciones.limiteTokensCtx).toBe(4000);
    expect(opciones.override).toBeUndefined();
  });

  it("usa la cantidad que devolvió el router, sin tocarla", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(20));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 13 });

    const contexto = await construirContexto({ instanciaId: "inst-1", conversacionId: "conv-1", agenteIAConfigId: "ag-1" });

    expect(contexto.conversacion?.mensajes).toHaveLength(13);
  });
});

// 031-memoria-y-ficha-conversacion (FR-003, FR-004, FR-005) — los tres
// estados de la memoria del nodo. Tabla completa en quickstart.md paso 1a.
describe("construirContexto — memoria configurada (031, Historia 1)", () => {
  it("activa con cantidad N entrega exactamente los últimos N, en orden cronológico", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(20));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 5 });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: true, cantidad: 5 },
    });

    expect(resolverDecisionContextoMock.mock.calls[0][0].override).toBe(5);
    expect(contexto.conversacion?.mensajes).toHaveLength(5);
    // `mensajes` viene desc de Prisma; el contexto los entrega asc.
    expect(contexto.conversacion?.mensajes.map((m) => m.contenido)).toEqual([
      "mensaje-4",
      "mensaje-3",
      "mensaje-2",
      "mensaje-1",
      "mensaje-0",
    ]);
  });

  it("una conversación más corta que la cantidad pedida entrega lo que hay, sin error", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(2));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 5 });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: true, cantidad: 5 },
    });

    expect(contexto.conversacion?.mensajes).toHaveLength(2);
  });

  it("los mensajes sin texto no consumen cupo de la cantidad elegida (FR-005)", async () => {
    // De los 8 más recientes, 3 son solo imagen: pidiendo 5 tienen que
    // llegar 5 CON texto, no 5 lugares de los que 3 vengan vacíos.
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(12, { sinTextoEnIndices: [1, 3, 5] }));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 5 });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: true, cantidad: 5 },
    });

    expect(contexto.conversacion?.mensajes).toHaveLength(5);
    expect(contexto.conversacion?.mensajes.every((m) => m.contenido.length > 0)).toBe(true);
  });

  it("pide a Prisma más mensajes de los necesarios, para absorber los vacíos", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(60));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 30 });

    await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: true, cantidad: 30 },
    });

    const select = conversacionFindUniqueMock.mock.calls[0][0].select;
    expect(select.mensajes.take).toBeGreaterThan(30);
  });

  it("inactiva entrega solo el último mensaje del cliente, aunque el último de la conversación sea nuestro (FR-004, D2)", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(20));
    mensajeFindFirstMock.mockResolvedValue({
      contenido: "¿me pasás el precio?",
      remitente: "CONTACTO",
      creadoEn: new Date(2026, 0, 1, 12, 0),
    });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: false, cantidad: 10 },
    });

    expect(contexto.conversacion?.mensajes).toEqual([
      { rol: "user", contenido: "¿me pasás el precio?", creadoEn: new Date(2026, 0, 1, 12, 0) },
    ]);
    expect(mensajeFindFirstMock.mock.calls[0][0].where).toMatchObject({
      conversacionId: "conv-1",
      remitente: "CONTACTO",
    });
  });

  it("inactiva y sin ningún mensaje del cliente devuelve una lista vacía, sin lanzar", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(4));
    mensajeFindFirstMock.mockResolvedValue(null);

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: false, cantidad: 10 },
    });

    expect(contexto.conversacion?.mensajes).toEqual([]);
  });
});

describe("construirContexto — maxMensajes como tope duro (031, D1/D3)", () => {
  it("recorta por debajo de lo que pidió la memoria del nodo", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(40));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 30 });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      memoria: { activa: true, cantidad: 30 },
      maxMensajes: 15,
    });

    expect(contexto.conversacion?.mensajes).toHaveLength(15);
  });

  it("sin memoria configurada, también acota lo que devolvió el presupuesto", async () => {
    conversacionFindUniqueMock.mockResolvedValue(conversacionCon(40));
    resolverDecisionContextoMock.mockReturnValue({ mensajesAIncluir: 30 });

    const contexto = await construirContexto({
      instanciaId: "inst-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "ag-1",
      maxMensajes: 15,
    });

    expect(contexto.conversacion?.mensajes).toHaveLength(15);
  });
});

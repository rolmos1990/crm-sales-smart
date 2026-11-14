import { describe, expect, it, vi, beforeEach } from "vitest";

// Tool loop de la respuesta del agente: al agotar las iteraciones no puede
// descartarse lo que ya se ejecutó. El caso real que motivó esto: el cliente
// pidió una cotización, `crear_cotizacion` corrió con éxito en la última
// iteración y el cliente igual recibió "no pude completar tu solicitud".

vi.mock("@/ai/tools/inicializar", () => ({}));

const agenteIAConfigFindUniqueMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: {
      findUnique: vi.fn().mockResolvedValue({
        contactoId: "contacto-1",
        instanciaId: "instancia-1",
        modoAtencion: "WORKFLOW",
        oportunidades: [],
      }),
    },
    agenteIAConfig: {
      findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a),
      findFirst: vi.fn(),
    },
    mensajeConversacion: { findFirst: vi.fn().mockResolvedValue({ contenido: "¿Me envías la cotización?" }) },
  },
}));

const generarConHerramientasMock = vi.fn();
const generarRespuestaMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({
  generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a),
  generarConHerramientas: (...a: unknown[]) => generarConHerramientasMock(...a),
}));

const construirContextoMock = vi.fn().mockResolvedValue({});
vi.mock("@/ai/contexto/constructor", () => ({
  construirContexto: (...a: unknown[]) => construirContextoMock(...a),
  serializarContextoComoMensajes: vi.fn().mockReturnValue([{ rol: "system", contenido: "Eres un asistente." }]),
}));

const enviarMensajeMock = vi.fn();
vi.mock("@/conversaciones/envio", () => ({
  enviarMensajeInterno: (...a: unknown[]) => enviarMensajeMock(...a),
}));

vi.mock("@/ai/autonomia/queries", () => ({ obtenerAutonomiaPorAgente: vi.fn().mockResolvedValue(null) }));
vi.mock("@/ai/autonomia/clasificador", () => ({ clasificarCategoriaIntencion: vi.fn() }));
vi.mock("@/ai/autonomia/registro", () => ({ ensamblarYPersistirRegistro: vi.fn() }));
vi.mock("@/ai/perfil-cliente/servicio", () => ({ obtenerPerfil: vi.fn().mockResolvedValue(null) }));

vi.mock("@/ai/tools/registry", () => ({
  registroHerramientas: {
    obtenerDefiniciones: vi.fn().mockReturnValue([{ name: "crear_cotizacion" }]),
    register: vi.fn(),
    get: vi.fn(),
  },
}));

const ejecutarHerramientaMock = vi.fn();
vi.mock("@/ai/tools/executor", () => ({
  ejecutarHerramienta: (...a: unknown[]) => ejecutarHerramientaMock(...a),
}));

// 031-memoria-y-ficha-conversacion
const registrarTurnoMock = vi.fn();
const registrarLecturaMock = vi.fn();
const derivarLecturaMock = vi.fn();
vi.mock("@/ai/ficha-conversacion/servicio", () => ({
  registrarTurno: (...a: unknown[]) => registrarTurnoMock(...a),
  registrarLectura: (...a: unknown[]) => registrarLecturaMock(...a),
}));
vi.mock("@/ai/ficha-conversacion/extraccion", () => ({
  derivarLectura: (...a: unknown[]) => derivarLecturaMock(...a),
}));
vi.mock("@/shared/fechas/negocio", () => ({
  obtenerZonaNegocio: vi.fn().mockResolvedValue("America/Lima"),
}));

const { responderConAgente } = await import("./responder-con-agente");

const MENSAJE_COTIZACION = "Cotización #00001 preparada por PEN 118.00 — queda sujeta a confirmación antes de enviarse.";

/** El modelo nunca se detiene por su cuenta: siempre pide otra tool. */
function siempreLlamaTool(nombre: string) {
  return {
    tipo: "herramienta",
    herramientasLlamadas: [{ id: "tu-1", name: nombre, input: {} }],
    contenidoAsistente: [],
    usoIAId: "uso-loop",
  };
}

function contenidoEnviado(): string {
  return enviarMensajeMock.mock.calls[0][0].contenido as string;
}

describe("responderConAgente — tool loop agotado", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({
      herramientas: ["crear_cotizacion"],
      catalogoEnContexto: false,
    });
    enviarMensajeMock.mockReset().mockResolvedValue({ ok: true, mensaje: { id: "msg-1" } });
    ejecutarHerramientaMock.mockReset().mockResolvedValue({ ok: true, data: { mensaje: MENSAJE_COTIZACION } });
    generarConHerramientasMock.mockReset();
  });

  it("hace un turno de cierre con las herramientas bloqueadas y envía ese texto", async () => {
    generarConHerramientasMock.mockImplementation((s: { forzarTexto?: boolean }) =>
      Promise.resolve(
        s.forzarTexto
          ? { tipo: "texto", contenido: "Listo, le dejé lista la cotización #00001 por PEN 118.00.", usoIAId: "uso-cierre" }
          : siempreLlamaTool("crear_cotizacion"),
      ),
    );

    const r = await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
    });

    const llamadas = generarConHerramientasMock.mock.calls;
    expect(llamadas.filter((c) => c[0].forzarTexto)).toHaveLength(1);
    expect(llamadas[llamadas.length - 1][0].forzarTexto).toBe(true);
    expect(r.accion).toBe("ENVIADO");
    expect(contenidoEnviado()).toContain("cotización #00001");
    expect(r.usoIAId).toBe("uso-cierre");
  });

  it("si el turno de cierre falla, informa la acción que sí se concretó en vez de disculparse", async () => {
    generarConHerramientasMock.mockImplementation((s: { forzarTexto?: boolean }) =>
      s.forzarTexto ? Promise.reject(new Error("502 del proveedor")) : Promise.resolve(siempreLlamaTool("crear_cotizacion")),
    );

    await responderConAgente({ instanciaId: "instancia-1", conversacionId: "conv-1", agenteIAConfigId: "agente-1" });

    expect(contenidoEnviado()).toContain("Cotización #00001");
    expect(contenidoEnviado()).not.toContain("no pude completar");
  });

  it("sin acción concretada y sin turno de cierre, cae en el texto genérico", async () => {
    ejecutarHerramientaMock.mockResolvedValue({ ok: false, error: "Argumentos inválidos para crear_cotizacion" });
    generarConHerramientasMock.mockImplementation((s: { forzarTexto?: boolean }) =>
      s.forzarTexto ? Promise.resolve({ tipo: "texto", contenido: "   ", usoIAId: "uso-cierre" }) : Promise.resolve(siempreLlamaTool("crear_cotizacion")),
    );

    await responderConAgente({ instanciaId: "instancia-1", conversacionId: "conv-1", agenteIAConfigId: "agente-1" });

    expect(contenidoEnviado()).toContain("no pude completar tu solicitud");
  });

  it("una tool que devuelve texto antes del límite no dispara el turno de cierre", async () => {
    generarConHerramientasMock.mockResolvedValue({ tipo: "texto", contenido: "Claro, ya se la envío.", usoIAId: "uso-1" });

    await responderConAgente({ instanciaId: "instancia-1", conversacionId: "conv-1", agenteIAConfigId: "agente-1" });

    expect(generarConHerramientasMock).toHaveBeenCalledTimes(1);
    expect(generarConHerramientasMock.mock.calls[0][0].forzarTexto).toBeUndefined();
    expect(contenidoEnviado()).toBe("Claro, ya se la envío.");
  });
});

// 031-memoria-y-ficha-conversacion — las dos garantías que no se pueden
// romper: la ficha nunca daña un envío ya hecho (FR-014) y nunca se activa
// para quien no la pidió (FR-034). `responderConAgente` lo comparten el nodo
// Atención IA y el suscriptor de mensajes entrantes: sin estas pruebas, un
// descuido acá enciende la feature para todas las conversaciones del sistema.
describe("responderConAgente — ficha de la conversación (031)", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset().mockResolvedValue({ herramientas: [], catalogoEnContexto: false });
    enviarMensajeMock.mockReset().mockResolvedValue({ ok: true, mensaje: { id: "msg-1" } });
    ejecutarHerramientaMock.mockReset();
    generarConHerramientasMock.mockReset();
    registrarTurnoMock.mockReset().mockResolvedValue(null);
    registrarLecturaMock.mockReset().mockResolvedValue(undefined);
    derivarLecturaMock.mockReset().mockResolvedValue(null);
    generarRespuestaMock.mockReset().mockResolvedValue({ contenido: "Está a USD 16.", usoIAId: "uso-1" });
    // Las herramientas operativas "siempre disponibles" (015/024) hacen que
    // la respuesta pase igual por el tool loop aunque el agente no tenga
    // ninguna marcada; se responde con texto en la primera vuelta.
    generarConHerramientasMock.mockResolvedValue({ tipo: "texto", contenido: "Está a USD 16.", usoIAId: "uso-1" });
    construirContextoMock.mockReset().mockResolvedValue({});
  });

  it("sin el parámetro `ficha` no registra ni deriva nada (FR-034)", async () => {
    await responderConAgente({ instanciaId: "instancia-1", conversacionId: "conv-1", agenteIAConfigId: "agente-1" });

    expect(registrarTurnoMock).not.toHaveBeenCalled();
    expect(derivarLecturaMock).not.toHaveBeenCalled();
    expect(registrarLecturaMock).not.toHaveBeenCalled();
  });

  it("con `ficha` registra el turno con el mensaje que efectivamente salió", async () => {
    await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
      ficha: true,
    });

    expect(registrarTurnoMock).toHaveBeenCalledTimes(1);
    expect(registrarTurnoMock.mock.calls[0][0]).toMatchObject({
      conversacionId: "conv-1",
      instanciaId: "instancia-1",
      turno: { mensajeId: "msg-1", textoEnviado: "Está a USD 16." },
    });
  });

  it("la derivación interpretada corre DESPUÉS del envío (FR-022)", async () => {
    const orden: string[] = [];
    enviarMensajeMock.mockImplementation(async () => {
      orden.push("envio");
      return { ok: true, mensaje: { id: "msg-1" } };
    });
    derivarLecturaMock.mockImplementation(async () => {
      orden.push("derivacion");
      return null;
    });

    await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
      ficha: true,
    });

    expect(orden).toEqual(["envio", "derivacion"]);
  });

  it("si el registro de la ficha falla, el mensaje igual queda enviado (FR-014)", async () => {
    registrarTurnoMock.mockRejectedValue(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
      ficha: true,
    });

    expect(r.accion).toBe("ENVIADO");
    expect(r.mensajeId).toBe("msg-1");
  });

  it("si el envío falla, no se registra nada: el cliente no vio ese mensaje", async () => {
    enviarMensajeMock.mockResolvedValue({ ok: false, error: "canal caído" });

    const r = await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
      ficha: true,
    });

    expect(r.accion).toBe("ERROR");
    expect(registrarTurnoMock).not.toHaveBeenCalled();
  });

  it("le pasa al contexto la memoria y la ficha del nodo, y nada más", async () => {
    await responderConAgente({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      agenteIAConfigId: "agente-1",
      memoria: { activa: true, cantidad: 5 },
      ficha: true,
    });

    expect(construirContextoMock.mock.calls[0][0]).toMatchObject({
      memoria: { activa: true, cantidad: 5 },
      ficha: true,
      zonaNegocio: "America/Lima",
    });
  });
});

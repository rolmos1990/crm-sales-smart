import { describe, expect, it, vi, beforeEach } from "vitest";

// EnviarMensajeSchema exige un cuid2 real para conversacionId.
const CONV = "tz4a98xxat96iws9zmbrgj3a";

// Los TRES puntos desde los que puede salir un mensaje tienen que cortar con
// una conversación pendiente de aprobación (FR-033). Cubrir uno solo deja un
// agujero: si la IA corta pero los Workflows no, el Workflow responde un
// correo no aprobado — y enrutarMensajeEntrante se evalúa ANTES que la IA.
//
// Cada bloque verifica además el caso negativo: una conversación NO bloqueada
// se comporta exactamente como antes de esta feature (SC-011).

// ── Corte 1: envío humano / interno (envio.ts) ──────────────────────────────

describe("corte 1/3 — enviarMensajeInterno", () => {
  const conversacionFindUniqueOrThrow = vi.fn();
  const mensajeCreate = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
    vi.doMock("@/crm/pipeline/mover-stage", () => ({ moverOportunidadAEtapa: vi.fn() }));
    vi.doMock("@/shared/db/prisma", () => ({
      prisma: {
        conversacion: {
          findUniqueOrThrow: (...a: unknown[]) => conversacionFindUniqueOrThrow(...a),
          update: vi.fn().mockResolvedValue({}),
        },
        mensajeConversacion: {
          create: (...a: unknown[]) => mensajeCreate(...a),
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        contactoIdentificadorCanal: { findFirst: vi.fn().mockResolvedValue(null) },
        cuentaCanal: { findUnique: vi.fn().mockResolvedValue(null) },
        oportunidadConversacion: { findFirst: vi.fn().mockResolvedValue(null) },
        pipelineStage: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }));
  });

  function conversacion(bloqueada: boolean) {
    return {
      id: CONV,
      instanciaId: "inst-1",
      contactoId: "cont-1",
      cuentaCanalId: "cc-1",
      bloqueadaPorAprobacion: bloqueada,
      cuentaCanal: { canal: "email", nombre: "Ventas", identificador: "v@n.com" },
      contacto: { telefonoPrincipal: null, email: "juan@cliente.com" },
    };
  }

  it("conversación bloqueada: no crea el mensaje ni lo encola", async () => {
    conversacionFindUniqueOrThrow.mockResolvedValue(conversacion(true));
    const { enviarMensajeInterno } = await import("./envio");

    const r = await enviarMensajeInterno({
      conversacionId: CONV,
      contenido: "Hola",
      instanciaId: "inst-1",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/aprob/i);
    // Clave: ni siquiera se crea el MensajeConversacion. Si se creara, el
    // agente vería su respuesta en pantalla aunque nunca salga.
    expect(mensajeCreate).not.toHaveBeenCalled();
  });

  it("conversación NO bloqueada: envía como siempre", async () => {
    conversacionFindUniqueOrThrow.mockResolvedValue(conversacion(false));
    mensajeCreate.mockResolvedValue({ id: "msg-1" });
    const { enviarMensajeInterno } = await import("./envio");

    const r = await enviarMensajeInterno({
      conversacionId: CONV,
      contenido: "Hola",
      instanciaId: "inst-1",
    });

    expect(r.ok).toBe(true);
    expect(mensajeCreate).toHaveBeenCalled();
  });
});

// ── Corte 2: agente de IA (orquestar-ia.suscriptor.ts) ─────────────────────

describe("corte 2/3 — OrquestarIASuscriptor", () => {
  const conversacionFindUnique = vi.fn();
  const enrutarMensajeEntrante = vi.fn();
  const publicar = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    enrutarMensajeEntrante.mockResolvedValue({ atendido: false });
    vi.doMock("@/workflows/motor/disparo", () => ({ enrutarMensajeEntrante }));
    vi.doMock("@/shared/rabbitmq/publicador", () => ({ publicadorEventos: { publicar } }));
    vi.doMock("@/shared/db/prisma", () => ({
      prisma: {
        configuracionIA: {
          findUnique: vi.fn().mockResolvedValue({ habilitado: true, limiteTokensDiarios: null }),
        },
        conversacion: { findUnique: (...a: unknown[]) => conversacionFindUnique(...a) },
        oportunidad: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    }));
  });

  function envelope() {
    return {
      payload: {
        instanciaId: "inst-1",
        conversacionId: CONV,
        mensajeId: "msg-1",
        oportunidadId: null,
      },
    };
  }

  it("conversación bloqueada: la IA no genera ni envía nada", async () => {
    conversacionFindUnique.mockResolvedValue({
      modoAtencion: "AUTOMATICO",
      bloqueadaPorAprobacion: true,
      cuentaCanal: { canal: "email" },
      oportunidades: [{ oportunidad: { stage: { respuestaIAHabilitada: true, agenteIAConfigId: null } } }],
    });

    const { OrquestarIASuscriptor } = await import("@/suscriptores/ai/orquestar-ia.suscriptor");
    await new OrquestarIASuscriptor().manejar(envelope() as never);

    expect(publicar).not.toHaveBeenCalled();
  });

  it("conversación NO bloqueada con la etapa habilitada: publica como siempre", async () => {
    conversacionFindUnique.mockResolvedValue({
      modoAtencion: "AUTOMATICO",
      bloqueadaPorAprobacion: false,
      cuentaCanal: { canal: "email" },
      oportunidades: [{ oportunidad: { stage: { respuestaIAHabilitada: true, agenteIAConfigId: null } } }],
    });

    const { OrquestarIASuscriptor } = await import("@/suscriptores/ai/orquestar-ia.suscriptor");
    await new OrquestarIASuscriptor().manejar(envelope() as never);

    expect(publicar).toHaveBeenCalled();
  });
});

// ── Corte 3: motor de Workflows (disparo.ts) ───────────────────────────────

describe("corte 3/3 — enrutarMensajeEntrante", () => {
  const conversacionFindFirst = vi.fn();
  const ejecucionFindMany = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // El bloque de IA mockea @/workflows/motor/disparo entero y esa
    // registración persiste en el archivo: sin desmontarla, acá se probaría
    // el mock en vez del código real.
    vi.doUnmock("@/workflows/motor/disparo");
    ejecucionFindMany.mockResolvedValue([]);
    vi.doMock("@/shared/db/prisma", () => ({
      prisma: {
        conversacion: { findFirst: (...a: unknown[]) => conversacionFindFirst(...a) },
        mensajeConversacion: { findUnique: vi.fn().mockResolvedValue({ contenido: "hola" }) },
        workflowEjecucion: { findMany: (...a: unknown[]) => ejecucionFindMany(...a) },
        workflow: { findMany: vi.fn().mockResolvedValue([]) },
        workflowAsignacion: { findFirst: vi.fn().mockResolvedValue(null) },
        configuracionEmpresa: { findUnique: vi.fn().mockResolvedValue({ workflowsHabilitado: true }) },
      },
    }));
  });

  it("conversación bloqueada: ningún Workflow la toma", async () => {
    conversacionFindFirst.mockResolvedValue({
      modoAtencion: "AUTOMATICO",
      contactoId: "cont-1",
      bloqueadaPorAprobacion: true,
    });

    const { enrutarMensajeEntrante } = await import("@/workflows/motor/disparo");
    const r = await enrutarMensajeEntrante({
      instanciaId: "inst-1",
      conversacionId: CONV,
      mensajeId: "msg-1",
    });

    // atendido: true deja el mensaje consumido, así la IA tampoco lo toma.
    expect(r).toEqual({ atendido: true });
    expect(ejecucionFindMany).not.toHaveBeenCalled();
  });

  it("conversación NO bloqueada: sigue el flujo normal de Workflows", async () => {
    conversacionFindFirst.mockResolvedValue({
      modoAtencion: "AUTOMATICO",
      contactoId: "cont-1",
      bloqueadaPorAprobacion: false,
    });

    const { enrutarMensajeEntrante } = await import("@/workflows/motor/disparo");
    await enrutarMensajeEntrante({
      instanciaId: "inst-1",
      conversacionId: CONV,
      mensajeId: "msg-1",
    });

    expect(ejecucionFindMany).toHaveBeenCalled();
  });
});

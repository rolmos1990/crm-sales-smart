import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const obtenerSesionActualMock = vi.fn();
vi.mock("@/shared/auth/sesion", () => ({
  requireSesion: vi.fn(),
  obtenerSesionActual: (...a: unknown[]) => obtenerSesionActualMock(...a),
}));
vi.mock("@/shared/auth/permisos-server", () => ({ requirePermisoAction: vi.fn() }));
vi.mock("@/crm/pipeline/mover-stage", () => ({
  moverOportunidadAEtapa: vi.fn(),
  registrarEntradaInicialAEtapa: vi.fn(),
}));
vi.mock("@/configuracion/empresa/queries", () => ({ obtenerMonedaPrincipal: vi.fn() }));
vi.mock("./providers/registry", () => ({ obtenerProvider: vi.fn() }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn().mockResolvedValue(undefined) } }));

const conversacionFindUniqueOrThrow = vi.fn();
const conversacionFindUnique = vi.fn();
const conversacionFindFirst = vi.fn();
const conversacionUpdate = vi.fn().mockResolvedValue({});
const pausarPorHumanoMock = vi.fn();
const registrarCambioAtencionChatMock = vi.fn();
vi.mock("@/workflows/motor/motor", () => ({ pausarPorHumano: (...a: unknown[]) => pausarPorHumanoMock(...a) }));
vi.mock("@/workflows/motor/adaptadores", () => ({ registrarCambioAtencionChat: (...a: unknown[]) => registrarCambioAtencionChatMock(...a) }));
const mensajeCreate = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: {
      findUniqueOrThrow: (...a: unknown[]) => conversacionFindUniqueOrThrow(...a),
      findUnique: (...a: unknown[]) => conversacionFindUnique(...a),
      findFirst: (...a: unknown[]) => conversacionFindFirst(...a),
      update: (...a: unknown[]) => conversacionUpdate(...a),
    },
    mensajeConversacion: { create: (...a: unknown[]) => mensajeCreate(...a), count: vi.fn().mockResolvedValue(0) },
    cuentaCanal: { findUnique: vi.fn().mockResolvedValue({ stageIdRespuestaAutomatica: null }) },
    contactoIdentificadorCanal: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

const { enviarMensajeInterno } = await import("./envio");
const { enviarMensaje } = await import("./actions");

const CONV = "ckconversacion00000000001";

describe("envío de mensajes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversacionFindUniqueOrThrow.mockResolvedValue({
      id: CONV,
      instanciaId: "inst-1",
      cuentaCanalId: null,
      cuentaCanal: null,
      contactoId: "c-1",
      contacto: {},
    });
    conversacionFindUnique.mockResolvedValue({ cuentaCanalId: "cuenta-1" });
    mensajeCreate.mockResolvedValue({ id: "msg-1" });
    conversacionFindFirst.mockResolvedValue(null);
  });

  it("D6: si un Workflow atiende y un agente responde a mano, pasa a atención humana y pausa el Workflow", async () => {
    obtenerSesionActualMock.mockResolvedValue({ instanciaId: "inst-1", usuarioInstanciaId: "ui-1", nombre: "Juan" });
    conversacionFindFirst.mockResolvedValue({ id: CONV });

    const r = await enviarMensaje({ conversacionId: CONV, contenido: "Hola, te atiendo yo" });

    expect(r.ok).toBe(true);
    expect(conversacionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ modoAtencion: "HUMANO", atencionUsuarioId: "ui-1" }) }));
    expect(pausarPorHumanoMock).toHaveBeenCalledWith(CONV);
    expect(registrarCambioAtencionChatMock).toHaveBeenCalledWith(CONV, "HUMANO", "Un agente respondió manualmente", "Juan");
  });

  it("D6: una nota interna no cambia quién atiende", async () => {
    obtenerSesionActualMock.mockResolvedValue({ instanciaId: "inst-1", usuarioInstanciaId: "ui-1", nombre: "Juan" });
    await enviarMensaje({ conversacionId: CONV, contenido: "nota", esNotaInterna: true });
    expect(conversacionFindFirst).not.toHaveBeenCalled();
    expect(pausarPorHumanoMock).not.toHaveBeenCalled();
  });

  it("interno sin origen: evalúa el movimiento automático por primera respuesta, como siempre", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1" });

    expect(r.ok).toBe(true);
    // procesarPrimeraRespuestaProspecto arranca leyendo la cuenta de canal de la conversación.
    expect(conversacionFindUnique).toHaveBeenCalledWith({ where: { id: CONV }, select: { cuentaCanalId: true } });
  });

  it("interno con origen WORKFLOW: no evalúa el movimiento automático de etapa (D2)", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", origen: "WORKFLOW" });

    expect(r.ok).toBe(true);
    expect(conversacionFindUnique).not.toHaveBeenCalled();
  });

  it("interno con instancia distinta a la de la conversación: no envía", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "otra" });

    expect(r).toEqual({ ok: false, error: "Conversación no encontrada" });
    expect(mensajeCreate).not.toHaveBeenCalled();
  });

  it("Server Action sin sesión: no envía aunque el cliente mande un instanciaId", async () => {
    obtenerSesionActualMock.mockResolvedValue(null);

    const r = await enviarMensaje({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1" } as never);

    expect(r).toEqual({ ok: false, error: "No autenticado" });
    expect(mensajeCreate).not.toHaveBeenCalled();
  });

  it("Server Action con sesión de otra empresa: ignora el instanciaId del cliente y no envía", async () => {
    obtenerSesionActualMock.mockResolvedValue({ instanciaId: "otra" });

    const r = await enviarMensaje({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1" } as never);

    expect(r).toEqual({ ok: false, error: "Conversación no encontrada" });
    expect(mensajeCreate).not.toHaveBeenCalled();
  });
});

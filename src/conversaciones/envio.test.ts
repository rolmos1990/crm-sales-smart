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
const contactoUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
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
    contacto: { updateMany: (...a: unknown[]) => contactoUpdateMany(...a) },
  },
}));

const { enviarMensajeInterno, MENSAJE_NO_CONTACTAR } = await import("./envio");
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

  it("interno de la IA: evalúa el movimiento automático por primera respuesta, como siempre", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "IA" });

    expect(r.ok).toBe(true);
    // procesarPrimeraRespuestaProspecto arranca leyendo la cuenta de canal de la conversación.
    expect(conversacionFindUnique).toHaveBeenCalledWith({ where: { id: CONV }, select: { cuentaCanalId: true } });
  });

  it("interno de un WORKFLOW: no evalúa el movimiento automático de etapa (D2)", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "WORKFLOW" });

    expect(r.ok).toBe(true);
    expect(conversacionFindUnique).not.toHaveBeenCalled();
  });

  it("interno con instancia distinta a la de la conversación: no envía", async () => {
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "otra", autor: "IA" });

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

// 041 — "No contactar": bloquea los envíos automáticos; a una persona no.
describe("No contactar y seguimiento del contacto", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    conversacionFindUnique.mockResolvedValue({ cuentaCanalId: null });
    mensajeCreate.mockResolvedValue({ id: "msg-1", creadoEn: new Date("2026-11-18T15:00:00Z") });
    conversacionFindFirst.mockResolvedValue(null);
  });

  function conversacionCon(noContactarDesde: Date | null) {
    conversacionFindUniqueOrThrow.mockResolvedValue({
      id: CONV,
      instanciaId: "inst-1",
      cuentaCanalId: null,
      cuentaCanal: null,
      contactoId: "c-1",
      contacto: { noContactarDesde },
    });
  }

  it.each(["IA", "WORKFLOW"] as const)("autor %s a un contacto No contactar: no crea el mensaje", async (autor) => {
    conversacionCon(new Date("2026-11-01"));
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor });
    expect(r).toEqual({ ok: false, error: MENSAJE_NO_CONTACTAR });
    expect(mensajeCreate).not.toHaveBeenCalled();
  });

  it("autor PERSONA a un contacto No contactar: envía (solo se avisa en la UI)", async () => {
    conversacionCon(new Date("2026-11-01"));
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "PERSONA" });
    expect(r.ok).toBe(true);
    expect(mensajeCreate).toHaveBeenCalled();
  });

  it("respuesta de la IA: cierra la espera pero no cuenta como interacción", async () => {
    conversacionCon(null);
    await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "IA" });
    const datos = contactoUpdateMany.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(datos).toContainEqual({ esperandoRespuestaDesde: null });
    expect(datos.some((d) => "ultimaInteraccionEn" in d)).toBe(false);
  });

  it("respuesta de una persona: cierra la espera y cuenta como interacción", async () => {
    conversacionCon(null);
    await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "PERSONA" });
    const datos = contactoUpdateMany.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(datos).toContainEqual({ esperandoRespuestaDesde: null });
    expect(datos.some((d) => "ultimaInteraccionEn" in d)).toBe(true);
  });

  it("una nota interna no toca el seguimiento", async () => {
    conversacionCon(null);
    await enviarMensajeInterno({ conversacionId: CONV, contenido: "nota", esNotaInterna: true, instanciaId: "inst-1", autor: "PERSONA" });
    expect(contactoUpdateMany).not.toHaveBeenCalled();
  });

  it("si falla la actualización del contacto, el envío igual se completa", async () => {
    conversacionCon(null);
    contactoUpdateMany.mockRejectedValueOnce(new Error("db caída"));
    const r = await enviarMensajeInterno({ conversacionId: CONV, contenido: "Hola", instanciaId: "inst-1", autor: "PERSONA" });
    expect(r.ok).toBe(true);
  });

  it("la Server Action toma el usuarioId de la sesión y envía como PERSONA", async () => {
    obtenerSesionActualMock.mockResolvedValue({ instanciaId: "inst-1", usuarioId: "u-sesion", usuarioInstanciaId: "ui-1" });
    conversacionCon(new Date("2026-11-01"));
    const r = await enviarMensaje({ conversacionId: CONV, contenido: "Hola", usuarioId: "u-falso" });
    expect(r.ok).toBe(true);
    expect(mensajeCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ usuarioId: "u-sesion" }) }));
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: vi.fn(), obtenerSesionActual: vi.fn() }));
const requirePermisoActionMock = vi.fn();
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));
vi.mock("@/crm/pipeline/mover-stage", () => ({ registrarEntradaInicialAEtapa: vi.fn() }));
vi.mock("@/configuracion/empresa/queries", () => ({ obtenerMonedaPrincipal: vi.fn() }));
vi.mock("./providers/registry", () => ({ obtenerProvider: vi.fn() }));
vi.mock("./queries", () => ({ obtenerConversacionPorId: vi.fn().mockResolvedValue({ id: "conv-1" }), obtenerConversacionesInbox: vi.fn() }));
vi.mock("./envio", () => ({
  enviarMensajeInterno: vi.fn(),
  procesarPrimeraRespuestaProspecto: vi.fn(),
  registrarEventoConversacion: vi.fn(),
}));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));

const conversacionFindFirst = vi.fn();
const conversacionUpdate = vi.fn();
const mensajeFindFirst = vi.fn();
const contactoCount = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: {
      findFirst: (...a: unknown[]) => conversacionFindFirst(...a),
      update: (...a: unknown[]) => conversacionUpdate(...a),
      findUnique: vi.fn().mockResolvedValue({ contactoId: "c-1", instanciaId: "inst-1" }),
    },
    mensajeConversacion: { findFirst: (...a: unknown[]) => mensajeFindFirst(...a), updateMany: vi.fn() },
    contacto: { count: (...a: unknown[]) => contactoCount(...a) },
  },
}));

const acciones = await import("./actions");

describe("acciones del Inbox — sesión, permiso e instancia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermisoActionMock.mockResolvedValue({ ok: true, sesion: { instanciaId: "inst-1", usuarioId: "u-1" } });
    conversacionUpdate.mockResolvedValue({});
  });

  it("sin permiso: cerrar/reabrir/marcar respondida no escriben", async () => {
    requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });

    for (const accion of [acciones.cerrarConversacion, acciones.reabrirConversacion, acciones.marcarRespondida]) {
      expect(await accion("conv-1")).toEqual({ ok: false, error: "Sin permiso" });
    }
    expect(conversacionUpdate).not.toHaveBeenCalled();
  });

  it("conversación de otra instancia: no la modifica ni la devuelve", async () => {
    conversacionFindFirst.mockResolvedValue(null);

    expect(await acciones.cerrarConversacion("conv-ajena")).toEqual({ ok: false, error: "Conversación no encontrada" });
    expect(await acciones.obtenerConversacionAction("conv-ajena")).toBeNull();
    expect(conversacionUpdate).not.toHaveBeenCalled();
    expect(conversacionFindFirst).toHaveBeenCalledWith({
      where: { id: "conv-ajena", instanciaId: "inst-1" },
      select: { id: true },
    });
  });

  it("conversación propia con permiso: se cierra como siempre", async () => {
    conversacionFindFirst.mockResolvedValue({ id: "conv-1" });

    expect(await acciones.cerrarConversacion("conv-1")).toEqual({ ok: true });
    expect(conversacionUpdate).toHaveBeenCalledWith({ where: { id: "conv-1" }, data: { estado: "CERRADA" } });
  });

  it("crear oportunidad con instanciaId de otra empresa enviado desde el cliente: rechaza", async () => {
    conversacionFindFirst.mockResolvedValue({ id: "conv-1" });

    const r = await acciones.crearOportunidadDesdeConversacion({
      conversacionId: "conv-1",
      contactoId: "c-1",
      instanciaId: "otra",
    });
    expect(r).toEqual({ ok: false, error: "Conversación no encontrada" });
  });

  it("vincular a un contacto de otra empresa: rechaza", async () => {
    conversacionFindFirst.mockResolvedValue({ id: "conv-1" });
    contactoCount.mockResolvedValue(0);

    expect(await acciones.vincularConversacionAContacto("conv-1", "contacto-ajeno")).toEqual({
      ok: false,
      error: "Contacto no encontrado",
    });
    expect(conversacionUpdate).not.toHaveBeenCalled();
  });

  it("reacción sobre un mensaje de otra empresa: rechaza", async () => {
    mensajeFindFirst.mockResolvedValue(null);

    expect(await acciones.toggleReaccion("msg-ajeno", "👍", "INTERNA", null, null)).toEqual({
      exito: false,
      error: "Mensaje no encontrado",
    });
  });
});

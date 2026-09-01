import { describe, expect, it, vi, beforeEach } from "vitest";

const sesionMock = { instanciaId: "instancia-1", usuarioId: "usuario-1", rol: "ADMIN" };

const requirePermisoActionMock = vi.fn().mockResolvedValue({ ok: true, sesion: sesionMock });
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const enviarMensajeMock = vi.fn().mockResolvedValue({ ok: true, mensaje: { id: "m1" } });
vi.mock("@/conversaciones/actions", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensajeMock(...a),
}));

const agenteFindFirstMock = vi.fn();
const autonomiaUpsertMock = vi.fn();
const transactionMock = vi.fn((ops: unknown[]) => Promise.all(ops));
const pendienteFindFirstMock = vi.fn();
const pendienteUpdateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findFirst: (...a: unknown[]) => agenteFindFirstMock(...a) },
    autonomiaIntencionConfig: { upsert: (...a: unknown[]) => autonomiaUpsertMock(...a) },
    respuestaPendienteRevision: {
      findFirst: (...a: unknown[]) => pendienteFindFirstMock(...a),
      update: (...a: unknown[]) => pendienteUpdateMock(...a),
    },
    $transaction: (ops: unknown[]) => transactionMock(ops),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  guardarAutonomiaIntencionConfig,
  enviarRespuestaPendiente,
  editarYEnviarRespuestaPendiente,
  descartarRespuestaPendiente,
} = await import("./actions");

describe("autonomia/actions (016)", () => {
  beforeEach(() => {
    requirePermisoActionMock.mockClear().mockResolvedValue({ ok: true, sesion: sesionMock });
    enviarMensajeMock.mockClear().mockResolvedValue({ ok: true, mensaje: { id: "m1" } });
    agenteFindFirstMock.mockReset().mockResolvedValue({ id: "agente-1" });
    autonomiaUpsertMock.mockReset();
    transactionMock.mockClear();
    pendienteFindFirstMock.mockReset();
    pendienteUpdateMock.mockReset();
  });

  describe("guardarAutonomiaIntencionConfig", () => {
    it("persiste correctamente vía upsert por categoría (FR-013: no toca pendientes existentes)", async () => {
      const resultado = await guardarAutonomiaIntencionConfig({
        agenteIAConfigId: "agente-1",
        filas: [
          { categoria: "SALUDO", nivel: "AUTO_REPLY_SAFE_INTENTS" },
          { categoria: "RECLAMO", nivel: "HUMAN_ONLY" },
        ],
      });
      expect(resultado.exito).toBe(true);
      expect(transactionMock).toHaveBeenCalled();
      expect(pendienteUpdateMock).not.toHaveBeenCalled();
    });

    it("rechaza datos inválidos", async () => {
      const resultado = await guardarAutonomiaIntencionConfig({ agenteIAConfigId: "agente-1", filas: [{ categoria: "INVALIDA", nivel: "X" }] });
      expect(resultado.exito).toBe(false);
    });

    it("rechaza agente de otra instancia", async () => {
      agenteFindFirstMock.mockResolvedValue(null);
      const resultado = await guardarAutonomiaIntencionConfig({ agenteIAConfigId: "agente-otro", filas: [] });
      expect(resultado.exito).toBe(false);
    });
  });

  describe("bandeja de revisión", () => {
    it("enviarRespuestaPendiente: envía tal cual y marca ENVIADA_TAL_CUAL", async () => {
      pendienteFindFirstMock.mockResolvedValue({ id: "p1", conversacionId: "c1", respuestaPropuesta: "Hola" });
      const resultado = await enviarRespuestaPendiente("p1");
      expect(resultado.exito).toBe(true);
      expect(enviarMensajeMock).toHaveBeenCalledWith(expect.objectContaining({ contenido: "Hola" }));
      expect(pendienteUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: "ENVIADA_TAL_CUAL" }) }));
    });

    it("editarYEnviarRespuestaPendiente: envía el texto editado y marca EDITADA_Y_ENVIADA con respuestaEditada", async () => {
      pendienteFindFirstMock.mockResolvedValue({ id: "p1", conversacionId: "c1", respuestaPropuesta: "Hola" });
      const resultado = await editarYEnviarRespuestaPendiente({ id: "p1", textoEditado: "Hola, con más detalle" });
      expect(resultado.exito).toBe(true);
      expect(enviarMensajeMock).toHaveBeenCalledWith(expect.objectContaining({ contenido: "Hola, con más detalle" }));
      expect(pendienteUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: "EDITADA_Y_ENVIADA", respuestaEditada: "Hola, con más detalle" }) }),
      );
    });

    it("descartarRespuestaPendiente: marca DESCARTADA sin enviar nada", async () => {
      pendienteFindFirstMock.mockResolvedValue({ id: "p1", conversacionId: "c1", respuestaPropuesta: "Hola" });
      const resultado = await descartarRespuestaPendiente("p1");
      expect(resultado.exito).toBe(true);
      expect(enviarMensajeMock).not.toHaveBeenCalled();
      expect(pendienteUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: "DESCARTADA" }) }));
    });

    it("respuesta pendiente ya resuelta (no PENDIENTE): rechazada", async () => {
      pendienteFindFirstMock.mockResolvedValue(null);
      const resultado = await enviarRespuestaPendiente("p1");
      expect(resultado.exito).toBe(false);
    });
  });
});

import { describe, expect, it, vi } from "vitest";

// 041 — Un Workflow que intenta escribirle a un contacto "No contactar" falla
// de forma definitiva: reintentar no cambia nada.

const enviarMensajeInterno = vi.fn();
vi.mock("@/conversaciones/envio", () => ({
  enviarMensajeInterno: (...a: unknown[]) => enviarMensajeInterno(...a),
  MENSAJE_NO_CONTACTAR: "El contacto pidió no ser contactado",
}));
vi.mock("@/shared/db/prisma", () => ({ prisma: {} }));
vi.mock("@/crm/pipeline/mover-stage", () => ({ moverOportunidadAEtapa: vi.fn() }));
vi.mock("@/lib/email/encolar-email", () => ({ encolarEmail: vi.fn() }));

const { crearAdaptadoresReales } = await import("./adaptadores");
const { ErrorDefinitivoWorkflow } = await import("./tipos");

describe("adaptador enviarMensaje", () => {
  const adaptadores = crearAdaptadoresReales(vi.fn());

  it("No contactar → ErrorDefinitivoWorkflow (sin reintentos)", async () => {
    enviarMensajeInterno.mockResolvedValue({ ok: false, error: "El contacto pidió no ser contactado" });
    await expect(
      adaptadores.enviarMensaje({ instanciaId: "i", conversacionId: "c", texto: "hola" } as never),
    ).rejects.toBeInstanceOf(ErrorDefinitivoWorkflow);
  });

  it("un error transitorio sigue siendo reintentable", async () => {
    enviarMensajeInterno.mockResolvedValue({ ok: false, error: "timeout" });
    const r = adaptadores.enviarMensaje({ instanciaId: "i", conversacionId: "c", texto: "hola" } as never);
    await expect(r).rejects.toThrow("timeout");
    await expect(r).rejects.not.toBeInstanceOf(ErrorDefinitivoWorkflow);
  });

  it("declara el autor WORKFLOW", async () => {
    enviarMensajeInterno.mockResolvedValue({ ok: true, mensaje: { id: "m" } });
    await adaptadores.enviarMensaje({ instanciaId: "i", conversacionId: "c", texto: "hola" } as never);
    expect(enviarMensajeInterno).toHaveBeenCalledWith(expect.objectContaining({ autor: "WORKFLOW" }));
  });
});

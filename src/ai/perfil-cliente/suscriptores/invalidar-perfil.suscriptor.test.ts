import { describe, expect, it, vi, beforeEach } from "vitest";

const pedidoFindUniqueMock = vi.fn();
const cotizacionFindUniqueMock = vi.fn();
const oportunidadContactoFindFirstMock = vi.fn();
const recalcularMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pedido: { findUnique: (...a: unknown[]) => pedidoFindUniqueMock(...a) },
    cotizacion: { findUnique: (...a: unknown[]) => cotizacionFindUniqueMock(...a) },
    oportunidadContacto: { findFirst: (...a: unknown[]) => oportunidadContactoFindFirstMock(...a) },
  },
}));
vi.mock("@/ai/perfil-cliente/servicio", () => ({
  recalcular: (...a: unknown[]) => recalcularMock(...a),
}));

const { InvalidarPerfilSuscriptor } = await import("./invalidar-perfil.suscriptor");

function envelope(tipo: string, payload: Record<string, unknown>) {
  return {
    eventId: "e1",
    instanciaId: "instancia-1",
    tipo,
    ocurridoEn: new Date().toISOString(),
    version: 1,
    payload,
  } as never;
}

describe("InvalidarPerfilSuscriptor (012, Historia 3)", () => {
  beforeEach(() => {
    pedidoFindUniqueMock.mockReset();
    cotizacionFindUniqueMock.mockReset();
    oportunidadContactoFindFirstMock.mockReset();
    recalcularMock.mockReset();
  });

  it("PEDIDO_CREADO — resuelve contactoId vía lookup y recalcula", async () => {
    pedidoFindUniqueMock.mockResolvedValue({ contactoId: "contacto-1" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(envelope("PEDIDO_CREADO", { instanciaId: "instancia-1", pedidoId: "pedido-1" }));
    expect(pedidoFindUniqueMock).toHaveBeenCalledWith({ where: { id: "pedido-1" }, select: { contactoId: true } });
    expect(recalcularMock).toHaveBeenCalledWith("contacto-1", "instancia-1", "PEDIDO_CREADO");
  });

  it("COTIZACION_APROBADA — resuelve contactoId vía lookup", async () => {
    cotizacionFindUniqueMock.mockResolvedValue({ contactoId: "contacto-2" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(
      envelope("COTIZACION_APROBADA", { instanciaId: "instancia-1", cotizacionId: "cot-1" }),
    );
    expect(recalcularMock).toHaveBeenCalledWith("contacto-2", "instancia-1", "COTIZACION_APROBADA");
  });

  it("ETAPA_CAMBIADA — resuelve contactoId vía OportunidadContacto", async () => {
    oportunidadContactoFindFirstMock.mockResolvedValue({ contactoId: "contacto-3" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(
      envelope("ETAPA_CAMBIADA", { instanciaId: "instancia-1", oportunidadId: "op-1" }),
    );
    expect(recalcularMock).toHaveBeenCalledWith("contacto-3", "instancia-1", "ETAPA_CAMBIADA");
  });

  it("CONVERSACION_CLASIFICADA — usa contactoId ya presente en el payload, sin lookup", async () => {
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(
      envelope("CONVERSACION_CLASIFICADA", { instanciaId: "instancia-1", contactoId: "contacto-4" }),
    );
    expect(pedidoFindUniqueMock).not.toHaveBeenCalled();
    expect(recalcularMock).toHaveBeenCalledWith("contacto-4", "instancia-1", "CONVERSACION_CLASIFICADA");
  });

  it("pedido sin contacto asociado (venta manual) — no recalcula, no falla", async () => {
    pedidoFindUniqueMock.mockResolvedValue({ contactoId: null });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(envelope("PEDIDO_CREADO", { instanciaId: "instancia-1", pedidoId: "pedido-2" }));
    expect(recalcularMock).not.toHaveBeenCalled();
  });
});

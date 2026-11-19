import { describe, expect, it, vi, beforeEach } from "vitest";

const pedidoFindFirstMock = vi.fn();
const cotizacionFindFirstMock = vi.fn();
const oportunidadContactoFindFirstMock = vi.fn();
const recalcularMock = vi.fn();
const marcarMock = vi.fn();
const analisisIAActivoMock = vi.fn(async () => false);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pedido: { findFirst: (...a: unknown[]) => pedidoFindFirstMock(...a) },
    cotizacion: { findFirst: (...a: unknown[]) => cotizacionFindFirstMock(...a) },
    oportunidadContacto: { findFirst: (...a: unknown[]) => oportunidadContactoFindFirstMock(...a) },
  },
}));
vi.mock("@/ai/perfil-cliente/servicio", () => ({
  recalcular: (...a: unknown[]) => recalcularMock(...a),
}));
vi.mock("@/crm/contactos/analisis/cola", () => ({
  marcarPendienteSinFallar: (...a: unknown[]) => marcarMock(...a),
}));
vi.mock("@/crm/contactos/analisis/motor/disponibilidad", () => ({
  analisisIAActivo: () => analisisIAActivoMock(),
}));

const { InvalidarPerfilSuscriptor } = await import("./invalidar-perfil.suscriptor");
const { RK } = await import("@/shared/rabbitmq/exchanges");

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
    pedidoFindFirstMock.mockReset();
    cotizacionFindFirstMock.mockReset();
    oportunidadContactoFindFirstMock.mockReset();
    recalcularMock.mockReset();
    marcarMock.mockReset();
    analisisIAActivoMock.mockReset();
    analisisIAActivoMock.mockResolvedValue(false);
  });

  it("PEDIDO_CREADO — resuelve contactoId vía lookup acotado a la cuenta y recalcula", async () => {
    pedidoFindFirstMock.mockResolvedValue({ contactoId: "contacto-1" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(envelope("PEDIDO_CREADO", { instanciaId: "instancia-1", pedidoId: "pedido-1" }));
    expect(pedidoFindFirstMock).toHaveBeenCalledWith({
      where: { id: "pedido-1", instanciaId: "instancia-1" },
      select: { contactoId: true },
    });
    expect(recalcularMock).toHaveBeenCalledWith("contacto-1", "instancia-1", "PEDIDO_CREADO");
  });

  it("COTIZACION_APROBADA — resuelve contactoId vía lookup", async () => {
    cotizacionFindFirstMock.mockResolvedValue({ contactoId: "contacto-2" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(
      envelope("COTIZACION_APROBADA", { instanciaId: "instancia-1", cotizacionId: "cot-1" }),
    );
    expect(recalcularMock).toHaveBeenCalledWith("contacto-2", "instancia-1", "COTIZACION_APROBADA");
  });

  it("ETAPA_CAMBIADA — resuelve contactoId vía OportunidadContacto de la misma cuenta", async () => {
    oportunidadContactoFindFirstMock.mockResolvedValue({ contactoId: "contacto-3" });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(
      envelope("ETAPA_CAMBIADA", { instanciaId: "instancia-1", oportunidadId: "op-1" }),
    );
    expect(oportunidadContactoFindFirstMock).toHaveBeenCalledWith({
      where: { oportunidadId: "op-1", oportunidad: { instanciaId: "instancia-1" } },
      select: { contactoId: true },
    });
    expect(recalcularMock).toHaveBeenCalledWith("contacto-3", "instancia-1", "ETAPA_CAMBIADA");
  });

  it("un pedido de otra cuenta no se resuelve: ni recalcula ni marca", async () => {
    pedidoFindFirstMock.mockResolvedValue(null);
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(envelope("PEDIDO_CREADO", { instanciaId: "instancia-1", pedidoId: "pedido-ajeno" }));
    expect(recalcularMock).not.toHaveBeenCalled();
    expect(marcarMock).not.toHaveBeenCalled();
  });

  it("pedido sin contacto asociado (venta manual) — no recalcula, no falla", async () => {
    pedidoFindFirstMock.mockResolvedValue({ contactoId: null });
    const suscriptor = new InvalidarPerfilSuscriptor();
    await suscriptor.manejar(envelope("PEDIDO_CREADO", { instanciaId: "instancia-1", pedidoId: "pedido-2" }));
    expect(recalcularMock).not.toHaveBeenCalled();
  });
});

describe("InvalidarPerfilSuscriptor — marcado para el análisis (042)", () => {
  beforeEach(() => {
    recalcularMock.mockReset();
    marcarMock.mockReset();
    pedidoFindFirstMock.mockReset();
    analisisIAActivoMock.mockReset();
    analisisIAActivoMock.mockResolvedValue(false);
  });

  it.each([
    ["PEDIDO_CREADO", { pedidoId: "p" }, "PEDIDO"],
    ["COTIZACION_CREADA", { contactoId: "c" }, "COTIZACION"],
    ["OPORTUNIDAD_GANADA", { contactoId: "c" }, "OPORTUNIDAD"],
  ])("%s marca P1 y recalcula 012 como hoy", async (tipo, payload, motivo) => {
    pedidoFindFirstMock.mockResolvedValue({ contactoId: "c" });
    await new InvalidarPerfilSuscriptor().manejar(envelope(tipo, { instanciaId: "instancia-1", ...payload }));
    expect(recalcularMock).toHaveBeenCalledWith("c", "instancia-1", tipo);
    expect(marcarMock).toHaveBeenCalledWith(expect.objectContaining({ contactoId: "c", prioridad: "P1", motivo }));
  });

  it("CONTACTO_CREADO marca P2 (clasificación inicial) y no recalcula 012", async () => {
    await new InvalidarPerfilSuscriptor().manejar(envelope("CONTACTO_CREADO", { instanciaId: "instancia-1", contactoId: "c" }));
    expect(marcarMock).toHaveBeenCalledWith(expect.objectContaining({ prioridad: "P2", motivo: "INICIAL" }));
    expect(recalcularMock).not.toHaveBeenCalled();
  });

  it("CONTACTO_ACTUALIZADO marca P1 y no recalcula 012", async () => {
    await new InvalidarPerfilSuscriptor().manejar(envelope("CONTACTO_ACTUALIZADO", { instanciaId: "instancia-1", contactoId: "c" }));
    expect(marcarMock).toHaveBeenCalledWith(expect.objectContaining({ prioridad: "P1", motivo: "CONTACTO" }));
    expect(recalcularMock).not.toHaveBeenCalled();
  });

  it("CONVERSACION_CLASIFICADA sin análisis con IA: extracción por evento como hoy, y P1", async () => {
    await new InvalidarPerfilSuscriptor().manejar(envelope("CONVERSACION_CLASIFICADA", { instanciaId: "instancia-1", contactoId: "c" }));
    expect(recalcularMock).toHaveBeenCalledWith("c", "instancia-1", "CONVERSACION_CLASIFICADA");
    expect(marcarMock).toHaveBeenCalledWith(expect.objectContaining({ prioridad: "P1" }));
  });

  it("CONVERSACION_CLASIFICADA con análisis con IA activo: sin extracción y P0 inmediato", async () => {
    analisisIAActivoMock.mockResolvedValue(true);
    await new InvalidarPerfilSuscriptor().manejar(envelope("CONVERSACION_CLASIFICADA", { instanciaId: "instancia-1", contactoId: "c" }));
    expect(recalcularMock).toHaveBeenCalledWith("c", "instancia-1");
    expect(marcarMock).toHaveBeenCalledWith(expect.objectContaining({ prioridad: "P0", inmediato: true }));
  });

  it("nunca escucha los eventos que publica el propio análisis (R3)", () => {
    const rks = new InvalidarPerfilSuscriptor().routingKeys;
    expect(rks).not.toContain(RK.EVENTO_CONTACTO_ANALIZADO);
    expect(rks).not.toContain(RK.EVENTO_CONTACTO_INTERES_ACTUALIZADO);
    expect(rks).toContain(RK.EVENTO_CONTACTO_CREADO);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const conversacionUpdateManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { conversacion: { updateMany: (...a: unknown[]) => conversacionUpdateManyMock(...a) } },
}));

const publicarMock = vi.fn();
vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: (...a: unknown[]) => publicarMock(...a) },
}));

const { transferirAHumanoInterno } = await import("./transferir-a-humano-interno");

function ctx(modoSimulacion = false) {
  return {
    instanciaId: "instancia-1",
    conversacionId: "conv-1",
    contactoId: "contacto-1",
    modoSimulacion,
  } as never;
}

describe("transferirAHumanoInterno", () => {
  beforeEach(() => {
    conversacionUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    publicarMock.mockReset().mockResolvedValue(undefined);
  });

  it("pone la conversación en modo HUMANO con el motivo, filtrando por instancia", async () => {
    await transferirAHumanoInterno(ctx(), "Cliente pide hablar con un asesor");

    expect(conversacionUpdateManyMock).toHaveBeenCalledTimes(1);
    const arg = conversacionUpdateManyMock.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "conv-1", instanciaId: "instancia-1" });
    expect(arg.data).toMatchObject({
      clasificacion: "SOPORTE",
      modoAtencion: "HUMANO",
      atencionMotivo: "Cliente pide hablar con un asesor",
    });
  });

  it("en modo simulación no escribe nada", async () => {
    await transferirAHumanoInterno(ctx(true), "motivo");

    expect(conversacionUpdateManyMock).not.toHaveBeenCalled();
    expect(publicarMock).not.toHaveBeenCalled();
  });
});

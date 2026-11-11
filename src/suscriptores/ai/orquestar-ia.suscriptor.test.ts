import { describe, expect, it, vi, beforeEach } from "vitest";

const configuracionIAFindUniqueMock = vi.fn();
const conversacionFindUniqueMock = vi.fn();
const oportunidadFindFirstMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    configuracionIA: { findUnique: (...a: unknown[]) => configuracionIAFindUniqueMock(...a) },
    conversacion: { findUnique: (...a: unknown[]) => conversacionFindUniqueMock(...a) },
    oportunidad: { findFirst: (...a: unknown[]) => oportunidadFindFirstMock(...a) },
    agenteIAConfig: { findUnique: vi.fn() },
  },
}));

const publicarMock = vi.fn();
vi.mock("@/shared/rabbitmq/publicador", () => ({
  publicadorEventos: { publicar: (...a: unknown[]) => publicarMock(...a) },
}));

const enrutarMensajeEntranteMock = vi.fn();
vi.mock("@/workflows/motor/disparo", () => ({
  enrutarMensajeEntrante: (...a: unknown[]) => enrutarMensajeEntranteMock(...a),
}));

const { OrquestarIASuscriptor } = await import("./orquestar-ia.suscriptor");

function envelope() {
  return {
    payload: { instanciaId: "instancia-1", conversacionId: "conv-1", mensajeId: "msg-1", oportunidadId: "op-1" },
  } as never;
}

function conversacion(modoAtencion: "AUTOMATICO" | "HUMANO") {
  return { modoAtencion, cuentaCanal: { canal: "instagram" }, oportunidades: [] };
}

describe("OrquestarIASuscriptor — atención humana", () => {
  beforeEach(() => {
    configuracionIAFindUniqueMock.mockReset().mockResolvedValue({ habilitado: true, limiteTokensDiarios: null });
    oportunidadFindFirstMock
      .mockReset()
      .mockResolvedValue({ stage: { respuestaIAHabilitada: true, agenteIAConfigId: null } });
    publicarMock.mockReset();
    enrutarMensajeEntranteMock.mockReset().mockResolvedValue({ atendido: false });
  });

  it("si un Workflow (o la regla D3) atiende el mensaje, la IA por etapa no responde", async () => {
    enrutarMensajeEntranteMock.mockResolvedValue({ atendido: true });
    conversacionFindUniqueMock.mockReset().mockResolvedValue(conversacion("AUTOMATICO"));

    await new OrquestarIASuscriptor().manejar(envelope());

    expect(enrutarMensajeEntranteMock).toHaveBeenCalledWith({
      instanciaId: "instancia-1",
      conversacionId: "conv-1",
      mensajeId: "msg-1",
      oportunidadId: "op-1",
    });
    expect(publicarMock).not.toHaveBeenCalled();
  });

  it("conversación en modo HUMANO: no publica GENERAR_RESPUESTA_IA", async () => {
    conversacionFindUniqueMock.mockReset().mockResolvedValue(conversacion("HUMANO"));

    await new OrquestarIASuscriptor().manejar(envelope());

    expect(publicarMock).not.toHaveBeenCalled();
  });

  it("conversación en modo AUTOMATICO con IA habilitada en la etapa: publica como siempre", async () => {
    conversacionFindUniqueMock.mockReset().mockResolvedValue(conversacion("AUTOMATICO"));

    await new OrquestarIASuscriptor().manejar(envelope());

    expect(publicarMock).toHaveBeenCalledWith("GENERAR_RESPUESTA_IA", "instancia-1", {
      conversacionId: "conv-1",
      instanciaId: "instancia-1",
      agenteIAConfigId: undefined,
    });
  });
});

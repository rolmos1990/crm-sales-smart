import { describe, expect, it, vi, beforeEach } from "vitest";

const publicarMock = vi.fn().mockResolvedValue(undefined);
const findFirstMensajeMock = vi.fn().mockResolvedValue(null);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    mensajeConversacion: { findFirst: (...args: unknown[]) => findFirstMensajeMock(...args) },
    contacto: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: (...args: unknown[]) => publicarMock(...args) },
}));

import { encolarMensajeEntrante, encolarMensajeAppNativaWA } from "./encolar-mensaje";

function mensajeTextoWA() {
  return {
    key: { id: "wamid_1", remoteJid: "521234567890@s.whatsapp.net", fromMe: false },
    pushName: "Nombre reportado por Baileys",
    message: { conversation: "hola" },
  };
}

describe("encolarMensajeEntrante / encolarMensajeAppNativaWA — pushName (research.md R5)", () => {
  beforeEach(() => {
    publicarMock.mockClear();
    findFirstMensajeMock.mockClear();
    findFirstMensajeMock.mockResolvedValue(null);
  });

  it("encolarMensajeEntrante SÍ incluye pushName en el payload publicado (comportamiento actual, sin regresión)", async () => {
    await encolarMensajeEntrante(mensajeTextoWA(), "cc1", "inst1");

    expect(publicarMock).toHaveBeenCalledTimes(1);
    const [, , payload] = publicarMock.mock.calls[0];
    expect(payload.pushName).toBe("Nombre reportado por Baileys");
    expect(payload.identificadorContacto).toBe("+521234567890");
    expect(payload.contenido).toBe("hola");
  });

  it("encolarMensajeAppNativaWA NO incluye pushName en el payload publicado — evita pisar el nombre del contacto con el de la cuenta del negocio", async () => {
    await encolarMensajeAppNativaWA(mensajeTextoWA(), "cc1", "inst1");

    expect(publicarMock).toHaveBeenCalledTimes(1);
    const [, , payload] = publicarMock.mock.calls[0];
    expect("pushName" in payload).toBe(false);
    expect(payload.identificadorContacto).toBe("+521234567890");
    expect(payload.contenido).toBe("hola");
  });

  it("ninguna de las dos publica si el idExterno ya está registrado (dedup)", async () => {
    findFirstMensajeMock.mockResolvedValueOnce({ id: "msg-existente" });
    await encolarMensajeEntrante(mensajeTextoWA(), "cc1", "inst1");
    expect(publicarMock).not.toHaveBeenCalled();

    findFirstMensajeMock.mockResolvedValueOnce({ id: "msg-existente" });
    await encolarMensajeAppNativaWA(mensajeTextoWA(), "cc1", "inst1");
    expect(publicarMock).not.toHaveBeenCalled();
  });
});

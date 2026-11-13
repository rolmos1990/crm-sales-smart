import { describe, expect, it, vi, beforeEach } from "vitest";

const mensajeFindFirstMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { mensajeConversacion: { findFirst: (...a: unknown[]) => mensajeFindFirstMock(...a) } },
}));

const { resolverMsEspera, SEGUNDOS_ESPERA_DEFECTO, MAX_SEGUNDOS_ESPERA } = await import("./ventana-espera");
const { quedoObsoleto } = await import("./ventana-espera.queries");

describe("resolverMsEspera", () => {
  it("sin configuración no espera — comportamiento previo a la feature", () => {
    expect(resolverMsEspera(null, null)).toBe(0);
    expect(resolverMsEspera({}, {})).toBe(0);
  });

  it("apagado en ambos niveles no espera aunque haya segundos cargados", () => {
    expect(resolverMsEspera({ esperarAntesDeResponder: false, segundosEsperaRespuesta: 10 }, null)).toBe(0);
  });

  it("el agente manda sobre la instancia", () => {
    const ms = resolverMsEspera(
      { esperarAntesDeResponder: true, segundosEsperaRespuesta: 8 },
      { esperarAntesDeResponder: true, segundosEsperaRespuesta: 3 },
    );
    expect(ms).toBe(8000);
  });

  it("el agente puede apagar la espera que la instancia activó", () => {
    const ms = resolverMsEspera(
      { esperarAntesDeResponder: false },
      { esperarAntesDeResponder: true, segundosEsperaRespuesta: 5 },
    );
    expect(ms).toBe(0);
  });

  it("agente sin preferencia hereda la instancia — caso del stage sin agente asignado", () => {
    const ms = resolverMsEspera(null, { esperarAntesDeResponder: true, segundosEsperaRespuesta: 5 });
    expect(ms).toBe(5000);
  });

  it("activo sin segundos usa el valor por defecto", () => {
    expect(resolverMsEspera({ esperarAntesDeResponder: true }, null)).toBe(SEGUNDOS_ESPERA_DEFECTO * 1000);
  });

  it("acota por arriba y por abajo", () => {
    expect(resolverMsEspera({ esperarAntesDeResponder: true, segundosEsperaRespuesta: 999 }, null)).toBe(
      MAX_SEGUNDOS_ESPERA * 1000,
    );
    // Un 0 guardado no debe desactivar la espera a espaldas del toggle.
    expect(resolverMsEspera({ esperarAntesDeResponder: true, segundosEsperaRespuesta: 0 }, null)).toBe(1000);
  });
});

describe("quedoObsoleto", () => {
  beforeEach(() => mensajeFindFirstMock.mockReset());

  it("llegó un mensaje posterior: este comando se descarta", async () => {
    mensajeFindFirstMock.mockResolvedValue({ id: "msg-3" });
    expect(await quedoObsoleto({ conversacionId: "c1", mensajeId: "msg-1" })).toBe(true);
  });

  it("sigue siendo el último: responde", async () => {
    mensajeFindFirstMock.mockResolvedValue({ id: "msg-3" });
    expect(await quedoObsoleto({ conversacionId: "c1", mensajeId: "msg-3" })).toBe(false);
  });

  it("sin mensajeId nunca se descarta — responder de más es mejor que no responder", async () => {
    expect(await quedoObsoleto({ conversacionId: "c1" })).toBe(false);
    expect(mensajeFindFirstMock).not.toHaveBeenCalled();
  });

  it("sin mensajes del cliente no se descarta", async () => {
    mensajeFindFirstMock.mockResolvedValue(null);
    expect(await quedoObsoleto({ conversacionId: "c1", mensajeId: "msg-1" })).toBe(false);
  });

  it("solo mira mensajes del cliente, no notas internas ni eventos del sistema", async () => {
    mensajeFindFirstMock.mockResolvedValue({ id: "msg-1" });
    await quedoObsoleto({ conversacionId: "c1", mensajeId: "msg-1" });

    expect(mensajeFindFirstMock.mock.calls[0][0]).toMatchObject({
      where: {
        conversacionId: "c1",
        remitente: "CONTACTO",
        esNotaInterna: false,
        tipo: { not: "EVENTO_SISTEMA" },
      },
      orderBy: { creadoEn: "desc" },
    });
  });
});

describe("tramo de mensajes seguidos — el caso que originó la feature", () => {
  beforeEach(() => mensajeFindFirstMock.mockReset());

  it('de "Hola" + "¿Tienen disponible?" + "la esfera azul" responde una sola vez', async () => {
    // Los tres comandos despiertan y consultan: el último mensaje es msg-3.
    mensajeFindFirstMock.mockResolvedValue({ id: "msg-3" });

    const decisiones: boolean[] = [];
    for (const mensajeId of ["msg-1", "msg-2", "msg-3"]) {
      decisiones.push(await quedoObsoleto({ conversacionId: "c1", mensajeId }));
    }

    expect(decisiones).toEqual([true, true, false]);
    expect(decisiones.filter((d) => !d)).toHaveLength(1);
  });
});

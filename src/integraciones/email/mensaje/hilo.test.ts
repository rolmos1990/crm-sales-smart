import { describe, expect, it, vi, beforeEach } from "vitest";
import { conAngulos } from "./hilo";
import { asuntoDeRespuesta } from "./asunto";

const conversacionFindFirst = vi.fn();
const mensajeFindMany = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findFirst: (...a: unknown[]) => conversacionFindFirst(...a) },
    mensajeConversacion: { findMany: (...a: unknown[]) => mensajeFindMany(...a) },
  },
}));

const { resolverContextoHilo } = await import("./hilo");

function mensaje(idExterno: string | null, remitente: "CONTACTO" | "AGENTE", minuto: number) {
  return { idExterno, remitente, creadoEn: new Date(Date.UTC(2026, 10, 10, 9, minuto)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  conversacionFindFirst.mockResolvedValue({ asunto: "Consulta de precios" });
  mensajeFindMany.mockResolvedValue([]);
});

describe("asunto de la respuesta", () => {
  it("antepone Re: al asunto original", () => {
    expect(asuntoDeRespuesta("Consulta de precios")).toBe("Re: Consulta de precios");
  });

  it("no duplica el Re: cuando ya lo trae", () => {
    expect(asuntoDeRespuesta("Re: Consulta")).toBe("Re: Consulta");
    expect(asuntoDeRespuesta("RE: Consulta")).toBe("Re: Consulta");
    expect(asuntoDeRespuesta("Re: Re: RE: Consulta")).toBe("Re: Consulta");
  });

  it("normaliza los prefijos de reenvío de otros clientes", () => {
    expect(asuntoDeRespuesta("Fwd: Consulta")).toBe("Re: Consulta");
    expect(asuntoDeRespuesta("RV: Consulta")).toBe("Re: Consulta");
  });

  it("sin asunto previo usa uno neutro con el nombre del negocio", () => {
    expect(asuntoDeRespuesta(null, "Ventas Mi Negocio")).toBe("Mensaje de Ventas Mi Negocio");
    expect(asuntoDeRespuesta("   ", "Ventas")).toBe("Mensaje de Ventas");
    expect(asuntoDeRespuesta(null)).toBe("Mensaje");
  });
});

describe("formato de Message-ID", () => {
  it("envuelve en ángulos sin duplicarlos", () => {
    expect(conAngulos("abc@x.com")).toBe("<abc@x.com>");
    expect(conAngulos("<abc@x.com>")).toBe("<abc@x.com>");
    expect(conAngulos("  ")).toBe("");
  });
});

describe("contexto del hilo", () => {
  it("In-Reply-To apunta al ÚLTIMO correo del contacto, no al último mensaje", async () => {
    mensajeFindMany.mockResolvedValue([
      mensaje("primero@cliente.com", "CONTACTO", 0),
      mensaje("respuesta@negocio.com", "AGENTE", 5),
      mensaje("segundo@cliente.com", "CONTACTO", 10),
      mensaje("otra@negocio.com", "AGENTE", 15),
    ]);

    const ctx = await resolverContextoHilo("conv-1", "inst-1");

    expect(ctx.inReplyTo).toBe("segundo@cliente.com");
  });

  it("References conserva el orden del hilo, del más viejo al más nuevo", async () => {
    mensajeFindMany.mockResolvedValue([
      mensaje("raiz@cliente.com", "CONTACTO", 0),
      mensaje("medio@negocio.com", "AGENTE", 5),
      mensaje("ultimo@cliente.com", "CONTACTO", 10),
    ]);

    const ctx = await resolverContextoHilo("conv-1", "inst-1");

    expect(ctx.references).toEqual(["raiz@cliente.com", "medio@negocio.com", "ultimo@cliente.com"]);
  });

  it("acorta las cadenas largas conservando la raíz, que es lo que agrupa el hilo", async () => {
    mensajeFindMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => mensaje(`m${i}@x.com`, "CONTACTO", i)),
    );

    const ctx = await resolverContextoHilo("conv-1", "inst-1");

    expect(ctx.references).toHaveLength(10);
    expect(ctx.references[0]).toBe("m0@x.com");
    expect(ctx.references.at(-1)).toBe("m19@x.com");
  });

  it("descarta los idExterno que no son Message-ID reales", async () => {
    // Los correos sin Message-ID reciben un hash derivado de la posición en el
    // buzón (ver normalizar.ts): no es una dirección válida y mandarlo en
    // References rompería el encadenado.
    mensajeFindMany.mockResolvedValue([
      mensaje("a".repeat(64), "CONTACTO", 0),
      mensaje("real@cliente.com", "CONTACTO", 5),
    ]);

    const ctx = await resolverContextoHilo("conv-1", "inst-1");

    expect(ctx.references).toEqual(["real@cliente.com"]);
    expect(ctx.inReplyTo).toBe("real@cliente.com");
  });

  it("una conversación sin correos previos no rompe", async () => {
    mensajeFindMany.mockResolvedValue([]);

    const ctx = await resolverContextoHilo("conv-1", "inst-1");

    expect(ctx.inReplyTo).toBeNull();
    expect(ctx.references).toEqual([]);
    expect(ctx.asunto).toBe("Re: Consulta de precios");
  });

  it("solo pide los mensajes que tienen idExterno", async () => {
    await resolverContextoHilo("conv-1", "inst-1");

    expect(mensajeFindMany.mock.calls[0][0].where).toEqual({
      conversacionId: "conv-1",
      conversacion: { instanciaId: "inst-1" },
      idExterno: { not: null },
    });
  });
});

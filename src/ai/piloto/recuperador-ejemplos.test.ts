import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { ejemploPrompt: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));

const { recuperadorEjemplos } = await import("./recuperador-ejemplos");

function ejemplo(over: Partial<{
  id: string; intencion: string | null; tipoCliente: string | null; playbookEstrategiaId: string | null; productoId: string | null; calidad: number; creadoEn: Date;
}>) {
  return {
    id: over.id ?? "e1",
    contenido: { mensajes: [] },
    intencion: over.intencion ?? null,
    tipoCliente: over.tipoCliente ?? null,
    playbookEstrategiaId: over.playbookEstrategiaId ?? null,
    productoId: over.productoId ?? null,
    calidad: over.calidad ?? 0.5,
    creadoEn: over.creadoEn ?? new Date("2026-01-01"),
  };
}

const criteriosBase = { instanciaId: "instancia-1", agenteIAConfigId: "agente-1", intencion: "CONSULTANDO_PRECIO" as const };

describe("recuperadorEjemplos (014, Historia 3)", () => {
  beforeEach(() => findManyMock.mockReset());

  it("con 6+ ejemplos, devuelve entre 2 y 4 priorizados por coincidencia de etiquetas", async () => {
    findManyMock.mockResolvedValue([
      ejemplo({ id: "e1", intencion: "CONSULTANDO_PRECIO", tipoCliente: "CLIENTE_REGULAR" }), // puntaje 2
      ejemplo({ id: "e2", intencion: "CONSULTANDO_PRECIO" }), // puntaje 1
      ejemplo({ id: "e3", intencion: "CONSULTANDO_PRECIO" }), // puntaje 1
      ejemplo({ id: "e4", intencion: "CONSULTANDO_PRECIO" }), // puntaje 1
      ejemplo({ id: "e5", intencion: "EXPLORANDO" }), // puntaje 0
      ejemplo({ id: "e6", intencion: "EXPLORANDO" }), // puntaje 0
    ]);

    const resultado = await recuperadorEjemplos.recuperar({ ...criteriosBase, tipoCliente: "CLIENTE_REGULAR" });
    expect(resultado.length).toBeGreaterThanOrEqual(2);
    expect(resultado.length).toBeLessThanOrEqual(4);
    expect(resultado[0].id).toBe("e1"); // el de mayor puntaje va primero
    expect(resultado.every((r) => r.etiquetasCoincidentes > 0)).toBe(true);
  });

  it("sin coincidencias, devuelve lista vacía (no rellena con irrelevantes)", async () => {
    findManyMock.mockResolvedValue([
      ejemplo({ id: "e1", intencion: "EXPLORANDO" }),
      ejemplo({ id: "e2", intencion: "COMPARANDO" }),
    ]);
    const resultado = await recuperadorEjemplos.recuperar(criteriosBase);
    expect(resultado).toEqual([]);
  });

  it("con solo 1 coincidencia relevante, devuelve solo esa (no rellena hasta 2 con irrelevantes)", async () => {
    findManyMock.mockResolvedValue([
      ejemplo({ id: "e1", intencion: "CONSULTANDO_PRECIO" }),
      ejemplo({ id: "e2", intencion: "EXPLORANDO" }),
    ]);
    const resultado = await recuperadorEjemplos.recuperar(criteriosBase);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe("e1");
  });

  it("nunca devuelve ejemplos de otra instancia ni agente (delegado a la query — se verifica el where)", async () => {
    findManyMock.mockResolvedValue([]);
    await recuperadorEjemplos.recuperar(criteriosBase);
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.instanciaId).toBe("instancia-1");
    expect(args.where.OR).toEqual([{ agenteIAConfigId: "agente-1" }, { agenteIAConfigId: null }]);
    expect(args.where.activo).toBe(true);
    expect(args.where.conversacionPilotoOrigen).toEqual({ incluidaEnPerfil: true });
  });

  it("desempata por calidad y luego por recencia", async () => {
    findManyMock.mockResolvedValue([
      ejemplo({ id: "viejo-mejor", intencion: "CONSULTANDO_PRECIO", calidad: 0.9, creadoEn: new Date("2026-01-01") }),
      ejemplo({ id: "nuevo-peor", intencion: "CONSULTANDO_PRECIO", calidad: 0.3, creadoEn: new Date("2026-02-01") }),
    ]);
    const resultado = await recuperadorEjemplos.recuperar(criteriosBase);
    expect(resultado[0].id).toBe("viejo-mejor");
  });
});

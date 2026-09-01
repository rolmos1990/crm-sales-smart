import { describe, expect, it, vi, beforeEach } from "vitest";

const metodoFindManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { metodoEntregaConfig: { findMany: (...a: unknown[]) => metodoFindManyMock(...a) } },
}));

await import("./obtener-metodos-entrega.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["obtener_metodos_entrega"] };

describe("obtener_metodos_entrega (015, Historia 2, FR-008)", () => {
  beforeEach(() => metodoFindManyMock.mockReset());

  it("sin configuración: mensaje explícito, sin error", async () => {
    metodoFindManyMock.mockResolvedValue([]);
    const tool = registroHerramientas.get("obtener_metodos_entrega")!;
    const resultado = await tool.execute({}, ctx);
    expect(resultado.ok).toBe(true);
    expect(resultado.data).toEqual({ metodos: [], mensaje: "Sin métodos de entrega configurados" });
  });

  it("con configuración: lista los métodos activos", async () => {
    metodoFindManyMock.mockResolvedValue([
      { metodoEntrega: "COURIER_EXTERNO", costoBase: 10, diasEstimadosMin: 2, diasEstimadosMax: 5 },
    ]);
    const tool = registroHerramientas.get("obtener_metodos_entrega")!;
    const resultado = await tool.execute({}, ctx);
    expect((resultado.data as { metodos: unknown[] }).metodos).toHaveLength(1);
  });
});

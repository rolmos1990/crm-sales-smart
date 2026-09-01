import { describe, expect, it, vi, beforeEach } from "vitest";

const productoFindManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) } },
}));

await import("./validar-combinacion-productos.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["validar_combinacion_productos"] };

describe("validar_combinacion_productos (015, research.md Decisión 2)", () => {
  beforeEach(() => productoFindManyMock.mockReset());

  it("producto inexistente → inválida con motivo", async () => {
    productoFindManyMock.mockResolvedValue([]);
    const tool = registroHerramientas.get("validar_combinacion_productos")!;
    const resultado = await tool.execute({ productoIds: ["p1"] }, ctx);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { valida: boolean }).valida).toBe(false);
  });

  it("producto inactivo → inválida con motivo", async () => {
    productoFindManyMock.mockResolvedValue([{ id: "p1", activo: false, tipo: "FISICO" }]);
    const tool = registroHerramientas.get("validar_combinacion_productos")!;
    const resultado = await tool.execute({ productoIds: ["p1"] }, ctx);
    expect((resultado.data as { valida: boolean }).valida).toBe(false);
  });

  it("tipos mixtos (FISICO + DIGITAL) → válida, con advertencia informativa, no bloqueante", async () => {
    productoFindManyMock.mockResolvedValue([
      { id: "p1", activo: true, tipo: "FISICO" },
      { id: "p2", activo: true, tipo: "DIGITAL" },
    ]);
    const tool = registroHerramientas.get("validar_combinacion_productos")!;
    const resultado = await tool.execute({ productoIds: ["p1", "p2"] }, ctx);
    expect(resultado.data).toEqual({ valida: true, advertenciaTipoMixto: true });
  });

  it("productos activos del mismo tipo → válida sin advertencia", async () => {
    productoFindManyMock.mockResolvedValue([
      { id: "p1", activo: true, tipo: "FISICO" },
      { id: "p2", activo: true, tipo: "FISICO" },
    ]);
    const tool = registroHerramientas.get("validar_combinacion_productos")!;
    const resultado = await tool.execute({ productoIds: ["p1", "p2"] }, ctx);
    expect(resultado.data).toEqual({ valida: true, advertenciaTipoMixto: false });
  });
});

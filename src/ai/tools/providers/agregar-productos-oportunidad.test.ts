import { describe, expect, it, vi, beforeEach } from "vitest";

const oportunidadFindFirstMock = vi.fn();
const productoFindManyMock = vi.fn();
const oportunidadProductoCreateManyMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    oportunidad: { findFirst: (...a: unknown[]) => oportunidadFindFirstMock(...a) },
    producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) },
    oportunidadProducto: { createMany: (...a: unknown[]) => oportunidadProductoCreateManyMock(...a) },
  },
}));

await import("./agregar-productos-oportunidad.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["agregar_productos_oportunidad"] };

describe("agregar_productos_oportunidad (015, Historia 3)", () => {
  beforeEach(() => {
    oportunidadFindFirstMock.mockReset();
    productoFindManyMock.mockReset();
    oportunidadProductoCreateManyMock.mockReset();
  });

  it("oportunidad de otra instancia: rechazada", async () => {
    oportunidadFindFirstMock.mockResolvedValue(null);
    const tool = registroHerramientas.get("agregar_productos_oportunidad")!;
    const resultado = await tool.execute({ oportunidadId: "op-1", productos: [{ productoId: "p1", cantidad: 1 }] }, ctx);
    expect(resultado.ok).toBe(false);
  });

  it("producto inválido (no encontrado/inactivo): rechazado, igual que la validación de la UI", async () => {
    oportunidadFindFirstMock.mockResolvedValue({ id: "op-1" });
    productoFindManyMock.mockResolvedValue([]);
    const tool = registroHerramientas.get("agregar_productos_oportunidad")!;
    const resultado = await tool.execute({ oportunidadId: "op-1", productos: [{ productoId: "p1", cantidad: 1 }] }, ctx);
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("p1");
  });

  it("productos válidos: se agregan correctamente", async () => {
    oportunidadFindFirstMock.mockResolvedValue({ id: "op-1" });
    productoFindManyMock.mockResolvedValue([{ id: "p1", nombre: "Producto X", precio: 50 }]);
    const tool = registroHerramientas.get("agregar_productos_oportunidad")!;
    const resultado = await tool.execute({ oportunidadId: "op-1", productos: [{ productoId: "p1", cantidad: 2 }] }, ctx);
    expect(resultado.ok).toBe(true);
    expect(resultado.data).toEqual({ productosAgregados: 1 });
    expect(oportunidadProductoCreateManyMock).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const productoFindFirstMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { producto: { findFirst: (...a: unknown[]) => productoFindFirstMock(...a) } },
}));

await import("./consultar-disponibilidad.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["consultar_disponibilidad"] };

describe("consultar_disponibilidad (015, Historia 1)", () => {
  beforeEach(() => productoFindFirstMock.mockReset());

  it("producto con stock limitado: disponible=true con cantidad exacta", async () => {
    productoFindFirstMock.mockResolvedValue({ manejaStock: true, cantidadDisponible: 5 });
    const tool = registroHerramientas.get("consultar_disponibilidad")!;
    const resultado = await tool.execute({ productoId: "p1" }, ctx);
    expect(resultado).toEqual({ ok: true, data: { disponible: true, cantidadDisponible: 5, manejaStock: true } });
  });

  it("producto sin stock: disponible=false", async () => {
    productoFindFirstMock.mockResolvedValue({ manejaStock: true, cantidadDisponible: 0 });
    const tool = registroHerramientas.get("consultar_disponibilidad")!;
    const resultado = await tool.execute({ productoId: "p2" }, ctx);
    expect(resultado).toEqual({ ok: true, data: { disponible: false, cantidadDisponible: 0, manejaStock: true } });
  });

  it("producto que no maneja stock (servicio/digital): disponible=true, cantidad null", async () => {
    productoFindFirstMock.mockResolvedValue({ manejaStock: false, cantidadDisponible: 0 });
    const tool = registroHerramientas.get("consultar_disponibilidad")!;
    const resultado = await tool.execute({ productoId: "p3" }, ctx);
    expect(resultado).toEqual({ ok: true, data: { disponible: true, cantidadDisponible: null, manejaStock: false } });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { producto: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));

const { producirCapaCatalogo } = await import("./catalogo");

const producto = (i: number, extra: Record<string, unknown> = {}) => ({
  nombre: `Producto ${i}`,
  sku: null,
  precio: 10 + i,
  moneda: "PEN",
  unidad: "unidad",
  categoria: null,
  ...extra,
});

describe("producirCapaCatalogo (028)", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("con menos productos que el límite lista todos, sin la línea de 'hay más'", async () => {
    findManyMock.mockResolvedValue([producto(1), producto(2)]);

    const texto = await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 5 });

    expect(texto).toContain("- Producto 1 — 11.00 PEN / unidad");
    expect(texto).toContain("- Producto 2 — 12.00 PEN / unidad");
    expect(texto).not.toContain("Hay más productos");
  });

  it("con más productos que el límite corta en el límite y avisa que hay más", async () => {
    findManyMock.mockResolvedValue([producto(1), producto(2), producto(3)]);

    const texto = await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 2 });

    expect(texto).toContain("Producto 2");
    expect(texto).not.toContain("Producto 3");
    expect(texto).toContain("Hay más productos que no aparecen en esta lista: usa buscar_productos");
    expect(findManyMock.mock.calls[0][0].take).toBe(3);
  });

  it("filtra por instancia, activos y precio > 0", async () => {
    findManyMock.mockResolvedValue([]);
    await producirCapaCatalogo({ instanciaId: "instancia-x", activo: true, limite: 30 });

    expect(findManyMock.mock.calls[0][0].where).toEqual({ instanciaId: "instancia-x", activo: true, ventaDirecta: true, precio: { gt: 0 } });
  });

  it("incluye sku y categoría cuando existen", async () => {
    findManyMock.mockResolvedValue([producto(1, { sku: "COJ-01", categoria: "Decoración", precio: 45 })]);

    const texto = await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 30 });

    expect(texto).toContain("- Producto 1 (COJ-01) — 45.00 PEN / unidad · Decoración");
  });

  it("devuelve null si está desactivado, si no hay productos o si la consulta falla", async () => {
    expect(await producirCapaCatalogo({ instanciaId: "i1", activo: false, limite: 30 })).toBeNull();
    expect(findManyMock).not.toHaveBeenCalled();

    findManyMock.mockResolvedValue([]);
    expect(await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 30 })).toBeNull();

    vi.spyOn(console, "error").mockImplementation(() => {});
    findManyMock.mockRejectedValue(new Error("db"));
    expect(await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 30 })).toBeNull();
  });
});

describe("producirCapaCatalogo — variantes (030)", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("un producto con variantes se lista con el precio efectivo de cada variante activa", async () => {
    findManyMock.mockResolvedValue([
      {
        nombre: "Base Luminaria", sku: null, precio: 15, moneda: "USD", unidad: "unidad", categoria: null,
        tieneVariantes: true, variantes: [{ nombre: "Amarilla", precio: null }, { nombre: "Multicolor", precio: 18 }],
      },
    ]);
    const texto = await producirCapaCatalogo({ instanciaId: "i1", activo: true, limite: 30 });
    expect(texto).toContain("- Base Luminaria — variantes: Amarilla: 15.00 USD; Multicolor: 18.00 USD / unidad");
  });
});

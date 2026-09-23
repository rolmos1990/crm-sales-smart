import { describe, expect, it, vi, beforeEach } from "vitest";

// 030-variantes-producto — crear/editar productos con variantes contra un
// doble en memoria que lleva stock y variantes de verdad.

const sesion = { usuarioId: "u1", instanciaId: "inst-1", rol: "ADMIN" };

vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: () => Promise.resolve({ ok: true, sesion }),
}));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: () => Promise.resolve(sesion) }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

interface ProductoFake {
  id: string;
  nombre: string;
  sku: string | null;
  precio: number;
  tipo: string;
  manejaStock: boolean;
  cantidadDisponible: number;
  esCombo: boolean;
  tieneVariantes: boolean;
  atributosVariantes: unknown;
}
interface VarianteFake {
  id: string;
  productoId: string;
  valores: Record<string, string>;
  clave: string;
  nombre: string;
  sku: string | null;
  precio: number | null;
  cantidadDisponible: number;
  activo: boolean;
  orden: number;
}

let productos: Map<string, ProductoFake>;
let variantes: Map<string, VarianteFake>;
/** Líneas de venta por variante (historial). */
let usos: Map<string, number>;
let componenteDe: string | null;
let secuencia = 0;

const conCount = (v: VarianteFake) => ({ ...v, _count: { pedidoLineas: usos.get(v.id) ?? 0, cotizacionLineas: 0 } });
const aplicar = (obj: Record<string, unknown>, data: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(data)) if (v !== undefined && k !== "componentes" && k !== "entregaDigital") obj[k] = v;
};

vi.mock("@/shared/db/prisma", () => {
  const db = {
    producto: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const p = productos.get(where.id);
        return Promise.resolve(p ? { ...p, entregaDigital: null, componentes: [] } : null);
      },
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = `p${++secuencia}`;
        const p = { id, sku: null, tipo: "FISICO", esCombo: false, tieneVariantes: false, atributosVariantes: null, ...data } as unknown as ProductoFake;
        productos.set(id, p);
        return Promise.resolve({ ...p, entregaDigital: null });
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = productos.get(where.id)!;
        aplicar(p as unknown as Record<string, unknown>, data);
        return Promise.resolve({ ...p, entregaDigital: null });
      },
      findMany: () => Promise.resolve([]),
    },
    productoComponente: {
      findFirst: () => Promise.resolve(componenteDe ? { combo: { nombre: componenteDe } } : null),
    },
    productoVariante: {
      findMany: ({ where }: { where: { productoId: string } }) =>
        Promise.resolve([...variantes.values()].filter((v) => v.productoId === where.productoId).map(conCount)),
      create: ({ data }: { data: VarianteFake }) => {
        const v = { ...data, id: `v${++secuencia}` };
        variantes.set(v.id, v);
        return Promise.resolve(v);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<VarianteFake> }) => {
        const v = variantes.get(where.id)!;
        aplicar(v as unknown as Record<string, unknown>, data);
        return Promise.resolve(v);
      },
      delete: ({ where }: { where: { id: string } }) => {
        variantes.delete(where.id);
        return Promise.resolve({});
      },
      deleteMany: ({ where }: { where: { productoId: string } }) => {
        for (const v of [...variantes.values()]) if (v.productoId === where.productoId) variantes.delete(v.id);
        return Promise.resolve({});
      },
    },
  };
  return { prisma: { ...db, $transaction: (cb: (tx: typeof db) => unknown) => cb(db) } };
});

const { crearProducto, actualizarProducto } = await import("./actions");

const color = { nombre: "Color de luz", valores: ["Amarilla", "Multicolor"] };
const varianteDe = (valor: string, extra: Record<string, unknown> = {}) => ({ valores: { "Color de luz": valor }, ...extra });
const variantesDe = (productoId: string) => [...variantes.values()].filter((v) => v.productoId === productoId);
const stockTotal = (productoId: string) =>
  productos.get(productoId)!.cantidadDisponible + variantesDe(productoId).reduce((a, v) => a + v.cantidadDisponible, 0);

function productoExistente(extra: Partial<ProductoFake> = {}): ProductoFake {
  const p: ProductoFake = {
    id: "base", nombre: "Base Luminaria", sku: "BASE-001", precio: 15, tipo: "FISICO",
    manejaStock: true, cantidadDisponible: 10, esCombo: false, tieneVariantes: false, atributosVariantes: null, ...extra,
  };
  productos.set(p.id, p);
  return p;
}

describe("030 — productos con variantes", () => {
  beforeEach(() => {
    productos = new Map();
    variantes = new Map();
    usos = new Map();
    componenteDe = null;
  });

  it("crear un producto sin variantes funciona como siempre", async () => {
    const r = await crearProducto({ nombre: "Cojín", precio: 45, manejaStock: true, cantidadDisponible: 5 });
    expect(r.exito).toBe(true);
    const creado = [...productos.values()][0];
    expect(creado.tieneVariantes).toBe(false);
    expect(creado.cantidadDisponible).toBe(5);
    expect(variantes.size).toBe(0);
  });

  it("editar un producto existente sin variantes no toca stock, SKU ni precio", async () => {
    productoExistente();
    await actualizarProducto("base", { nombre: "Base Luminaria XL" });
    expect(productos.get("base")).toMatchObject({ nombre: "Base Luminaria XL", sku: "BASE-001", precio: 15, cantidadDisponible: 10, tieneVariantes: false });
  });

  it("crear un producto directamente con variantes: SKU y stock independientes, sin stock propio", async () => {
    const r = await crearProducto({
      nombre: "Camiseta", precio: 20, manejaStock: true, cantidadDisponible: 99,
      tieneVariantes: true,
      atributosVariantes: [{ nombre: "Talla", valores: ["S", "M"] }],
      variantes: [
        { valores: { Talla: "S" }, sku: "CAM-S", cantidadDisponible: 3 },
        { valores: { Talla: "M" }, sku: "CAM-M", cantidadDisponible: 7, precio: 22 },
      ],
    });
    expect(r.exito).toBe(true);
    const producto = [...productos.values()][0];
    expect(producto.cantidadDisponible).toBe(0);
    const lista = variantesDe(producto.id);
    expect(lista.map((v) => [v.nombre, v.sku, v.cantidadDisponible, v.precio])).toEqual([
      ["S", "CAM-S", 3, null],
      ["M", "CAM-M", 7, 22],
    ]);
  });

  it("activar variantes en un producto existente reparte el stock sin duplicarlo (10 → 6 + 4)", async () => {
    productoExistente();
    const r = await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [color],
      variantes: [varianteDe("Amarilla", { cantidadDisponible: 6 }), varianteDe("Multicolor", { cantidadDisponible: 4 })],
    });

    expect(r.exito).toBe(true);
    expect(productos.get("base")!.cantidadDisponible).toBe(0);
    expect(variantesDe("base").map((v) => v.cantidadDisponible)).toEqual([6, 4]);
    expect(stockTotal("base")).toBe(10);
    // El producto conserva su SKU y precio.
    expect(productos.get("base")).toMatchObject({ sku: "BASE-001", precio: 15 });
  });

  it("rechaza una distribución que no suma el stock actual y no escribe nada", async () => {
    productoExistente();
    const r = await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [color],
      variantes: [varianteDe("Amarilla", { cantidadDisponible: 10 }), varianteDe("Multicolor", { cantidadDisponible: 10 })],
    });
    expect(r).toEqual({ exito: false, error: "Distribuye el stock actual (10) entre las variantes: asignado 20" });
    expect(productos.get("base")!.cantidadDisponible).toBe(10);
    expect(variantes.size).toBe(0);
  });

  it("rechaza combinaciones duplicadas", async () => {
    productoExistente({ cantidadDisponible: 0 });
    const r = await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [color],
      variantes: [varianteDe("Amarilla"), varianteDe("amarilla")],
    });
    expect(r.exito).toBe(false);
    expect(variantes.size).toBe(0);
  });

  it("editar variantes: una con historial que se quita se desactiva, una sin historial se borra, las demás conservan SKU y stock", async () => {
    productoExistente();
    await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [{ nombre: "Color de luz", valores: ["Amarilla", "Multicolor", "Blanca"] }],
      variantes: [
        varianteDe("Amarilla", { sku: "AM", cantidadDisponible: 5 }),
        varianteDe("Multicolor", { cantidadDisponible: 3 }),
        varianteDe("Blanca", { cantidadDisponible: 2 }),
      ],
    });
    const [amarilla, multicolor, blanca] = variantesDe("base");
    usos.set(multicolor.id, 1); // Multicolor ya se vendió.

    // Se quita Multicolor y Blanca del atributo; Amarilla sigue.
    const r = await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [{ nombre: "Color de luz", valores: ["Amarilla"] }],
      variantes: [{ id: amarilla.id, valores: { "Color de luz": "Amarilla" }, sku: "AM", cantidadDisponible: 5 }],
    });

    expect(r.exito).toBe(true);
    expect(variantes.get(amarilla.id)).toMatchObject({ sku: "AM", cantidadDisponible: 5, activo: true });
    expect(variantes.get(multicolor.id)).toMatchObject({ activo: false });
    expect(variantes.has(blanca.id)).toBe(false);
  });

  it("editar solo el precio de un producto con variantes conserva sus variantes", async () => {
    productoExistente({ tieneVariantes: true, cantidadDisponible: 0, atributosVariantes: [color] });
    variantes.set("va", { id: "va", productoId: "base", valores: { "Color de luz": "Amarilla" }, clave: "color de luz=amarilla", nombre: "Amarilla", sku: null, precio: null, cantidadDisponible: 6, activo: true, orden: 0 });
    await actualizarProducto("base", { precio: 18 });
    expect(variantes.get("va")!.cantidadDisponible).toBe(6);
    expect(productos.get("base")!.precio).toBe(18);
  });

  it("apagar variantes sin historial devuelve la suma del stock al producto", async () => {
    productoExistente();
    await actualizarProducto("base", {
      tieneVariantes: true,
      atributosVariantes: [color],
      variantes: [varianteDe("Amarilla", { cantidadDisponible: 6 }), varianteDe("Multicolor", { cantidadDisponible: 4 })],
    });

    const r = await actualizarProducto("base", { tieneVariantes: false });

    expect(r.exito).toBe(true);
    expect(productos.get("base")).toMatchObject({ tieneVariantes: false, cantidadDisponible: 10 });
    expect(variantes.size).toBe(0);
  });

  it("apagar variantes con historial se rechaza", async () => {
    productoExistente();
    await actualizarProducto("base", {
      tieneVariantes: true, atributosVariantes: [color],
      variantes: [varianteDe("Amarilla", { cantidadDisponible: 6 }), varianteDe("Multicolor", { cantidadDisponible: 4 })],
    });
    usos.set(variantesDe("base")[0].id, 2);

    const r = await actualizarProducto("base", { tieneVariantes: false });

    expect(r.exito).toBe(false);
    expect(productos.get("base")!.tieneVariantes).toBe(true);
    expect(stockTotal("base")).toBe(10);
  });

  it("un combo no puede tener variantes, y un componente no puede activarlas", async () => {
    const combo = await crearProducto({
      nombre: "Combo", precio: 1, esCombo: true, componentes: [], tieneVariantes: true, atributosVariantes: [color], variantes: [varianteDe("Amarilla")],
    });
    expect(combo.exito).toBe(false);

    productoExistente();
    componenteDe = "Luminaria Luna Grande";
    const r = await actualizarProducto("base", {
      tieneVariantes: true, atributosVariantes: [color],
      variantes: [varianteDe("Amarilla", { cantidadDisponible: 10 }), varianteDe("Multicolor", { cantidadDisponible: 0 })],
    });
    expect(r).toEqual({ exito: false, error: "Este producto es componente de «Luminaria Luna Grande» y no puede tener variantes" });
  });

  it("rechaza un id de variante que no pertenece al producto", async () => {
    productoExistente({ cantidadDisponible: 0 });
    const r = await actualizarProducto("base", {
      tieneVariantes: true, atributosVariantes: [color],
      variantes: [{ id: "de-otro-producto", valores: { "Color de luz": "Amarilla" } }],
    });
    expect(r).toEqual({ exito: false, error: "Variante no encontrada" });
  });
});

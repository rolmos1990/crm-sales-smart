import { describe, expect, it, vi, beforeEach } from "vitest";

const sesion = { usuarioId: "u1", instanciaId: "inst-1", rol: "ADMIN" };

vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: () => Promise.resolve({ ok: true, sesion }),
}));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: () => Promise.resolve(sesion) }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const productoFindMany = vi.fn();
const productoFindUnique = vi.fn();
const productoCreate = vi.fn();
const productoUpdate = vi.fn();
const componenteFindFirst = vi.fn();

vi.mock("@/shared/db/prisma", () => {
  const db = {
    producto: {
      findMany: (...a: unknown[]) => productoFindMany(...a),
      findUnique: (...a: unknown[]) => productoFindUnique(...a),
      create: (...a: unknown[]) => productoCreate(...a),
      update: (...a: unknown[]) => productoUpdate(...a),
    },
    productoComponente: { findFirst: (...a: unknown[]) => componenteFindFirst(...a) },
    productoVariante: { findMany: () => Promise.resolve([]) },
  };
  return { prisma: { ...db, $transaction: (cb: (tx: typeof db) => unknown) => cb(db) } };
});

const { crearProducto, actualizarProducto } = await import("./actions");

const creado = { id: "combo-1", nombre: "Luminaria Luna Grande", precio: 26, cantidadDisponible: 0, entregaDigital: null };
const base = { nombre: "Luminaria Luna Grande", precio: 26 };

describe("029 — crear y editar combos", () => {
  beforeEach(() => {
    for (const m of [productoFindMany, productoFindUnique, productoCreate, productoUpdate, componenteFindFirst]) m.mockReset();
    productoCreate.mockResolvedValue(creado);
    productoUpdate.mockResolvedValue(creado);
    componenteFindFirst.mockResolvedValue(null);
    // Por defecto los componentes existen en la instancia y son simples.
    productoFindMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(where.id.in.map((id) => ({ id, esCombo: false }))),
    );
  });

  it("crea un combo con sus componentes, sin stock propio", async () => {
    const r = await crearProducto({
      ...base,
      esCombo: true,
      manejaStock: true,
      componentes: [{ productoId: "base", cantidad: 1 }, { productoId: "esfera", cantidad: 1 }],
    });

    expect(r.exito).toBe(true);
    const data = productoCreate.mock.calls[0][0].data;
    expect(data.esCombo).toBe(true);
    expect(data.manejaStock).toBe(false);
    expect(data.componentes.create).toEqual([
      { componenteId: "base", cantidad: 1 },
      { componenteId: "esfera", cantidad: 1 },
    ]);
    // Los componentes se buscan solo dentro de la instancia del usuario.
    expect(productoFindMany.mock.calls[0][0].where.instanciaId).toBe("inst-1");
  });

  it("agregar dos veces el mismo componente suma la cantidad en vez de duplicarlo", async () => {
    await crearProducto({
      ...base,
      esCombo: true,
      componentes: [{ productoId: "base", cantidad: 1 }, { productoId: "base", cantidad: 2 }],
    });
    expect(productoCreate.mock.calls[0][0].data.componentes.create).toEqual([{ componenteId: "base", cantidad: 3 }]);
  });

  it("rechaza un combo sin componentes", async () => {
    const r = await crearProducto({ ...base, esCombo: true, componentes: [] });
    expect(r).toEqual({ exito: false, error: "Un combo necesita al menos un componente" });
    expect(productoCreate).not.toHaveBeenCalled();
  });

  it("rechaza otro combo como componente (sin combos anidados)", async () => {
    productoFindMany.mockResolvedValue([{ id: "otro-combo", esCombo: true }]);
    const r = await crearProducto({ ...base, esCombo: true, componentes: [{ productoId: "otro-combo", cantidad: 1 }] });
    expect(r).toEqual({ exito: false, error: "Un combo solo puede tener productos simples como componentes" });
  });

  it("rechaza un componente de otra instancia (no se encuentra)", async () => {
    productoFindMany.mockResolvedValue([]);
    const r = await crearProducto({ ...base, esCombo: true, componentes: [{ productoId: "ajeno", cantidad: 1 }] });
    expect(r).toEqual({ exito: false, error: "Componente no encontrado" });
  });

  it("rechaza cantidades no enteras o menores a 1", async () => {
    expect((await crearProducto({ ...base, esCombo: true, componentes: [{ productoId: "b", cantidad: 0 }] })).exito).toBe(false);
    expect((await crearProducto({ ...base, esCombo: true, componentes: [{ productoId: "b", cantidad: 1.5 }] })).exito).toBe(false);
  });

  it("un combo no puede incluirse a sí mismo", async () => {
    productoFindUnique.mockResolvedValue({ precio: 26, tipo: "FISICO", esCombo: true, entregaDigital: null, componentes: [] });
    const r = await actualizarProducto("combo-1", { esCombo: true, componentes: [{ productoId: "combo-1", cantidad: 1 }] });
    expect(r).toEqual({ exito: false, error: "Un combo no puede incluirse a sí mismo" });
  });

  it("un producto que ya es componente de un combo no puede volverse combo (ciclo indirecto)", async () => {
    productoFindUnique.mockResolvedValue({ precio: 15, tipo: "FISICO", esCombo: false, entregaDigital: null, componentes: [] });
    componenteFindFirst.mockResolvedValue({ combo: { nombre: "Luminaria Luna Grande" } });

    const r = await actualizarProducto("base", { esCombo: true, componentes: [{ productoId: "esfera", cantidad: 1 }] });

    expect(r).toEqual({
      exito: false,
      error: "Este producto es componente de «Luminaria Luna Grande» y no puede convertirse en combo",
    });
    expect(productoUpdate).not.toHaveBeenCalled();
  });

  it("editar componentes reemplaza la composición completa", async () => {
    productoFindUnique.mockResolvedValue({
      precio: 26, tipo: "FISICO", esCombo: true, entregaDigital: null,
      componentes: [{ componenteId: "base", cantidad: 1 }, { componenteId: "esfera", cantidad: 1 }],
    });

    await actualizarProducto("combo-1", { componentes: [{ productoId: "base", cantidad: 2 }, { productoId: "cable", cantidad: 1 }] });

    const data = productoUpdate.mock.calls[0][0].data;
    expect(data.componentes).toEqual({
      deleteMany: {},
      create: [{ componenteId: "base", cantidad: 2 }, { componenteId: "cable", cantidad: 1 }],
    });
    expect(data.manejaStock).toBe(false);
  });

  it("editar otro campo de un combo conserva sus componentes sin tocarlos", async () => {
    productoFindUnique.mockResolvedValue({
      precio: 26, tipo: "FISICO", esCombo: true, entregaDigital: null,
      componentes: [{ componenteId: "base", cantidad: 1 }],
    });
    await actualizarProducto("combo-1", { precio: 28 });
    expect(productoUpdate.mock.calls[0][0].data.componentes).toBeUndefined();
  });

  it("dejar de ser combo borra la composición", async () => {
    productoFindUnique.mockResolvedValue({
      precio: 26, tipo: "FISICO", esCombo: true, entregaDigital: null, componentes: [{ componenteId: "base", cantidad: 1 }],
    });
    await actualizarProducto("combo-1", { esCombo: false });
    expect(productoUpdate.mock.calls[0][0].data.componentes).toEqual({ deleteMany: {} });
  });

  it("un producto existente sin los campos nuevos se crea y edita igual que siempre", async () => {
    await crearProducto({ nombre: "Cojín", precio: 45, manejaStock: true, cantidadDisponible: 5 });
    const data = productoCreate.mock.calls[0][0].data;
    expect(data.esCombo).toBe(false);
    expect(data.manejaStock).toBe(true);
    expect(data.cantidadDisponible).toBe(5);
    expect(data.componentes).toBeUndefined();
    expect(productoFindMany).not.toHaveBeenCalled();

    productoFindUnique.mockResolvedValue({ precio: 45, tipo: "FISICO", esCombo: false, entregaDigital: null, componentes: [] });
    await actualizarProducto("cojin", { precio: 50 });
    const upd = productoUpdate.mock.calls[0][0].data;
    expect(upd.componentes).toBeUndefined();
    expect(upd.manejaStock).toBeUndefined();
  });

  it("un componente oculto para venta directa sí puede usarse en un combo", async () => {
    // La validación de composición no mira ventaDirecta: solo que exista,
    // sea de la instancia y no sea combo.
    const r = await crearProducto({ ...base, esCombo: true, componentes: [{ productoId: "base-oculta", cantidad: 1 }] });
    expect(r.exito).toBe(true);
    expect(productoFindMany.mock.calls[0][0].select).not.toHaveProperty("ventaDirecta");
  });
});

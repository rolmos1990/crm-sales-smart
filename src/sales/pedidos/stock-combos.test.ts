import { describe, expect, it, vi, beforeEach } from "vitest";

// 029-combos-productos-compuestos — flujos reales de crearPedido/editarPedido
// contra un doble en memoria de Prisma que lleva el stock de verdad.

const sesion = { usuarioId: "u1", instanciaId: "inst-1", rol: "ADMIN" };

vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: () => Promise.resolve({ ok: true, sesion }),
}));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: () => Promise.resolve(sesion) }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/sales/flujo-venta/queries", () => ({ obtenerFlujoVenta: () => Promise.resolve(null) }));
vi.mock("./queries", () => ({ generarNumeroPedido: () => Promise.resolve("PED-0001") }));

interface ProductoFake {
  id: string;
  nombre: string;
  tipo: string;
  instanciaId: string;
  manejaStock: boolean;
  cantidadDisponible: number;
  esCombo: boolean;
  componentes: { componenteId: string; cantidad: number }[];
}

let productos: Map<string, ProductoFake>;
let lineasCreadas: Record<string, unknown>[];
let lineasActualizadas: Record<string, unknown>[];
let pedidoActual: unknown;

function producto(p: Partial<ProductoFake> & { id: string }): ProductoFake {
  return { nombre: p.id, tipo: "FISICO", instanciaId: "inst-1", manejaStock: false, cantidadDisponible: 0, esCombo: false, componentes: [], ...p };
}

const productoDb = {
  findMany: ({ where }: { where: { id: { in: string[] }; esCombo?: boolean; instanciaId?: string } }) =>
    Promise.resolve(
      where.id.in
        .map((id) => productos.get(id))
        .filter((p): p is ProductoFake => !!p)
        .filter((p) => (where.esCombo === undefined || p.esCombo === where.esCombo) && (!where.instanciaId || p.instanciaId === where.instanciaId))
        .map((p) => ({
          ...p,
          componentes: p.componentes.map((c) => ({
            cantidad: c.cantidad,
            componente: { id: c.componenteId, nombre: productos.get(c.componenteId)!.nombre },
          })),
        })),
    ),
  update: ({ where, data }: { where: { id: string }; data: { cantidadDisponible: { increment?: number; decrement?: number } } }) => {
    const p = productos.get(where.id)!;
    p.cantidadDisponible += (data.cantidadDisponible.increment ?? 0) - (data.cantidadDisponible.decrement ?? 0);
    return Promise.resolve(p);
  },
};

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    producto: productoDb,
    usuario: { findFirst: () => Promise.resolve({ nombre: "Admin" }) },
    pedido: {
      create: ({ data }: { data: { lineas: { create: Record<string, unknown>[] } } }) => {
        lineasCreadas = data.lineas.create;
        return Promise.resolve({ id: "ped-1", numero: "PED-0001", descuento: 0, costoEnvio: 0 });
      },
      findFirst: () => Promise.resolve(pedidoActual),
    },
    $transaction: (cb: (tx: unknown) => unknown) =>
      cb({
        pedido: { update: () => Promise.resolve({}) },
        pedidoLinea: {
          deleteMany: () => Promise.resolve({}),
          create: ({ data }: { data: Record<string, unknown> }) => {
            lineasCreadas.push(data);
            return Promise.resolve({});
          },
          update: ({ data }: { data: Record<string, unknown> }) => {
            lineasActualizadas.push(data);
            return Promise.resolve({});
          },
        },
      }),
  },
}));

const { crearPedido, editarPedido } = await import("./actions");

const lineaPedido = (productoId: string, cantidad: number, extra: Record<string, unknown> = {}) => ({
  productoId,
  descripcion: productoId,
  cantidad,
  precioUnitario: 26,
  descuento: 0,
  ...extra,
});

const datosPedido = (lineas: ReturnType<typeof lineaPedido>[]) => ({ moneda: "USD", impuesto: 0, lineas });

/** Estado persistido de un pedido ya creado, como lo devuelve findFirst. */
function pedidoGuardado(lineas: { id: string; productoId: string; cantidad: number; composicionCombo?: unknown }[]) {
  return {
    id: "ped-1",
    costoEnvio: 0,
    flujoVentaEtapa: null,
    estado: "PENDIENTE",
    lineas: lineas.map((l) => ({
      descripcion: l.productoId,
      precioUnitario: 26,
      descuento: 0,
      cantidadPreparada: 0,
      composicionCombo: null,
      producto: { nombre: productos.get(l.productoId)?.nombre ?? l.productoId },
      ...l,
    })),
  };
}

const stock = (id: string) => productos.get(id)!.cantidadDisponible;

describe("029 — pedidos con combos", () => {
  beforeEach(() => {
    lineasCreadas = [];
    lineasActualizadas = [];
    productos = new Map(
      [
        producto({ id: "base", nombre: "Base Luminaria Grande", manejaStock: true, cantidadDisponible: 15 }),
        producto({ id: "esfera", nombre: "Esfera Luna Grande", manejaStock: true, cantidadDisponible: 10 }),
        producto({
          id: "luminaria",
          nombre: "Luminaria Luna Grande",
          esCombo: true,
          componentes: [{ componenteId: "base", cantidad: 1 }, { componenteId: "esfera", cantidad: 1 }],
        }),
        producto({ id: "cojin", nombre: "Cojín", manejaStock: true, cantidadDisponible: 10 }),
      ].map((p) => [p.id, p]),
    );
  });

  it("crear un pedido con 2 combos guarda una línea (el combo) y descuenta los componentes", async () => {
    const r = await crearPedido(datosPedido([lineaPedido("luminaria", 2)]));

    expect(r.exito).toBe(true);
    expect(lineasCreadas).toHaveLength(1);
    expect(lineasCreadas[0]).toMatchObject({ productoId: "luminaria", cantidad: 2, precioUnitario: 26, subtotal: 52 });
    expect(lineasCreadas[0].composicionCombo).toEqual([
      { productoId: "base", nombre: "Base Luminaria Grande", cantidad: 1 },
      { productoId: "esfera", nombre: "Esfera Luna Grande", cantidad: 1 },
    ]);
    expect(stock("base")).toBe(13);
    expect(stock("esfera")).toBe(8);
    expect(stock("luminaria")).toBe(0);
  });

  it("componentes con cantidad > 1 descuentan la cantidad multiplicada", async () => {
    productos.get("luminaria")!.componentes = [{ componenteId: "base", cantidad: 2 }, { componenteId: "esfera", cantidad: 1 }];
    await crearPedido(datosPedido([lineaPedido("luminaria", 3)]));
    expect(stock("base")).toBe(9);
    expect(stock("esfera")).toBe(7);
  });

  it("rechaza sin tocar stock si un componente no alcanza", async () => {
    productos.get("esfera")!.cantidadDisponible = 1;
    const r = await crearPedido(datosPedido([lineaPedido("luminaria", 2)]));

    expect(r).toEqual({
      exito: false,
      error: 'Stock insuficiente para "Esfera Luna Grande" (componente de "Luminaria Luna Grande"). Disponible: 1 — solicitado: 2',
    });
    expect(stock("base")).toBe(15);
    expect(lineasCreadas).toHaveLength(0);
  });

  it("editar de 2 a 1 combo devuelve una unidad de cada componente", async () => {
    await crearPedido(datosPedido([lineaPedido("luminaria", 2)]));
    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "luminaria", cantidad: 2, composicionCombo: lineasCreadas[0].composicionCombo }]);

    const r = await editarPedido("ped-1", datosPedido([lineaPedido("luminaria", 1, { id: "l1" })]));

    expect(r.exito).toBe(true);
    expect(stock("base")).toBe(14);
    expect(stock("esfera")).toBe(9);
    // Una línea existente con el mismo producto no reescribe su snapshot.
    expect(lineasActualizadas[0]).not.toHaveProperty("composicionCombo");
  });

  it("quitar la línea del combo devuelve todo", async () => {
    await crearPedido(datosPedido([lineaPedido("luminaria", 2)]));
    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "luminaria", cantidad: 2, composicionCombo: lineasCreadas[0].composicionCombo }]);

    await editarPedido("ped-1", datosPedido([lineaPedido("cojin", 1)]));

    expect(stock("base")).toBe(15);
    expect(stock("esfera")).toBe(10);
    expect(stock("cojin")).toBe(9);
  });

  it("la reversión usa la composición guardada aunque el combo haya cambiado después", async () => {
    await crearPedido(datosPedido([lineaPedido("luminaria", 2)]));
    const snapshot = lineasCreadas[0].composicionCombo;
    // El combo pasa a llevar 2 Bases; el pedido viejo se hizo con 1.
    productos.get("luminaria")!.componentes = [{ componenteId: "base", cantidad: 2 }, { componenteId: "esfera", cantidad: 1 }];
    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "luminaria", cantidad: 2, composicionCombo: snapshot }]);

    await editarPedido("ped-1", datosPedido([lineaPedido("cojin", 1)]));

    expect(stock("base")).toBe(15);
    expect(stock("esfera")).toBe(10);
  });

  it("un producto común se comporta exactamente como antes (crear, subir, bajar, quitar)", async () => {
    await crearPedido(datosPedido([lineaPedido("cojin", 3)]));
    expect(stock("cojin")).toBe(7);
    expect(lineasCreadas[0].composicionCombo).toBeUndefined();

    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "cojin", cantidad: 3 }]);
    await editarPedido("ped-1", datosPedido([lineaPedido("cojin", 5, { id: "l1" })]));
    expect(stock("cojin")).toBe(5);

    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "cojin", cantidad: 5 }]);
    await editarPedido("ped-1", datosPedido([lineaPedido("cojin", 1, { id: "l1" })]));
    expect(stock("cojin")).toBe(9);

    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "cojin", cantidad: 1 }]);
    await editarPedido("ped-1", datosPedido([lineaPedido("luminaria", 1)]));
    expect(stock("cojin")).toBe(10);
  });

  it("en una edición, el mensaje de falta de stock dice 'adicional requerido' como antes", async () => {
    pedidoActual = pedidoGuardado([{ id: "l1", productoId: "cojin", cantidad: 3 }]);
    productos.get("cojin")!.cantidadDisponible = 1;

    const r = await editarPedido("ped-1", datosPedido([lineaPedido("cojin", 6, { id: "l1" })]));

    expect(r).toEqual({ exito: false, error: 'Stock insuficiente para "Cojín". Disponible: 1 — adicional requerido: 3' });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

// 036-fix-sync-fecha-entrega-pedido — `Pedido.fechaEntrega` (listado, filtro
// "Entrega estimada", KPIs y Preparación) y `EntregaPedido.fechaEstimada`
// (sección "Entrega y seguimiento" del detalle) son campos distintos que
// deben quedar siempre con el mismo valor. `editarPedido` escribía solo el
// primero, así que después de editar un pedido las dos pantallas mostraban
// fechas distintas — o el listado "—" y el detalle una fecha.
//
// Se verifica contra un doble de Prisma en memoria (mismo patrón que
// stock-combos.test.ts, que ya ejercita editarPedido sin base de datos).

const sesion = { usuarioId: "u1", instanciaId: "inst-1", rol: "ADMIN" };

vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: () => Promise.resolve({ ok: true, sesion }),
}));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: () => Promise.resolve(sesion) }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/sales/flujo-venta/queries", () => ({ obtenerFlujoVenta: () => Promise.resolve(null) }));
vi.mock("./queries", () => ({ generarNumeroPedido: () => Promise.resolve("PED-0001") }));

/** Filas de EntregaPedido por pedidoId — vacío = pedido sin entrega registrada. */
let entregas: Map<string, Record<string, unknown>>;
/** Lo último que se escribió en Pedido. */
let pedidoEscrito: Record<string, unknown>;

const PEDIDO_ID = "ped-1";
const FECHA_VIEJA = new Date("2026-11-12T05:00:00.000Z");
const FECHA_NUEVA = new Date("2026-11-20T05:00:00.000Z");

/** Entrega ya registrada, con campos vecinos que el fix no debe tocar. */
function entregaRegistrada(fechaEstimada: Date | null) {
  return {
    pedidoId: PEDIDO_ID,
    fechaEstimada,
    metodoEntrega: "COURIER_EXTERNO",
    estadoEntrega: "PENDIENTE",
    numeroGuia: "GUIA-123",
    transportistaId: "tr-1",
    ciudad: "Lima",
  };
}

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    usuario: { findFirst: () => Promise.resolve({ nombre: "Admin" }) },
    producto: {
      // `esCombo: true` → cargarComposiciones (ningún combo en juego);
      // sin ese filtro → resolverTipoCumplimiento.
      findMany: ({ where }: { where: { esCombo?: boolean } }) =>
        Promise.resolve(where.esCombo ? [] : [{ id: "prod-1", tipo: "FISICO" }]),
      update: () => Promise.resolve({}),
    },
    productoVariante: { findMany: () => Promise.resolve([]), update: () => Promise.resolve({}) },
    pedido: {
      findFirst: () =>
        Promise.resolve({
          id: PEDIDO_ID,
          costoEnvio: 0,
          estado: "PENDIENTE",
          // null = sin flujo dinámico: la edición está permitida.
          flujoVentaEtapa: null,
          fechaEntrega: FECHA_VIEJA,
          nombre: null, apellido: null, telefono: null, email: null, ruc: null,
          empresaNombre: null, moneda: "PEN", notas: null, contactoId: null, empresaId: null,
          lineas: [{
            id: "lin-1",
            productoId: "prod-1",
            varianteId: null,
            cantidad: 1,
            precioUnitario: 100,
            descuento: 0,
            descripcion: "Producto 1",
            cantidadPreparada: 0,
            composicionCombo: null,
            producto: { id: "prod-1", nombre: "Producto 1", manejaStock: false, cantidadDisponible: 0 },
          }],
        }),
    },
    $transaction: (cb: (tx: unknown) => unknown) =>
      cb({
        pedido: {
          update: ({ data }: { data: Record<string, unknown> }) => {
            pedidoEscrito = data;
            return Promise.resolve({});
          },
        },
        entregaPedido: {
          updateMany: ({ where, data }: { where: { pedidoId: string }; data: Record<string, unknown> }) => {
            const fila = entregas.get(where.pedidoId);
            if (fila) Object.assign(fila, data);
            return Promise.resolve({ count: fila ? 1 : 0 });
          },
        },
        pedidoLinea: {
          deleteMany: () => Promise.resolve({}),
          create: () => Promise.resolve({}),
          update: () => Promise.resolve({}),
        },
      }),
  },
}));

const { editarPedido } = await import("./actions");

/** Edición que solo varía en la fecha: misma línea, mismo producto, misma cantidad. */
const datosEdicion = (fechaEntrega?: Date) => ({
  moneda: "PEN",
  impuesto: 0,
  ...(fechaEntrega ? { fechaEntrega } : {}),
  lineas: [{ id: "lin-1", productoId: "prod-1", descripcion: "Producto 1", cantidad: 1, precioUnitario: 100, descuento: 0 }],
});

describe("036 — editarPedido sincroniza la fecha de entrega", () => {
  beforeEach(() => {
    entregas = new Map([[PEDIDO_ID, entregaRegistrada(FECHA_VIEJA)]]);
    pedidoEscrito = {};
  });

  it("cambiar la fecha la escribe en el pedido y en la entrega", async () => {
    const r = await editarPedido(PEDIDO_ID, datosEdicion(FECHA_NUEVA));

    expect(r.exito).toBe(true);
    expect(pedidoEscrito.fechaEntrega).toEqual(FECHA_NUEVA);
    expect(entregas.get(PEDIDO_ID)!.fechaEstimada).toEqual(FECHA_NUEVA);
  });

  it("borrar la fecha la deja en null en el pedido y en la entrega", async () => {
    const r = await editarPedido(PEDIDO_ID, datosEdicion());

    expect(r.exito).toBe(true);
    expect(pedidoEscrito.fechaEntrega).toBeNull();
    expect(entregas.get(PEDIDO_ID)!.fechaEstimada).toBeNull();
  });

  it("un pedido sin entrega registrada no gana una y la edición no falla", async () => {
    entregas = new Map();

    const r = await editarPedido(PEDIDO_ID, datosEdicion(FECHA_NUEVA));

    expect(r.exito).toBe(true);
    expect(pedidoEscrito.fechaEntrega).toEqual(FECHA_NUEVA);
    expect(entregas.size).toBe(0);
  });

  it("no toca ningún otro dato de la entrega", async () => {
    await editarPedido(PEDIDO_ID, datosEdicion(FECHA_NUEVA));

    expect(entregas.get(PEDIDO_ID)).toEqual({
      ...entregaRegistrada(FECHA_NUEVA),
    });
  });
});

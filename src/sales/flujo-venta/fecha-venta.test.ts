import { describe, expect, it, vi, beforeEach } from "vitest";

// 038-cuenta-como-venta — `Pedido.fechaVenta` se sella UNA SOLA VEZ: la
// primera vez que el pedido entra a una etapa con `cuentaComoVenta`. Con
// "Pagado" y "Entregado" marcadas, manda la fecha de "Pagado"; pasar después
// a "Entregado" NO la mueve. Tampoco se borra al volver a una etapa que no
// cuenta — el pedido deja de sumar (la pertenencia se deriva de la etapa
// actual) pero conserva cuándo se vendió.
//
// Invariante: cuando se sella, el valor es el MISMO objeto Date que el
// `creadoEn` de la fila de PedidoHistorialEtapa de ese movimiento, de donde
// se reconstruiría si alguna vez hiciera falta recalcular.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./disparadores/motor", () => ({ procesarCambioEtapaPedido: vi.fn() }));
vi.mock("./reglas/motor", () => ({ validarPedidoParaEtapa: vi.fn() }));

/** Operaciones pasadas a `$transaction`, en orden. */
let operaciones: { modelo: string; data: Record<string, unknown> }[];
/** Configuración de la etapa destino que devuelve el doble de Prisma. */
let etapaDestino: { id: string; nombre: string; flujoVentaId: string; cuentaComoVenta: boolean };
/** `fechaVenta` que ya tiene el pedido antes del movimiento. */
let fechaVentaActual: Date | null;

vi.mock("@/shared/db/prisma", () => {
  const registrar = (modelo: string) =>
    ({ data }: { data: Record<string, unknown> }) => ({ modelo, data });

  return {
    prisma: {
      flujoVentaEtapa: { findFirst: () => Promise.resolve(etapaDestino) },
      pedido: {
        findFirst: () =>
          Promise.resolve({
            fechaVenta: fechaVentaActual,
            flujoVentaEtapa: { nombre: "En proceso" },
          }),
        update: registrar("pedido"),
      },
      usuario: { findFirst: () => Promise.resolve({ nombre: "Ramón" }) },
      pedidoHistorialEtapa: { create: registrar("historial") },
      $transaction: (ops: { modelo: string; data: Record<string, unknown> }[]) => {
        operaciones = ops;
        return Promise.resolve(ops);
      },
    },
  };
});

const { moverPedidoAEtapa } = await import("./motor");

const ETAPA_VENTA = { id: "pagado", nombre: "Pagado", flujoVentaId: "f-1", cuentaComoVenta: true };
const ETAPA_SIN_VENTA = { id: "proceso", nombre: "En proceso", flujoVentaId: "f-1", cuentaComoVenta: false };

const datosDe = (modelo: string) => operaciones.find((o) => o.modelo === modelo)?.data;

beforeEach(() => {
  operaciones = [];
  etapaDestino = ETAPA_VENTA;
  fechaVentaActual = null;
});

describe("fechaVenta — primer sellado", () => {
  it("se sella al entrar por primera vez a una etapa que cuenta como venta", async () => {
    const resultado = await moverPedidoAEtapa("ped-1", "pagado", "u-1");

    expect(resultado).toEqual({ exito: true });
    expect(datosDe("pedido")?.fechaVenta).toBeInstanceOf(Date);
  });

  it("usa el MISMO instante que el `creadoEn` de la fila de historial", async () => {
    await moverPedidoAEtapa("ped-1", "pagado", "u-1");

    // Identidad, no solo igualdad: dos `new Date()` consecutivos pueden caer
    // en el mismo milisegundo y dejar pasar el bug.
    expect(datosDe("historial")?.creadoEn).toBe(datosDe("pedido")?.fechaVenta);
  });

  it("mueve pedido e historial juntos: nunca uno sin el otro", async () => {
    await moverPedidoAEtapa("ped-1", "pagado", "u-1");

    expect(operaciones.map((o) => o.modelo)).toEqual(["pedido", "historial"]);
  });
});

describe("fechaVenta — no se reescribe", () => {
  // El caso que el usuario pidió explícitamente: con "Pagado" y "Entregado"
  // marcadas, manda la fecha del primero al que llegó.
  it("pasar de una etapa de venta a OTRA de venta no mueve la fecha", async () => {
    fechaVentaActual = new Date("2026-11-03T15:00:00.000Z");
    etapaDestino = { id: "entregado", nombre: "Entregado", flujoVentaId: "f-1", cuentaComoVenta: true };

    await moverPedidoAEtapa("ped-1", "entregado", "u-1");

    // `undefined` = la columna no se toca. Distinto de `null`, que la borraría.
    expect(datosDe("pedido")).not.toHaveProperty("fechaVenta");
    expect(datosDe("pedido")?.flujoVentaEtapaId).toBe("entregado");
  });

  it("volver a una etapa que NO cuenta conserva la fecha ya sellada", async () => {
    fechaVentaActual = new Date("2026-11-03T15:00:00.000Z");
    etapaDestino = ETAPA_SIN_VENTA;

    await moverPedidoAEtapa("ped-1", "proceso", "u-1");

    expect(datosDe("pedido")).not.toHaveProperty("fechaVenta");
  });

  it("y si vuelve a cruzar a una etapa de venta, sigue mandando la primera fecha", async () => {
    fechaVentaActual = new Date("2026-11-03T15:00:00.000Z");
    etapaDestino = ETAPA_VENTA;

    await moverPedidoAEtapa("ped-1", "pagado", "u-1");

    expect(datosDe("pedido")).not.toHaveProperty("fechaVenta");
  });
});

describe("fechaVenta — etapas que no cuentan", () => {
  it("moverse entre etapas que no cuentan nunca sella nada", async () => {
    etapaDestino = ETAPA_SIN_VENTA;

    await moverPedidoAEtapa("ped-1", "proceso", "u-1");

    expect(datosDe("pedido")).not.toHaveProperty("fechaVenta");
    expect(datosDe("pedido")?.flujoVentaEtapaId).toBe("proceso");
  });
});

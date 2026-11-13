import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { registroHerramientas } from "@/ai/tools/registry";
import {
  ENTREGA_INPUT_SCHEMA,
  EntregaIASchema,
  describirEntrega,
  resolverEntregaIA,
  sinDatosDeEntrega,
} from "@/ai/tools/shared/resolver-entrega-ia";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

/** true si el error es el unique constraint (instanciaId, numero) — ver el
 *  mismo problema resuelto en generarNumeroPedido (sales/pedidos/queries.ts). */
function esErrorNumeroDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const MAX_INTENTOS_NUMERO = 3;

const LineaSchema = z.object({
  productoId: z.string().optional(),
  descripcion: z.string().min(1),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  descuento: z.number().min(0).max(100).optional(),
});

const ArgsSchema = z.object({
  lineas: z.array(LineaSchema).min(1),
  notas: z.string().optional(),
  impuesto: z.number().min(0).max(100).optional(),
  entrega: EntregaIASchema.optional(),
});

const CrearPedidoTool: IProveedorTool = {
  name: "crear_pedido",
  definition: {
    name: "crear_pedido",
    description:
      "Registra un pedido de compra del cliente. Usar cuando el cliente confirma que quiere comprar y hay acuerdo de precio. Si el pedido se entrega a domicilio, incluí SIEMPRE el bloque `entrega` con el destino y el transportista que ya cotizaste con consultar_opciones_envio: sin él el pedido queda sin método de entrega y operaciones no puede despacharlo.",
    input_schema: {
      type: "object",
      properties: {
        lineas: {
          type: "array",
          description: "Líneas del pedido",
          items: {
            type: "object",
            properties: {
              productoId: { type: "string", description: "ID del producto del catálogo (si aplica)" },
              descripcion: { type: "string", description: "Descripción del ítem" },
              cantidad: { type: "number", description: "Cantidad" },
              precioUnitario: { type: "number", description: "Precio por unidad" },
              descuento: { type: "number", description: "Porcentaje de descuento 0-100 (opcional)" },
            },
            required: ["descripcion", "cantidad", "precioUnitario"],
          },
        },
        notas: { type: "string", description: "Notas adicionales del pedido" },
        impuesto: { type: "number", description: "Porcentaje de impuesto (default 18)" },
        entrega: ENTREGA_INPUT_SCHEMA,
      },
      required: ["lineas"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para crear_pedido" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para crear el pedido" };

    const { prisma } = await import("@/shared/db/prisma");
    // El mismo generador que usa crearPedido: la numeracion es una sola serie
    // PED-<anio>-<consecutivo>, venga de un usuario o del agente.
    const { generarNumeroPedido } = await import("@/sales/pedidos/queries");
    const { obtenerMonedaPrincipal } = await import("@/configuracion/empresa/queries");
    const moneda = await obtenerMonedaPrincipal(ctx.instanciaId);
    const impuestoPct = parsed.data.impuesto ?? 18;

    // 015-herramientas-operativas-inventario-envios-acciones — default false
    // preserva la creación directa actual (FR-016/SC-003: sin cambio de
    // comportamiento salvo que el negocio active el modo borrador).
    const agente = ctx.agenteId
      ? await prisma.agenteIAConfig.findUnique({
          where: { id: ctx.agenteId },
          select: { accionesComercialesModoBorrador: true },
        })
      : null;
    const modoBorrador = agente?.accionesComercialesModoBorrador ?? false;

    const lineasConCalculo = parsed.data.lineas.map((l, i) => {
      const descuentoFactor = 1 - (l.descuento ?? 0) / 100;
      const subtotal = l.cantidad * l.precioUnitario * descuentoFactor;
      return { ...l, subtotal, orden: i };
    });

    const subtotal = lineasConCalculo.reduce((acc, l) => acc + l.subtotal, 0);
    const impuestoMonto = subtotal * (impuestoPct / 100);

    // Mismo criterio que crear_cotizacion: el destino se vuelve a resolver
    // en el servidor contra el motor que usó el agente al cotizar el envío
    // (ver resolver-entrega-ia.ts). Sin bloque `entrega` no se crea ninguna
    // fila, que es el comportamiento que tenía esta tool antes.
    const entregaArgs = parsed.data.entrega;
    const entregaResuelta = sinDatosDeEntrega(entregaArgs)
      ? null
      : await resolverEntregaIA(ctx.instanciaId, entregaArgs);

    const costoEnvio = entregaResuelta?.costoEnvio ?? 0;
    const total = subtotal + impuestoMonto + costoEnvio;
    const resumenEntrega = entregaResuelta ? describirEntrega(entregaResuelta, moneda) : {};

    // 018-simulador-agente — misma lógica de cálculo de arriba, sin tocar
    // Prisma (FR-006/FR-007): reutiliza el 100% de la validación/cálculo.
    if (ctx.modoSimulacion) {
      return {
        ok: true,
        data: {
          subtotal,
          impuesto: impuestoMonto,
          costoEnvio,
          total,
          moneda,
          lineas: lineasConCalculo.length,
          ...resumenEntrega,
          generadoPorIA: true,
          pendienteConfirmacion: modoBorrador,
          previsualizado: true,
          mensaje: `[Simulación] Pedido por ${moneda} ${total.toFixed(2)} — no se creó ningún registro real.`,
        },
      };
    }

    // generarNumeroPedido se recalcula en cada intento: si dos creaciones
    // concurrentes leyeran el mismo "ultimo numero" antes de que cualquiera
    // termine su `create`, la segunda choca con el unique (instanciaId,
    // numero) — se reintenta con un numero fresco. Mismo patron que
    // crearPedido (sales/pedidos/actions.ts).
    const datosPedido = {
      instanciaId: ctx.instanciaId,
      contactoId: ctx.contactoId,
      oportunidadId: ctx.oportunidadId ?? null,
      subtotal,
      impuesto: impuestoMonto,
      costoEnvio,
      total,
      moneda,
      entrega: entregaResuelta ? { create: entregaResuelta.datos } : undefined,
      notas: parsed.data.notas ?? null,
      generadoPorIA: true,
      confirmadoPorHumano: !modoBorrador,
      lineas: {
        create: lineasConCalculo.map((l) => ({
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento ?? 0,
          subtotal: l.subtotal,
          total: l.subtotal,
          orden: l.orden,
          productoId: l.productoId ?? null,
        })),
      },
    };

    let pedido: Awaited<ReturnType<typeof prisma.pedido.create<{ data: typeof datosPedido & { numero: string } }>>> | undefined;
    for (let intento = 1; intento <= MAX_INTENTOS_NUMERO; intento++) {
      const numero = await generarNumeroPedido(ctx.instanciaId);
      try {
        pedido = await prisma.pedido.create({ data: { ...datosPedido, numero } });
        break;
      } catch (e) {
        if (!esErrorNumeroDuplicado(e) || intento === MAX_INTENTOS_NUMERO) throw e;
      }
    }
    if (!pedido) throw new Error("No se pudo generar un número de pedido único");

    return {
      ok: true,
      data: {
        pedidoId: pedido.id,
        numero: pedido.numero,
        subtotal,
        impuesto: impuestoMonto,
        costoEnvio,
        total,
        moneda,
        lineas: lineasConCalculo.length,
        ...resumenEntrega,
        generadoPorIA: true,
        pendienteConfirmacion: modoBorrador,
        mensaje: modoBorrador
          ? `Pedido #${pedido.numero} preparado por S/ ${total.toFixed(2)} — queda sujeto a confirmación antes de procesarse.`
          : `Pedido #${pedido.numero} registrado exitosamente por S/ ${total.toFixed(2)}.`,
      },
    };
  },
};

registroHerramientas.register(CrearPedidoTool);

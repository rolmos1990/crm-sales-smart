import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

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
});

const CrearPedidoTool: IProveedorTool = {
  name: "crear_pedido",
  definition: {
    name: "crear_pedido",
    description:
      "Registra un pedido de compra del cliente. Usar cuando el cliente confirma que quiere comprar y hay acuerdo de precio.",
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
      },
      required: ["lineas"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para crear_pedido" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para crear el pedido" };

    const { prisma } = await import("@/shared/db/prisma");
    const { obtenerMonedaPrincipal } = await import("@/configuracion/empresa/queries");
    const moneda = await obtenerMonedaPrincipal(ctx.instanciaId);
    const impuestoPct = parsed.data.impuesto ?? 18;

    const lineasConCalculo = parsed.data.lineas.map((l, i) => {
      const descuentoFactor = 1 - (l.descuento ?? 0) / 100;
      const subtotal = l.cantidad * l.precioUnitario * descuentoFactor;
      return { ...l, subtotal, orden: i };
    });

    const subtotal = lineasConCalculo.reduce((acc, l) => acc + l.subtotal, 0);
    const impuestoMonto = subtotal * (impuestoPct / 100);
    const total = subtotal + impuestoMonto;

    const count = await prisma.pedido.count({ where: { instanciaId: ctx.instanciaId } });
    const numero = String(count + 1).padStart(5, "0");

    const pedido = await prisma.pedido.create({
      data: {
        instanciaId: ctx.instanciaId,
        contactoId: ctx.contactoId,
        oportunidadId: ctx.oportunidadId ?? null,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        moneda,
        notas: parsed.data.notas ?? null,
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
      },
    });

    return {
      ok: true,
      data: {
        pedidoId: pedido.id,
        numero: pedido.numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        moneda,
        lineas: lineasConCalculo.length,
        mensaje: `Pedido #${numero} registrado exitosamente por S/ ${total.toFixed(2)}.`,
      },
    };
  },
};

registroHerramientas.register(CrearPedidoTool);

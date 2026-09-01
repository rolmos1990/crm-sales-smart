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

const CrearCotizacionTool: IProveedorTool = {
  name: "crear_cotizacion",
  definition: {
    name: "crear_cotizacion",
    description:
      "Crea una cotización con los productos solicitados por el cliente. Usar cuando el cliente pide un presupuesto o cotización formal.",
    input_schema: {
      type: "object",
      properties: {
        lineas: {
          type: "array",
          description: "Líneas de la cotización",
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
        notas: { type: "string", description: "Notas adicionales para el cliente" },
        impuesto: { type: "number", description: "Porcentaje de impuesto (default 18)" },
      },
      required: ["lineas"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para crear_cotizacion" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para crear la cotización" };

    const { prisma } = await import("@/shared/db/prisma");
    const { obtenerMonedaPrincipal } = await import("@/configuracion/empresa/queries");
    const moneda = await obtenerMonedaPrincipal(ctx.instanciaId);
    const impuestoPct = parsed.data.impuesto ?? 18;

    // 015-herramientas-operativas-inventario-envios-acciones — default false
    // preserva la creación directa actual (FR-016/SC-003).
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
    const total = subtotal + impuestoMonto;

    const count = await prisma.cotizacion.count({ where: { instanciaId: ctx.instanciaId } });
    const numero = String(count + 1).padStart(5, "0");

    const cotizacion = await prisma.cotizacion.create({
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
      },
    });

    return {
      ok: true,
      data: {
        cotizacionId: cotizacion.id,
        numero: cotizacion.numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        moneda,
        lineas: lineasConCalculo.length,
        generadoPorIA: true,
        pendienteConfirmacion: modoBorrador,
        mensaje: modoBorrador
          ? `Cotización #${numero} preparada por S/ ${total.toFixed(2)} — queda sujeta a confirmación antes de enviarse.`
          : `Cotización #${numero} creada exitosamente por S/ ${total.toFixed(2)}.`,
      },
    };
  },
};

registroHerramientas.register(CrearCotizacionTool);

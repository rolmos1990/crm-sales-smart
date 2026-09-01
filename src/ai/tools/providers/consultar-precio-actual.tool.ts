import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ productoId: z.string().min(1) });

const ConsultarPrecioActualTool: IProveedorTool = {
  name: "consultar_precio_actual",
  definition: {
    name: "consultar_precio_actual",
    description: "Consulta el precio vigente de un producto en el catálogo. Usar siempre antes de mencionar un precio al cliente.",
    input_schema: {
      type: "object",
      properties: { productoId: { type: "string", description: "ID del producto" } },
      required: ["productoId"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para consultar_precio_actual" };

    const { prisma } = await import("@/shared/db/prisma");
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.data.productoId, instanciaId: ctx.instanciaId },
      select: { precio: true, moneda: true },
    });

    if (!producto) return { ok: false, error: "Producto no encontrado" };

    return { ok: true, data: { precio: Number(producto.precio), moneda: producto.moneda } };
  },
};

registroHerramientas.register(ConsultarPrecioActualTool);

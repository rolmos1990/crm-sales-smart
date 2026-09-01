import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// research.md Decisión 4 de 015: Karia no tiene hoy ningún modelo de
// promociones — esta tool es honesta (existe, se puede invocar) pero
// siempre devuelve "sin promociones" hasta que exista una fuente real.
// No inventa descuentos ni vigencias.
const ArgsSchema = z.object({ productoId: z.string().min(1) });

const ConsultarPromocionesTool: IProveedorTool = {
  name: "consultar_promociones",
  definition: {
    name: "consultar_promociones",
    description: "Consulta si un producto tiene alguna promoción activa. Usar antes de mencionar un descuento.",
    input_schema: {
      type: "object",
      properties: { productoId: { type: "string", description: "ID del producto" } },
      required: ["productoId"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para consultar_promociones" };

    const { prisma } = await import("@/shared/db/prisma");
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.data.productoId, instanciaId: ctx.instanciaId },
      select: { id: true },
    });
    if (!producto) return { ok: false, error: "Producto no encontrado" };

    return { ok: true, data: { tienePromocion: false, mensaje: "Sin promociones configuradas" } };
  },
};

registroHerramientas.register(ConsultarPromocionesTool);

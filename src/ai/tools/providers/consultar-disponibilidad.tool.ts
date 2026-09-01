import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ productoId: z.string().min(1) });

const ConsultarDisponibilidadTool: IProveedorTool = {
  name: "consultar_disponibilidad",
  definition: {
    name: "consultar_disponibilidad",
    description:
      "Consulta si un producto tiene stock disponible y la cantidad exacta. Usar siempre antes de afirmar que un producto está disponible.",
    input_schema: {
      type: "object",
      properties: { productoId: { type: "string", description: "ID del producto" } },
      required: ["productoId"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para consultar_disponibilidad" };

    const { prisma } = await import("@/shared/db/prisma");
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.data.productoId, instanciaId: ctx.instanciaId },
      select: { manejaStock: true, cantidadDisponible: true },
    });

    if (!producto) return { ok: false, error: "Producto no encontrado" };

    if (!producto.manejaStock) {
      return { ok: true, data: { disponible: true, cantidadDisponible: null, manejaStock: false } };
    }

    const cantidad = Number(producto.cantidadDisponible);
    return {
      ok: true,
      data: { disponible: cantidad > 0, cantidadDisponible: cantidad, manejaStock: true },
    };
  },
};

registroHerramientas.register(ConsultarDisponibilidadTool);

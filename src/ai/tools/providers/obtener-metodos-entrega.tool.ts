import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ObtenerMetodosEntregaTool: IProveedorTool = {
  name: "obtener_metodos_entrega",
  definition: {
    name: "obtener_metodos_entrega",
    description: "Obtiene los métodos de entrega configurados por el negocio, con su costo base y tiempo estimado.",
    input_schema: { type: "object", properties: {} },
  },

  async execute(_args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const { prisma } = await import("@/shared/db/prisma");
    const metodos = await prisma.metodoEntregaConfig.findMany({
      where: { instanciaId: ctx.instanciaId, activo: true },
      select: { metodoEntrega: true, costoBase: true, diasEstimadosMin: true, diasEstimadosMax: true },
    });

    if (metodos.length === 0) {
      return { ok: true, data: { metodos: [], mensaje: "Sin métodos de entrega configurados" } };
    }

    return {
      ok: true,
      data: {
        metodos: metodos.map((m) => ({
          metodoEntrega: m.metodoEntrega,
          costoBase: Number(m.costoBase),
          diasEstimadosMin: m.diasEstimadosMin,
          diasEstimadosMax: m.diasEstimadosMax,
        })),
      },
    };
  },
};

registroHerramientas.register(ObtenerMetodosEntregaTool);

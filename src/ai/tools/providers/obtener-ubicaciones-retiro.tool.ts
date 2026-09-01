import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ObtenerUbicacionesRetiroTool: IProveedorTool = {
  name: "obtener_ubicaciones_retiro",
  definition: {
    name: "obtener_ubicaciones_retiro",
    description: "Obtiene las ubicaciones de retiro en tienda activas del negocio.",
    input_schema: { type: "object", properties: {} },
  },

  async execute(_args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const { prisma } = await import("@/shared/db/prisma");
    const ubicaciones = await prisma.ubicacionRetiro.findMany({
      where: { instanciaId: ctx.instanciaId, activo: true },
      select: { nombre: true, direccion: true },
    });

    if (ubicaciones.length === 0) {
      return { ok: true, data: { ubicaciones: [], mensaje: "Sin ubicaciones de retiro configuradas" } };
    }

    return { ok: true, data: { ubicaciones } };
  },
};

registroHerramientas.register(ObtenerUbicacionesRetiroTool);

import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ metodoEntrega: z.string().min(1), zona: z.string().optional() });

const EstimarFechaEntregaTool: IProveedorTool = {
  name: "estimar_fecha_entrega",
  definition: {
    name: "estimar_fecha_entrega",
    description: "Estima el rango de días de entrega para un método (y opcionalmente una zona), según la configuración real.",
    input_schema: {
      type: "object",
      properties: {
        metodoEntrega: { type: "string" },
        zona: { type: "string", description: "Opcional — si se conoce, ajusta el estimado" },
      },
      required: ["metodoEntrega"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para estimar_fecha_entrega" };

    const { prisma } = await import("@/shared/db/prisma");
    const metodo = await prisma.metodoEntregaConfig.findFirst({
      where: { instanciaId: ctx.instanciaId, metodoEntrega: parsed.data.metodoEntrega as never, activo: true },
    });
    if (!metodo || metodo.diasEstimadosMin === null || metodo.diasEstimadosMax === null) {
      return { ok: true, data: { mensaje: "Sin tiempo estimado configurado para este método" } };
    }

    let diasAdicionales = 0;
    if (parsed.data.zona) {
      const zonaMetodo = await prisma.zonaCoberturaMetodo.findFirst({
        where: { metodoEntregaConfigId: metodo.id, zonaCobertura: { instanciaId: ctx.instanciaId, nombre: parsed.data.zona } },
      });
      diasAdicionales = zonaMetodo?.diasAdicionales ?? 0;
    }

    return {
      ok: true,
      data: { diasMin: metodo.diasEstimadosMin + diasAdicionales, diasMax: metodo.diasEstimadosMax + diasAdicionales },
    };
  },
};

registroHerramientas.register(EstimarFechaEntregaTool);

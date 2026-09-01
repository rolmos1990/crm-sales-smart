import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ metodoEntrega: z.string().min(1), zona: z.string().min(1) });

const CalcularCostoEnvioTool: IProveedorTool = {
  name: "calcular_costo_envio",
  definition: {
    name: "calcular_costo_envio",
    description: "Calcula el costo de envío real para una zona y método de entrega, según la configuración del negocio.",
    input_schema: {
      type: "object",
      properties: {
        metodoEntrega: { type: "string", description: "Método de entrega (ej. COURIER_EXTERNO)" },
        zona: { type: "string", description: "Nombre de la zona (ej. 'Lima Metropolitana')" },
      },
      required: ["metodoEntrega", "zona"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para calcular_costo_envio" };

    const { prisma } = await import("@/shared/db/prisma");
    const metodo = await prisma.metodoEntregaConfig.findFirst({
      where: { instanciaId: ctx.instanciaId, metodoEntrega: parsed.data.metodoEntrega as never, activo: true },
    });
    if (!metodo) {
      return { ok: true, data: { cubierto: false, mensaje: "Método de entrega no configurado" } };
    }

    const zonaMetodo = await prisma.zonaCoberturaMetodo.findFirst({
      where: {
        metodoEntregaConfigId: metodo.id,
        zonaCobertura: { instanciaId: ctx.instanciaId, nombre: parsed.data.zona },
      },
    });

    if (!zonaMetodo || !zonaMetodo.cubierta) {
      return { ok: true, data: { cubierto: false, mensaje: "Sin cobertura configurada para esa zona y método" } };
    }

    const costo = Number(metodo.costoBase) + Number(zonaMetodo.costoAdicional);
    return { ok: true, data: { costo, cubierto: true } };
  },
};

registroHerramientas.register(CalcularCostoEnvioTool);

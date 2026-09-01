import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ zona: z.string().min(1), metodoEntrega: z.string().optional() });

const ValidarCoberturaTool: IProveedorTool = {
  name: "validar_cobertura",
  definition: {
    name: "validar_cobertura",
    description: "Valida si una zona tiene cobertura de entrega, y con qué métodos.",
    input_schema: {
      type: "object",
      properties: {
        zona: { type: "string" },
        metodoEntrega: { type: "string", description: "Opcional — restringe la validación a un método puntual" },
      },
      required: ["zona"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para validar_cobertura" };

    const { prisma } = await import("@/shared/db/prisma");
    const zonaMetodos = await prisma.zonaCoberturaMetodo.findMany({
      where: {
        cubierta: true,
        zonaCobertura: { instanciaId: ctx.instanciaId, nombre: parsed.data.zona },
        ...(parsed.data.metodoEntrega ? { metodoEntregaConfig: { metodoEntrega: parsed.data.metodoEntrega as never } } : {}),
      },
      select: { metodoEntregaConfig: { select: { metodoEntrega: true } } },
    });

    const metodosQueCubren = zonaMetodos.map((zm) => zm.metodoEntregaConfig.metodoEntrega);
    return { ok: true, data: { cubierta: metodosQueCubren.length > 0, metodosQueCubren } };
  },
};

registroHerramientas.register(ValidarCoberturaTool);

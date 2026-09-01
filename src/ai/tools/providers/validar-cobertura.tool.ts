import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import { resolverCostoEnvio } from "@/shared/entregas/resolver-costo-envio";
import { transferirAHumanoInterno } from "@/ai/tools/shared/transferir-a-humano-interno";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// 019-cobertura-geografica-envios — mismo motor de resolución que
// calcular_costo_envio (contracts/ai-tools.md).
const ArgsSchema = z.object({
  estadoProvincia: z.string().min(1),
  pais: z.string().optional(),
  ciudad: z.string().optional(),
  metodoEntrega: z.string().optional(),
  transportistaId: z.string().optional(),
});

const ValidarCoberturaTool: IProveedorTool = {
  name: "validar_cobertura",
  definition: {
    name: "validar_cobertura",
    description:
      "Valida si una ubicación (país/estado/ciudad) tiene cobertura de entrega, y con qué métodos. Si no hay una coincidencia clara, transfiere la conversación a un humano automáticamente.",
    input_schema: {
      type: "object",
      properties: {
        estadoProvincia: { type: "string", description: "Nombre del estado/provincia de destino" },
        pais: { type: "string", description: "Nombre del país — opcional si el negocio opera en un solo país" },
        ciudad: { type: "string", description: "Opcional — refina la coincidencia" },
        metodoEntrega: { type: "string", description: "Opcional — restringe la validación a un método puntual" },
        transportistaId: { type: "string", description: "Opcional — restringe la validación a un transportista puntual" },
      },
      required: ["estadoProvincia"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para validar_cobertura" };

    const resolucion = await resolverCostoEnvio({ instanciaId: ctx.instanciaId, ...parsed.data });

    if (resolucion.estado === "SIN_COINCIDENCIA_CLARA") {
      await transferirAHumanoInterno(ctx, `Sin coincidencia clara de cobertura: ${resolucion.motivo}`);
      return {
        ok: true,
        data: {
          transferidoAHumano: true,
          mensaje:
            "No fue posible determinar con claridad si hay cobertura para esa ubicación. La conversación fue transferida a un asesor — no confirmes ni descartes cobertura al cliente.",
        },
      };
    }

    if (!resolucion.cubierto) {
      return { ok: true, data: { cubierta: false, mensaje: resolucion.motivo } };
    }

    return { ok: true, data: { cubierta: true, metodosQueCubren: resolucion.metodosQueCubren } };
  },
};

registroHerramientas.register(ValidarCoberturaTool);

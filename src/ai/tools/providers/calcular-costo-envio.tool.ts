import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import { resolverCostoEnvio } from "@/shared/entregas/resolver-costo-envio";
import { transferirAHumanoInterno } from "@/ai/tools/shared/transferir-a-humano-interno";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// 019-cobertura-geografica-envios — reemplaza el match por nombre de zona
// en texto libre por la resolución real (transportista país/estado +
// delivery zona aproximada) y fuerza la escalación a humano ante cualquier
// resultado ambiguo (contracts/ai-tools.md, research.md Decisión 4/5).
const ArgsSchema = z.object({
  estadoProvincia: z.string().min(1),
  pais: z.string().optional(),
  ciudad: z.string().optional(),
  metodoEntrega: z.string().optional(),
  transportistaId: z.string().optional(),
});

const CalcularCostoEnvioTool: IProveedorTool = {
  name: "calcular_costo_envio",
  definition: {
    name: "calcular_costo_envio",
    description:
      "Calcula el costo de envío real para una ubicación (país/estado/ciudad) y método/transportista opcionales, según la configuración real del negocio. Si no hay una coincidencia clara, transfiere la conversación a un humano automáticamente.",
    input_schema: {
      type: "object",
      properties: {
        estadoProvincia: { type: "string", description: "Nombre del estado/provincia de destino (ej. 'Lima')" },
        pais: { type: "string", description: "Nombre del país — opcional si el negocio opera en un solo país" },
        ciudad: { type: "string", description: "Opcional — refina la coincidencia" },
        metodoEntrega: { type: "string", description: "Opcional — restringe el cálculo a un método puntual" },
        transportistaId: { type: "string", description: "Opcional — restringe el cálculo a un transportista puntual" },
      },
      required: ["estadoProvincia"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para calcular_costo_envio" };

    const resolucion = await resolverCostoEnvio({ instanciaId: ctx.instanciaId, ...parsed.data });

    if (resolucion.estado === "SIN_COINCIDENCIA_CLARA") {
      await transferirAHumanoInterno(ctx, `Sin coincidencia clara de costo de envío: ${resolucion.motivo}`);
      return {
        ok: true,
        data: {
          transferidoAHumano: true,
          mensaje:
            "No fue posible determinar un costo de envío exacto para esa ubicación. La conversación fue transferida a un asesor — no informes ningún costo estimado al cliente.",
        },
      };
    }

    if (!resolucion.cubierto) {
      return { ok: true, data: { cubierto: false, mensaje: resolucion.motivo } };
    }

    return { ok: true, data: { cubierto: true, costo: resolucion.costo } };
  },
};

registroHerramientas.register(CalcularCostoEnvioTool);

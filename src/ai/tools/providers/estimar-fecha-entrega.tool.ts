import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import { resolverCostoEnvio } from "@/shared/entregas/resolver-costo-envio";
import { transferirAHumanoInterno } from "@/ai/tools/shared/transferir-a-humano-interno";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// 019-cobertura-geografica-envios — mismo motor de resolución que
// calcular_costo_envio/validar_cobertura (contracts/ai-tools.md). Solo
// estadoProvincia es obligatorio (antes era metodoEntrega) — el motor
// resuelve el/los método(s) que cubren esa ubicación.
const ArgsSchema = z.object({
  estadoProvincia: z.string().min(1),
  pais: z.string().optional(),
  ciudad: z.string().optional(),
  metodoEntrega: z.string().optional(),
  transportistaId: z.string().optional(),
});

const EstimarFechaEntregaTool: IProveedorTool = {
  name: "estimar_fecha_entrega",
  definition: {
    name: "estimar_fecha_entrega",
    description:
      "Estima el rango de días de entrega para una ubicación (y opcionalmente un método/transportista puntual), según la configuración real. Si no hay una coincidencia clara, transfiere la conversación a un humano automáticamente.",
    input_schema: {
      type: "object",
      properties: {
        estadoProvincia: { type: "string", description: "Nombre del estado/provincia de destino" },
        pais: { type: "string", description: "Nombre del país — opcional si el negocio opera en un solo país" },
        ciudad: { type: "string", description: "Opcional — refina la coincidencia" },
        metodoEntrega: { type: "string", description: "Opcional — restringe el estimado a un método puntual" },
        transportistaId: { type: "string", description: "Opcional — restringe el estimado a un transportista puntual" },
      },
      required: ["estadoProvincia"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para estimar_fecha_entrega" };

    const resolucion = await resolverCostoEnvio({ instanciaId: ctx.instanciaId, ...parsed.data });

    if (resolucion.estado === "SIN_COINCIDENCIA_CLARA") {
      await transferirAHumanoInterno(ctx, `Sin coincidencia clara para estimar fecha de entrega: ${resolucion.motivo}`);
      return {
        ok: true,
        data: {
          transferidoAHumano: true,
          mensaje:
            "No fue posible determinar una fecha estimada de entrega clara para esa ubicación. La conversación fue transferida a un asesor — no informes ninguna fecha estimada al cliente.",
        },
      };
    }

    if (!resolucion.cubierto) {
      return { ok: true, data: { mensaje: resolucion.motivo } };
    }

    if (resolucion.diasMin === null || resolucion.diasMax === null) {
      return { ok: true, data: { mensaje: "Sin tiempo estimado configurado para esta ubicación" } };
    }

    return { ok: true, data: { diasMin: resolucion.diasMin, diasMax: resolucion.diasMax } };
  },
};

registroHerramientas.register(EstimarFechaEntregaTool);

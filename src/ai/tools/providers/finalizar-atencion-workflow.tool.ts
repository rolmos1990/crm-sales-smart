import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// Solo disponible cuando la IA atiende dentro de un nodo "Atención IA" de un
// Workflow (responderConAgente la agrega vía `herramientasExtra`). No escribe
// nada: su efecto es que el Workflow siga por la salida "Objetivo cumplido"
// o "No resuelto" (src/workflows/motor/nodos/atencion-ia.ts).
export const NOMBRE_FINALIZAR_ATENCION_WORKFLOW = "finalizar_atencion_workflow";

const ArgsSchema = z.object({
  resultado: z.enum(["COMPLETADO", "NO_RESUELTO"]),
  resumen: z.string().max(1000).optional(),
});

const FinalizarAtencionWorkflowTool: IProveedorTool = {
  name: NOMBRE_FINALIZAR_ATENCION_WORKFLOW,
  definition: {
    name: NOMBRE_FINALIZAR_ATENCION_WORKFLOW,
    description:
      "Termina tu atención en esta conversación y devuelve el control al flujo automatizado. Úsala cuando cumpliste el objetivo indicado (resultado COMPLETADO) o cuando no es posible cumplirlo (NO_RESUELTO). Después de usarla, despídete brevemente si corresponde.",
    input_schema: {
      type: "object",
      properties: {
        resultado: { type: "string", enum: ["COMPLETADO", "NO_RESUELTO"], description: "Si el objetivo se cumplió o no" },
        resumen: { type: "string", description: "Resumen breve de lo conversado y lo obtenido" },
      },
      required: ["resultado"],
    },
  },

  async execute(args: unknown, _ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para finalizar_atencion_workflow" };
    return { ok: true, data: { resultado: parsed.data.resultado, resumen: parsed.data.resumen ?? null } };
  },
};

registroHerramientas.register(FinalizarAtencionWorkflowTool);

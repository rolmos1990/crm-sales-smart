import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import { transferirAHumanoInterno } from "@/ai/tools/shared/transferir-a-humano-interno";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({
  motivo: z.string().min(1),
  prioridad: z.enum(["ALTA", "MEDIA", "BAJA"]).optional(),
});

const TransferirAHumanoTool: IProveedorTool = {
  name: "transferir_a_humano",
  definition: {
    name: "transferir_a_humano",
    description:
      "Transfiere la conversación a un agente humano. Usar si el cliente lo solicita explícitamente o si no puedes resolver su consulta.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo de la transferencia" },
        prioridad: {
          type: "string",
          enum: ["ALTA", "MEDIA", "BAJA"],
          description: "Prioridad de atención (default: MEDIA)",
        },
      },
      required: ["motivo"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para transferir_a_humano" };

    // 018-simulador-agente — no actualiza Conversacion.clasificacion ni
    // publica el evento de dominio en modo simulación (FR-006/FR-007).
    if (ctx.modoSimulacion) {
      return {
        ok: true,
        data: {
          mensaje: "[Simulación] Transferencia habría iniciado — no se modificó ninguna conversación real.",
          motivo: parsed.data.motivo,
          prioridad: parsed.data.prioridad ?? "MEDIA",
          previsualizado: true,
        },
      };
    }

    // 019-cobertura-geografica-envios — el efecto secundario (marcar
    // SOPORTE + publicar ConversacionClasificada) vive en un helper
    // compartido, reutilizado por las tools de envío para forzar la
    // escalación de forma determinista (research.md Decisión 4).
    await transferirAHumanoInterno(ctx, parsed.data.motivo);

    return {
      ok: true,
      data: {
        mensaje: "Transferencia iniciada. Un agente humano tomará la conversación pronto.",
        motivo: parsed.data.motivo,
        prioridad: parsed.data.prioridad ?? "MEDIA",
      },
    };
  },
};

registroHerramientas.register(TransferirAHumanoTool);

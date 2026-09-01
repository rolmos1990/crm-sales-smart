import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
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

    const { prisma } = await import("@/shared/db/prisma");

    // Marcar la conversación como soporte para que el equipo humano la tome
    await prisma.conversacion.updateMany({
      where: { id: ctx.conversacionId, instanciaId: ctx.instanciaId },
      data: { clasificacion: "SOPORTE", clasificadoEn: new Date() },
    });

    // 012-perfil-dinamico-cliente — permite invalidar el perfil del cliente
    // (incidencia activa) sin sondeo. Agregado, no reemplaza la escritura de
    // arriba; un fallo al publicar no debe impedir la transferencia misma.
    try {
      const { publicadorEventos } = await import("@/shared/rabbitmq");
      const { EventosSistema } = await import("@/eventos/catalogo");
      await publicadorEventos.publicar(EventosSistema.ConversacionClasificada, ctx.instanciaId, {
        instanciaId: ctx.instanciaId,
        conversacionId: ctx.conversacionId,
        contactoId: ctx.contactoId ?? null,
        clasificacion: "SOPORTE",
        clasificadoEn: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[TransferirAHumanoTool] Error al publicar ConversacionClasificada:", err);
    }

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

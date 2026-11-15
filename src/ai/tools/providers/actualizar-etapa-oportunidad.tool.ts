import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { registroHerramientas } from "@/ai/tools/registry";
import { moverOportunidadAEtapa } from "@/crm/pipeline/mover-stage";
import { normalizarTexto } from "@/shared/lib/normalizar-texto";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({
  etapa: z.string().min(1).max(100),
  motivo: z.string().max(300).optional(),
});

/**
 * El modelo elige la etapa por su nombre, que es lo que el negocio escribe en
 * sus reglas ("→ Cliente potencial"). La resolución a `stageId` se hace acá,
 * contra el pipeline real de ESA oportunidad: así una regla escrita con otra
 * capitalización o sin tildes sigue funcionando, y un nombre inventado falla
 * con la lista de los válidos en vez de mover algo al azar.
 */
async function resolverStage(oportunidadId: string, instanciaId: string, etapaPedida: string) {
  const oportunidad = await prisma.oportunidad.findFirst({
    where: { id: oportunidadId, instanciaId },
    select: { id: true, pipelineId: true, stageId: true },
  });
  if (!oportunidad) return { error: "La oportunidad no existe en esta instancia." as const };
  if (!oportunidad.pipelineId) {
    return { error: "La oportunidad no está en ningún pipeline, no se puede mover de etapa." as const };
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: oportunidad.pipelineId, activo: true },
    select: { id: true, nombre: true },
    orderBy: { orden: "asc" },
  });

  const buscada = normalizarTexto(etapaPedida);
  const encontrado = stages.find((s) => normalizarTexto(s.nombre) === buscada);
  if (!encontrado) {
    return {
      error:
        `No existe una etapa llamada "${etapaPedida}". Las etapas disponibles son: ` +
        `${stages.map((s) => s.nombre).join(", ")}.`,
      etapasDisponibles: stages.map((s) => s.nombre),
    };
  }

  return { oportunidad, stage: encontrado, etapasDisponibles: stages.map((s) => s.nombre) };
}

const ActualizarEtapaOportunidadTool: IProveedorTool = {
  name: "actualizar_etapa_oportunidad",
  definition: {
    name: "actualizar_etapa_oportunidad",
    description:
      "Mueve la oportunidad del cliente a otra etapa del ciclo de vida (el pipeline de ventas). " +
      "Usala cuando la conversación cumpla alguna de las reglas de ciclo de vida de tus instrucciones — " +
      "por ejemplo cuando el cliente confirma un pago o cuando se despide dando el tema por resuelto. " +
      "El nombre de la etapa tiene que ser uno de los configurados en el negocio: si te equivocás, " +
      "la herramienta te devuelve la lista de los válidos. Mover la etapa dispara las automatizaciones " +
      "del negocio, así que no la llames si no se cumple ninguna regla.",
    input_schema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          description: "Nombre exacto de la etapa destino, tal como lo configuró el negocio",
        },
        motivo: {
          type: "string",
          description: "Por qué se mueve, en una frase. Queda registrado en el historial de la oportunidad.",
        },
      },
      required: ["etapa"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: "Argumentos inválidos para actualizar_etapa_oportunidad" };
    }

    if (!ctx.oportunidadId) {
      return {
        ok: false,
        error: "Esta conversación no tiene una oportunidad asociada, no hay nada que mover.",
      };
    }

    const resuelto = await resolverStage(ctx.oportunidadId, ctx.instanciaId, parsed.data.etapa);
    if ("error" in resuelto) return { ok: false, error: resuelto.error };

    const { oportunidad, stage } = resuelto;

    if (oportunidad.stageId === stage.id) {
      return {
        ok: true,
        data: { mensaje: `La oportunidad ya estaba en "${stage.nombre}". No se movió nada.`, etapa: stage.nombre },
      };
    }

    // 018-simulador-agente — en simulación se resuelve la etapa igual (para
    // que el nombre inventado también falle acá) pero no se mueve nada: mover
    // dispara disparadores, workflows y el evento de dominio.
    if (ctx.modoSimulacion) {
      return {
        ok: true,
        data: {
          mensaje: `[Simulación] La oportunidad se habría movido a "${stage.nombre}" — no se movió ninguna oportunidad real.`,
          etapa: stage.nombre,
          previsualizado: true,
        },
      };
    }

    // Único camino para cambiar de etapa (ver mover-stage.ts): valida campos
    // requeridos, escribe el historial, cierra conversaciones en etapas
    // terminales, encola los disparadores de la etapa nueva y publica
    // OportunidadMovidaDeEtapa, que arranca el Workflow asignado. Es decir:
    // exactamente lo mismo que arrastrar la tarjeta en el Kanban.
    const resultado = await moverOportunidadAEtapa({
      oportunidadId: oportunidad.id,
      stageId: stage.id,
      pipelineId: oportunidad.pipelineId!,
      instanciaId: ctx.instanciaId,
      origen: { tipo: "IA" },
      motivo: parsed.data.motivo,
    });

    // El error de `moverOportunidadAEtapa` se propaga tal cual: el de campos
    // personalizados requeridos dice qué falta, y es información que el
    // agente puede pedirle al cliente.
    if (!resultado.exito) return { ok: false, error: resultado.error };

    return {
      ok: true,
      data: {
        mensaje: `Oportunidad movida a la etapa "${stage.nombre}".`,
        etapa: stage.nombre,
      },
    };
  },
};

registroHerramientas.register(ActualizarEtapaOportunidadTool);

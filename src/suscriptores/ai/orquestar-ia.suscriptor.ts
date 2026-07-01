import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import { publicadorEventos } from "@/shared/rabbitmq/publicador";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { MensajeRecibidoPayload } from "@/eventos/contratos/mensaje-recibido.event";

// Escucha MensajeRecibido y decide si corresponde generar respuesta IA.
// Reemplaza verificarAutoRespuestaIA() que vivía inline en ProcesarEntranteSuscriptor.
export class OrquestarIASuscriptor extends ConsumidorBase<MensajeRecibidoPayload> {
  readonly queue = QUEUES.AI_ORQUESTAR;
  readonly routingKeys = [RK.EVENTO_MENSAJE_RECIBIDO];

  async manejar(envelope: EventoEnvelope<MensajeRecibidoPayload>): Promise<void> {
    const { instanciaId, conversacionId, oportunidadId } = envelope.payload;

    const { prisma } = await import("@/shared/db/prisma");

    // Verificación paralela: configuración global IA + datos de conversación + stage de oportunidad
    const [configIA, conv, opConStage] = await Promise.all([
      prisma.configuracionIA.findUnique({
        where: { instanciaId },
        select: { habilitado: true, limiteTokensDiarios: true },
      }),
      prisma.conversacion.findUnique({
        where: { id: conversacionId },
        select: {
          cuentaCanal: { select: { canal: true } },
          oportunidades: {
            select: {
              oportunidad: {
                select: {
                  stage: {
                    select: {
                      respuestaIAHabilitada: true,
                      agenteIAConfigId: true,
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      }),
      // Cuando el payload ya trae oportunidadId, usar esa oportunidad directamente
      // evita depender del orden indeterminado de conv.oportunidades[0]
      oportunidadId
        ? prisma.oportunidad.findFirst({
            where: { id: oportunidadId, instanciaId },
            select: {
              stage: {
                select: { respuestaIAHabilitada: true, agenteIAConfigId: true },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!configIA?.habilitado) {
      console.log(`[OrquestarIA] IA deshabilitada globalmente — instancia ${instanciaId}`);
      return;
    }

    // Preferir el stage de la oportunidad del payload; fallback al de la conversación
    const stage =
      opConStage?.stage ?? conv?.oportunidades[0]?.oportunidad?.stage ?? null;

    if (!stage?.respuestaIAHabilitada) {
      console.log(
        `[OrquestarIA] Stage sin respuestaIAHabilitada — conversacion ${conversacionId}, oportunidadId ${oportunidadId ?? "sin oportunidad en payload"}, stage: ${JSON.stringify(stage)}`,
      );
      return;
    }

    // Verificar límite diario de tokens si está configurado
    if (configIA.limiteTokensDiarios) {
      const { obtenerTokensUsadosHoy } = await import("@/ai/queries");
      const tokensHoy = await obtenerTokensUsadosHoy(instanciaId);
      if (tokensHoy >= configIA.limiteTokensDiarios) {
        console.warn(
          `[OrquestarIA] Límite diario alcanzado para instancia ${instanciaId}: ${tokensHoy}/${configIA.limiteTokensDiarios}`,
        );
        return;
      }
    }

    // Verificar restricción de canal si el agente lo limita
    const agenteIAConfigId = stage.agenteIAConfigId ?? undefined;
    if (agenteIAConfigId) {
      const agente = await prisma.agenteIAConfig.findUnique({
        where: { id: agenteIAConfigId },
        select: { canalesPermitidos: true, instanciaId: true },
      });

      // Protección multi-tenant: nunca usar un agente de otra instancia
      if (agente && agente.instanciaId !== instanciaId) {
        console.error(
          `[OrquestarIA] Agente ${agenteIAConfigId} pertenece a instancia ${agente.instanciaId}, no ${instanciaId}`,
        );
        return;
      }

      if (agente?.canalesPermitidos) {
        const canal = conv?.cuentaCanal?.canal;
        const canales = parsearCanales(agente.canalesPermitidos);
        if (canales.length > 0 && canal && !canales.includes(canal)) {
          console.log(
            `[OrquestarIA] Canal "${canal}" no permitido para agente ${agenteIAConfigId} — permitidos: [${canales.join(", ")}]`,
          );
          return;
        }
      }
    }

    console.log(
      `[OrquestarIA] Publicando GENERAR_RESPUESTA_IA — conversacion ${conversacionId}, agente ${agenteIAConfigId ?? "default COMERCIAL"}`,
    );

    void publicadorEventos.publicar("GENERAR_RESPUESTA_IA", instanciaId, {
      conversacionId,
      instanciaId,
      agenteIAConfigId,
    });
  }
}

function parsearCanales(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((c): c is string => typeof c === "string");
  if (typeof valor === "object" && valor !== null) {
    const obj = valor as Record<string, unknown>;
    const lista = obj["canales"] ?? obj["lista"];
    if (Array.isArray(lista)) return lista.filter((c): c is string => typeof c === "string");
  }
  return [];
}

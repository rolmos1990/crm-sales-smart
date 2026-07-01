import "@/ai/tools/inicializar"; // registra todos los providers de herramientas

import { ConsumidorBase } from "@/shared/rabbitmq/consumidor";
import { QUEUES, RK } from "@/shared/rabbitmq/exchanges";
import type { EventoEnvelope } from "@/shared/rabbitmq/tipos";
import type { ComandoGenerarRespuestaIAPayload } from "@/eventos/contratos/generar-respuesta-ia.comando";
import type { MensajeIATool, ContenidoToolResult } from "@/ai/proveedores/types";

const MAX_ITERACIONES_TOOL = 5;

export class GenerarRespuestaIASuscriptor extends ConsumidorBase<ComandoGenerarRespuestaIAPayload> {
  readonly queue = QUEUES.AI_RESPUESTA;
  readonly routingKeys = [RK.COMANDO_AI_GENERAR_RESPUESTA];

  async manejar(envelope: EventoEnvelope<ComandoGenerarRespuestaIAPayload>): Promise<void> {
    const { conversacionId, instanciaId, agenteIAConfigId } = envelope.payload;

    const { generarRespuesta, generarConHerramientas } = await import("@/ai/gateway/gateway");
    const { construirContexto, serializarContextoComoMensajes } = await import(
      "@/ai/contexto/constructor"
    );
    const { prisma } = await import("@/shared/db/prisma");
    const { enviarMensaje } = await import("@/conversaciones/actions");

    const conversacion = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { contactoId: true, instanciaId: true, oportunidades: { select: { oportunidadId: true }, take: 1 } },
    });

    if (!conversacion || conversacion.instanciaId !== instanciaId) {
      console.warn(`[GenerarRespuestaIA] Conversación ${conversacionId} no encontrada o instancia incorrecta`);
      return;
    }

    const oportunidadId = conversacion.oportunidades[0]?.oportunidadId;

    // Resolver agenteIAConfig — del payload o el default COMERCIAL de la instancia
    const agenteId =
      agenteIAConfigId ??
      (
        await prisma.agenteIAConfig.findFirst({
          where: { instanciaId, tipo: "COMERCIAL" },
          select: { id: true },
        })
      )?.id;

    const contexto = await construirContexto({
      instanciaId,
      conversacionId,
      contactoId: conversacion.contactoId,
      oportunidadId,
      agenteIAConfigId: agenteId,
    });

    const mensajesBase = serializarContextoComoMensajes(contexto);

    if (!mensajesBase.some((m) => m.rol === "system")) {
      mensajesBase.unshift({
        rol: "system",
        contenido:
          "Eres un asistente de atención al cliente profesional y amigable. Responde siempre en el mismo idioma que el cliente. Sé conciso y útil.",
      });
    }

    // Verificar si el agente tiene herramientas habilitadas
    const herramientasPermitidas = agenteId
      ? await obtenerHerramientasPermitidas(agenteId)
      : [];

    let contenidoFinal: string;

    if (herramientasPermitidas.length > 0) {
      contenidoFinal = await ejecutarConTools({
        instanciaId,
        agenteId,
        conversacionId,
        contactoId: conversacion.contactoId ?? undefined,
        herramientasPermitidas,
        mensajesBase,
        generarConHerramientas,
      });
    } else {
      // Sin herramientas: flujo original
      const respuesta = await generarRespuesta({
        instanciaId,
        agenteIAConfigId: agenteId,
        tarea: "CHAT",
        mensajes: [
          ...mensajesBase,
          {
            rol: "user",
            contenido:
              "Redacta la siguiente respuesta para enviar al cliente. Solo el texto del mensaje, sin explicaciones.",
          },
        ],
        entidadTipo: "conversacion",
        entidadId: conversacionId,
      });
      contenidoFinal = respuesta.contenido;
    }

    const resultado = await enviarMensaje({
      conversacionId,
      contenido: contenidoFinal,
      tipo: "TEXTO",
      esNotaInterna: false,
    });

    if (!resultado.ok) {
      console.error(`[GenerarRespuestaIA] Error enviando respuesta: ${resultado.error}`);
    } else {
      console.log(`[GenerarRespuestaIA] Respuesta enviada → mensajeId: ${resultado.mensaje.id}`);
    }
  }
}

// Extrae la lista de nombres de herramientas habilitadas para el agente
async function obtenerHerramientasPermitidas(agenteId: string): Promise<string[]> {
  const { prisma } = await import("@/shared/db/prisma");
  const config = await prisma.agenteIAConfig.findUnique({
    where: { id: agenteId },
    select: { herramientas: true },
  });
  return parsearListaHerramientas(config?.herramientas);
}

function parsearListaHerramientas(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter((h): h is string => typeof h === "string");
  if (typeof valor === "object" && valor !== null) {
    const obj = valor as Record<string, unknown>;
    const lista = obj["habilitadas"] ?? obj["lista"];
    if (Array.isArray(lista)) return lista.filter((h): h is string => typeof h === "string");
  }
  return [];
}

interface EjecutarConToolsParams {
  instanciaId: string;
  agenteId?: string;
  conversacionId: string;
  contactoId?: string;
  herramientasPermitidas: string[];
  mensajesBase: Array<{ rol: "system" | "user" | "assistant"; contenido: string }>;
  generarConHerramientas: typeof import("@/ai/gateway/gateway")["generarConHerramientas"];
}

async function ejecutarConTools(params: EjecutarConToolsParams): Promise<string> {
  const { registroHerramientas } = await import("@/ai/tools/registry");
  const { ejecutarHerramienta } = await import("@/ai/tools/executor");

  const definiciones = registroHerramientas.obtenerDefiniciones(params.herramientasPermitidas);

  // Convertir mensajesBase (string-only) a MensajeIATool[]
  const mensajes: MensajeIATool[] = params.mensajesBase.map((m) => ({
    rol: m.rol,
    contenido: m.contenido,
  }));

  const toolCtx = {
    instanciaId: params.instanciaId,
    agenteId: params.agenteId,
    conversacionId: params.conversacionId,
    contactoId: params.contactoId,
    herramientasPermitidas: params.herramientasPermitidas,
  };

  for (let i = 0; i < MAX_ITERACIONES_TOOL; i++) {
    const resultado = await params.generarConHerramientas({
      instanciaId: params.instanciaId,
      agenteIAConfigId: params.agenteId,
      tarea: "CHAT",
      mensajes,
      herramientas: definiciones,
      entidadTipo: "conversacion",
      entidadId: params.conversacionId,
    });

    if (resultado.tipo === "texto") {
      return resultado.contenido ?? "";
    }

    // Hay tool calls — ejecutarlos y agregar al historial
    const llamadas = resultado.herramientasLlamadas ?? [];

    // Agregar la respuesta del asistente (con tool_use blocks) al historial
    mensajes.push({
      rol: "assistant",
      contenido: resultado.contenidoAsistente ?? [],
    } as MensajeIATool);

    // Ejecutar cada herramienta y recopilar resultados
    const toolResults: ContenidoToolResult[] = await Promise.all(
      llamadas.map(async (llamada) => {
        const res = await ejecutarHerramienta(llamada.name, llamada.input, toolCtx);
        return {
          type: "tool_result" as const,
          tool_use_id: llamada.id,
          content: JSON.stringify(res),
        };
      }),
    );

    // Agregar resultados de tools como mensaje de usuario
    mensajes.push({
      rol: "user",
      contenido: toolResults,
    } as MensajeIATool);
  }

  // Si se agotaron las iteraciones, devolver fallback
  console.warn(`[GenerarRespuestaIA] Máximo de iteraciones de tool calling alcanzado (${MAX_ITERACIONES_TOOL})`);
  return "Lo siento, no pude completar tu solicitud en este momento. ¿Puedo ayudarte con algo más?";
}

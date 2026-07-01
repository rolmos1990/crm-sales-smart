"use server";

import { requireSesion } from "@/shared/auth/sesion";
import { prisma } from "@/shared/db/prisma";
import { generarRespuesta } from "@/ai/gateway/gateway";
import { construirContexto, serializarContextoComoMensajes } from "@/ai/contexto/constructor";

export async function generarSugerenciaIA(
  conversacionId: string,
): Promise<{ ok: true; contenido: string } | { ok: false; error: string }> {
  try {
    const sesion = await requireSesion();

    const conversacion = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: {
        instanciaId: true,
        contactoId: true,
        oportunidades: { select: { oportunidadId: true }, take: 1 },
      },
    });

    if (!conversacion?.instanciaId) {
      return { ok: false, error: "Conversación sin instancia configurada" };
    }

    if (conversacion.instanciaId !== sesion.instanciaId) {
      return { ok: false, error: "Sin acceso a esta conversación" };
    }

    const oportunidadId = conversacion.oportunidades[0]?.oportunidadId;

    // Buscar AgenteIA Comercial configurado para esta instancia (si existe)
    const agenteConfig = await prisma.agenteIAConfig.findFirst({
      where: { instanciaId: sesion.instanciaId, tipo: "COMERCIAL" },
      select: { id: true },
    });

    const contexto = await construirContexto({
      instanciaId: sesion.instanciaId,
      conversacionId,
      contactoId: conversacion.contactoId,
      oportunidadId,
      agenteIAConfigId: agenteConfig?.id,
      maxMensajes: 15,
    });

    const mensajesBase = serializarContextoComoMensajes(contexto);

    // Si no hay system prompt del agente, añadir uno genérico de CRM
    const tieneSystem = mensajesBase.some((m) => m.rol === "system");
    if (!tieneSystem) {
      mensajesBase.unshift({
        rol: "system",
        contenido: "Eres un asistente de atención al cliente profesional y amigable. Responde siempre en el mismo idioma que el cliente. Sé conciso y útil.",
      });
    }

    const respuesta = await generarRespuesta({
      instanciaId: sesion.instanciaId,
      agenteIAConfigId: agenteConfig?.id,
      tarea: "CHAT",
      mensajes: [
        ...mensajesBase,
        {
          rol: "user",
          contenido: "Redacta la siguiente respuesta para enviar al cliente basándote en la conversación anterior. Solo el texto del mensaje, sin explicaciones adicionales.",
        },
      ],
      entidadTipo: "conversacion",
      entidadId: conversacionId,
    });

    return { ok: true, contenido: respuesta.contenido };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error al generar sugerencia";
    if (mensaje.includes("no habilitada")) {
      return { ok: false, error: "IA no habilitada. Configúrala en Ajustes → Inteligencia Artificial." };
    }
    return { ok: false, error: mensaje };
  }
}

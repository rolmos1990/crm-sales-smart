'use server';

import { generarRespuesta } from "@/ai/gateway/gateway";
import { construirContexto, serializarContextoComoMensajes } from "@/ai/contexto/constructor";
import { obtenerResumenUsoIA } from "@/ai/queries";
import type { SolicitudIA, RespuestaIA } from "@/ai/gateway/types";
import type { TareaIA } from "@/generated/prisma/enums";

export async function generarRespuestaIA(solicitud: SolicitudIA): Promise<RespuestaIA> {
  return generarRespuesta(solicitud);
}

interface GenerarRespuestaConContextoParams {
  instanciaId: string;
  agenteIAConfigId?: string;
  tarea?: TareaIA;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
  mensajeUsuario: string;
  temperatura?: number;
}

export async function generarRespuestaConContexto(
  params: GenerarRespuestaConContextoParams,
): Promise<RespuestaIA> {
  const contexto = await construirContexto({
    instanciaId: params.instanciaId,
    conversacionId: params.conversacionId,
    contactoId: params.contactoId,
    oportunidadId: params.oportunidadId,
    agenteIAConfigId: params.agenteIAConfigId,
  });

  const mensajesBase = serializarContextoComoMensajes(contexto);

  return generarRespuesta({
    instanciaId: params.instanciaId,
    agenteIAConfigId: params.agenteIAConfigId,
    tarea: params.tarea ?? "CHAT",
    mensajes: [
      ...mensajesBase,
      { rol: "user", contenido: params.mensajeUsuario },
    ],
    temperatura: params.temperatura,
    entidadTipo: params.conversacionId ? "conversacion" : params.contactoId ? "contacto" : undefined,
    entidadId: params.conversacionId ?? params.contactoId ?? params.oportunidadId,
  });
}

export async function obtenerEstadisticasIA(instanciaId: string) {
  return obtenerResumenUsoIA(instanciaId);
}

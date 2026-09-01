import { prisma } from "@/shared/db/prisma";
import { resolverDecisionContexto } from "./router";
import { construirSystemPrompt } from "@/ai/prompt/builder";
import type { ContextoIA, MensajeContexto } from "./tipos";

interface OpcionesContexto {
  instanciaId: string;
  conversacionId?: string;
  contactoId?: string;
  oportunidadId?: string;
  agenteIAConfigId?: string;
  maxMensajes?: number;
}

export async function construirContexto(opciones: OpcionesContexto): Promise<ContextoIA> {
  const { instanciaId, conversacionId, contactoId, oportunidadId, agenteIAConfigId } = opciones;

  const [conversacionRaw, contacto, oportunidad, agenteConfig] = await Promise.all([
    conversacionId
      ? prisma.conversacion.findUnique({
          where: { id: conversacionId },
          select: {
            id: true,
            cuentaCanal: { select: { canal: true } },
            contacto: { select: { nombre: true } },
            _count: { select: { mensajes: true } },
            // Fetch generous max; ContextRouter trimará en memoria
            mensajes: {
              orderBy: { creadoEn: "desc" },
              take: 30,
              select: { contenido: true, remitente: true, creadoEn: true },
            },
          },
        })
      : null,
    contactoId
      ? prisma.contacto.findUnique({
          where: { id: contactoId },
          select: {
            id: true,
            nombre: true,
            email: true,
            empresa: { select: { nombre: true } },
          },
        })
      : null,
    oportunidadId
      ? prisma.oportunidad.findUnique({
          where: { id: oportunidadId },
          select: { id: true, titulo: true, etapa: true, valor: true },
        })
      : null,
    agenteIAConfigId
      ? prisma.agenteIAConfig.findUnique({
          where: { id: agenteIAConfigId },
          select: {
            sistemaPrompt: true,
            personalidad: true,
            objetivo: true,
            especialidad: true,
            instrucciones: true,
            configuracionTono: true,
            limiteTokensCtx: true,

            // 009-perfil-agente-estructurado-versionado — AgenteIAConfig es
            // siempre la versión PUBLICADA vigente (ver research.md de esa
            // spec), así que leer estos campos acá ya cumple FR-008/FR-012
            // sin necesitar resolver nada adicional.
            nombreAgente: true,
            rol: true,
            idiomaPrincipal: true,
            idiomasPermitidos: true,
            longitudRespuesta: true,
            proactividad: true,
            intensidadComercial: true,
            estiloRecomendacion: true,
            frasesPreferidas: true,
            frasesProhibidas: true,
            comportamientosProhibidos: true,
            reglasPersonalizadas: true,
            condicionesTransferenciaHumano: true,
          },
        })
      : null,
  ]);

  const totalMensajes = conversacionRaw?._count?.mensajes ?? 0;
  const decision = resolverDecisionContexto({
    totalMensajes,
    tieneResumen: false,
    esPrimerMensajeDeContacto: totalMensajes <= 1,
    limiteTokensCtx: agenteConfig?.limiteTokensCtx ?? 4000,
  });

  const contexto: ContextoIA = {};

  if (conversacionRaw) {
    const mensajes: MensajeContexto[] = conversacionRaw.mensajes
      .slice(0, decision.mensajesAIncluir)
      .reverse()
      .filter((m) => m.contenido && m.contenido.trim().length > 0)
      .map((m) => ({
        rol: m.remitente === "CONTACTO" ? "user" : "assistant",
        contenido: m.contenido!,
        creadoEn: m.creadoEn,
      }));

    contexto.conversacion = {
      id: conversacionRaw.id,
      contactoNombre: conversacionRaw.contacto?.nombre,
      canal: conversacionRaw.cuentaCanal?.canal,
      mensajes,
    };
  }

  if (contacto) {
    contexto.contacto = {
      id: contacto.id,
      nombre: contacto.nombre,
      email: contacto.email,
      empresa: contacto.empresa?.nombre,
    };
  }

  if (oportunidad) {
    contexto.oportunidad = {
      id: oportunidad.id,
      titulo: oportunidad.titulo,
      etapa: oportunidad.etapa,
      valor: oportunidad.valor ? Number(oportunidad.valor) : null,
    };
  }

  if (agenteConfig) {
    contexto.sistemaPrompt = construirSystemPrompt(
      {
        objetivo: agenteConfig.objetivo,
        personalidad: agenteConfig.personalidad,
        especialidad: agenteConfig.especialidad,
        instrucciones: agenteConfig.instrucciones,
        sistemaPrompt: agenteConfig.sistemaPrompt,
        configuracionTono: agenteConfig.configuracionTono,
        nombreAgente: agenteConfig.nombreAgente,
        rol: agenteConfig.rol,
        idiomaPrincipal: agenteConfig.idiomaPrincipal,
        idiomasPermitidos: agenteConfig.idiomasPermitidos,
        longitudRespuesta: agenteConfig.longitudRespuesta,
        proactividad: agenteConfig.proactividad,
        intensidadComercial: agenteConfig.intensidadComercial,
        estiloRecomendacion: agenteConfig.estiloRecomendacion,
        frasesPreferidas: agenteConfig.frasesPreferidas,
        frasesProhibidas: agenteConfig.frasesProhibidas,
        comportamientosProhibidos: agenteConfig.comportamientosProhibidos,
        reglasPersonalizadas: agenteConfig.reglasPersonalizadas,
        condicionesTransferenciaHumano: agenteConfig.condicionesTransferenciaHumano,
      },
      {
        nombreContacto: contacto?.nombre,
        empresaContacto: contacto?.empresa?.nombre ?? undefined,
        tituloOportunidad: oportunidad?.titulo,
        etapaOportunidad: oportunidad?.etapa,
      },
    );
  }

  return contexto;
}

export function serializarContextoComoMensajes(
  contexto: ContextoIA,
): Array<{ rol: "system" | "user" | "assistant"; contenido: string }> {
  const mensajes: Array<{ rol: "system" | "user" | "assistant"; contenido: string }> = [];

  if (contexto.sistemaPrompt) {
    mensajes.push({ rol: "system", contenido: contexto.sistemaPrompt });
  }

  if (contexto.conversacion?.mensajes) {
    for (const m of contexto.conversacion.mensajes) {
      mensajes.push({ rol: m.rol, contenido: m.contenido });
    }
  }

  return mensajes;
}

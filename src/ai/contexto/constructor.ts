import { prisma } from "@/shared/db/prisma";
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
  const {
    instanciaId,
    conversacionId,
    contactoId,
    oportunidadId,
    agenteIAConfigId,
    maxMensajes = 20,
  } = opciones;

  const [conversacionData, contacto, oportunidad, agenteConfig] = await Promise.all([
    conversacionId
      ? prisma.conversacion.findUnique({
          where: { id: conversacionId },
          select: {
            id: true,
            cuentaCanal: { select: { canal: true } },
            contacto: { select: { nombre: true } },
            mensajes: {
              orderBy: { creadoEn: "desc" },
              take: maxMensajes,
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
          select: { sistemaPrompt: true },
        })
      : null,
  ]);

  const contexto: ContextoIA = {};

  if (conversacionData) {
    const mensajes: MensajeContexto[] = conversacionData.mensajes
      .reverse()
      .map((m) => ({
        rol: m.remitente === "CONTACTO" ? "user" : "assistant",
        contenido: m.contenido ?? "",
        creadoEn: m.creadoEn,
      }));

    contexto.conversacion = {
      id: conversacionData.id,
      contactoNombre: conversacionData.contacto?.nombre,
      canal: conversacionData.cuentaCanal?.canal,
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

  if (agenteConfig?.sistemaPrompt) {
    contexto.sistemaPrompt = agenteConfig.sistemaPrompt;
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

  if (contexto.contacto || contexto.oportunidad) {
    const partes: string[] = [];
    if (contexto.contacto) {
      partes.push(
        `Contacto: ${contexto.contacto.nombre}` +
          (contexto.contacto.empresa ? ` (${contexto.contacto.empresa})` : ""),
      );
    }
    if (contexto.oportunidad) {
      partes.push(
        `Oportunidad: ${contexto.oportunidad.titulo} — Etapa: ${contexto.oportunidad.etapa}`,
      );
    }
    mensajes.push({ rol: "system", contenido: partes.join("\n") });
  }

  if (contexto.conversacion?.mensajes) {
    for (const m of contexto.conversacion.mensajes) {
      mensajes.push({ rol: m.rol, contenido: m.contenido });
    }
  }

  return mensajes;
}

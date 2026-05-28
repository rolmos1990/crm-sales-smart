"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";
import { EnviarMensajeSchema } from "./schema";
import type { MensajeEntranteNormalizado } from "./types";

// ── Procesar mensaje entrante desde webhook ─────────────────────────────────

export async function procesarMensajeEntrante(
  payload: MensajeEntranteNormalizado & { instanciaId: string }
) {
  const { canal, identificadorContacto, cuentaCanalId, instanciaId, contenido, tipo, idExterno } = payload;

  // 1. Buscar contacto por identificador de canal
  let identificador = await prisma.contactoIdentificadorCanal.findUnique({
    where: { canal_identificador_instanciaId: { canal, identificador: identificadorContacto, instanciaId } },
    include: { contacto: true },
  });

  // 2. Si no existe, crear contacto y registrar identificador
  if (!identificador) {
    const contacto = await prisma.contacto.create({
      data: {
        nombre: identificadorContacto,
        apellido: "",
        instanciaId,
        estado: "LEAD",
      },
    });
    identificador = await prisma.contactoIdentificadorCanal.create({
      data: { canal, identificador: identificadorContacto, contactoId: contacto.id, instanciaId },
      include: { contacto: true },
    });
  }

  const contactoId = identificador.contacto.id;

  // 3. Buscar conversación abierta para contacto + cuenta canal
  let conversacion = await prisma.conversacion.findFirst({
    where: { contactoId, cuentaCanalId, estado: "ABIERTA" },
  });

  // 4. Si no existe, crear conversación nueva
  if (!conversacion) {
    conversacion = await prisma.conversacion.create({
      data: { contactoId, cuentaCanalId, instanciaId, estado: "ABIERTA" },
    });

    busEventos.publicar(TIPOS_EVENTO.CONVERSACION_CREADA, {
      conversacionId: conversacion.id,
      instanciaId,
      contactoId,
    });
  }

  // 5. Buscar oportunidad activa del contacto en esta instancia
  const oportunidadActiva = await prisma.oportunidad.findFirst({
    where: {
      instanciaId,
      etapa: { notIn: ["GANADO", "PERDIDO"] },
      contactos: { some: { contactoId } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  // 6. Asociar conversación ↔ oportunidad si no está ya asociada
  if (oportunidadActiva) {
    await prisma.oportunidadConversacion.upsert({
      where: { oportunidadId_conversacionId: { oportunidadId: oportunidadActiva.id, conversacionId: conversacion.id } },
      create: { oportunidadId: oportunidadActiva.id, conversacionId: conversacion.id, esActiva: true },
      update: { esActiva: true },
    });
  }

  // 7. Guardar mensaje
  const mensaje = await prisma.mensajeConversacion.create({
    data: {
      conversacionId: conversacion.id,
      contenido: contenido ?? null,
      tipo,
      remitente: "CONTACTO",
      estado: "RECIBIDO",
      idExterno: idExterno ?? null,
      creadoEn: new Date(),
    },
  });

  // 8. Actualizar timestamp de la conversación
  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: { actualizadoEn: new Date() },
  });

  // 9. Publicar evento para SSE
  busEventos.publicar(TIPOS_EVENTO.MENSAJE_RECIBIDO, {
    mensajeId: mensaje.id,
    conversacionId: conversacion.id,
    instanciaId,
    oportunidadId: oportunidadActiva?.id ?? null,
  });

  if (oportunidadActiva) {
    revalidatePath(`/crm/oportunidades/${oportunidadActiva.id}`);
  }

  return { mensaje, conversacion };
}

// ── Iniciar conversación manual (agente inicia el contacto) ────────────────

export async function iniciarConversacion(input: {
  contactoId: string;
  cuentaCanalId?: string | null;
}): Promise<{ ok: true; conversacionId: string } | { ok: false; error: string }> {
  try {
    // Resolver instanciaId desde el canal seleccionado (si aplica)
    let instanciaId: string | null = null;
    if (input.cuentaCanalId) {
      const cuenta = await prisma.cuentaCanal.findUnique({
        where: { id: input.cuentaCanalId },
        select: { instanciaId: true },
      });
      instanciaId = cuenta?.instanciaId ?? null;
    }

    // Reusar conversación abierta si ya existe para este contacto + canal
    const existente = await prisma.conversacion.findFirst({
      where: {
        contactoId: input.contactoId,
        cuentaCanalId: input.cuentaCanalId ?? undefined,
        estado: "ABIERTA",
      },
    });

    const conversacion = existente ?? await prisma.conversacion.create({
      data: {
        contactoId: input.contactoId,
        cuentaCanalId: input.cuentaCanalId ?? undefined,
        instanciaId: instanciaId ?? undefined,
        estado: "ABIERTA",
      },
    });

    // Registrar identificador de canal del contacto solo si hay canal activo
    if (input.cuentaCanalId && instanciaId) {
      const [cuentaCanal, contacto] = await Promise.all([
        prisma.cuentaCanal.findUnique({ where: { id: input.cuentaCanalId }, select: { canal: true } }),
        prisma.contacto.findUnique({ where: { id: input.contactoId }, select: { telefonoPrincipal: true, email: true } }),
      ]);

      if (cuentaCanal && contacto) {
        const canalBase = cuentaCanal.canal.replace("_lite", "").replace("_business", "");
        const identificador = canalBase === "email" ? contacto.email : contacto.telefonoPrincipal;
        if (identificador) {
          await prisma.contactoIdentificadorCanal.upsert({
            where: { canal_identificador_instanciaId: { canal: canalBase, identificador, instanciaId } },
            create: { canal: canalBase, identificador, contactoId: input.contactoId, instanciaId },
            update: {},
          });
        }
      }
    }

    if (!existente) {
      busEventos.publicar(TIPOS_EVENTO.CONVERSACION_CREADA, {
        conversacionId: conversacion.id,
        instanciaId: instanciaId ?? "",
        contactoId: input.contactoId,
      });
    }

    return { ok: true, conversacionId: conversacion.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al iniciar conversación" };
  }
}

// ── Enviar mensaje saliente ─────────────────────────────────────────────────

export async function enviarMensaje(input: {
  conversacionId: string;
  contenido?: string;
  tipo?: string;
  esNotaInterna?: boolean;
  usuarioId?: string;
}) {
  const validado = EnviarMensajeSchema.parse(input);

  const conversacion = await prisma.conversacion.findUniqueOrThrow({
    where: { id: validado.conversacionId },
    include: { cuentaCanal: true, contacto: true },
  });

  // Crear mensaje en BD de inmediato (optimistic — el agente lo ve al instante)
  const mensaje = await prisma.mensajeConversacion.create({
    data: {
      conversacionId: validado.conversacionId,
      contenido: validado.contenido ?? null,
      tipo: validado.tipo,
      remitente: validado.esNotaInterna ? "SISTEMA" : "AGENTE",
      estado: "ENVIADO",
      esNotaInterna: validado.esNotaInterna,
      usuarioId: input.usuarioId ?? null,
      enviadoEn: new Date(),
    },
  });

  await prisma.conversacion.update({
    where: { id: validado.conversacionId },
    data: { actualizadoEn: new Date() },
  });

  // Notificar SSE de inmediato para que el panel lo muestre sin esperar al worker
  if (conversacion.instanciaId) {
    busEventos.publicar(TIPOS_EVENTO.MENSAJE_ENVIADO, {
      mensajeId: mensaje.id,
      conversacionId: validado.conversacionId,
      instanciaId: conversacion.instanciaId,
    });
  }

  // Encolar job asíncrono para la entrega real solo si hay canal configurado
  if (!validado.esNotaInterna && conversacion.cuentaCanalId && conversacion.instanciaId && conversacion.cuentaCanal) {
    await prisma.jobMensaje.create({
      data: {
        tipo: "ENVIAR_MENSAJE",
        instanciaId: conversacion.instanciaId,
        payload: {
          mensajeId: mensaje.id,
          conversacionId: validado.conversacionId,
          contenido: validado.contenido,
          tipo: validado.tipo,
          destinatario: conversacion.contacto.telefonoPrincipal ?? conversacion.contacto.email ?? "",
          canal: conversacion.cuentaCanal.canal,
          cuentaCanalId: conversacion.cuentaCanalId,
          instanciaId: conversacion.instanciaId,
        },
      },
    });
  }

  revalidatePath(`/crm/oportunidades`);
  return { ok: true, mensaje };
}

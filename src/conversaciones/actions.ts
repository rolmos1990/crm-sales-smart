"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";
import { EnviarMensajeSchema } from "./schema";
import { normalizarTelefono } from "@/lib/normalizar-telefono";
import type { MensajeEntranteNormalizado } from "./types";

// ── Procesar mensaje entrante desde webhook ─────────────────────────────────

export async function procesarMensajeEntrante(
  payload: MensajeEntranteNormalizado & { instanciaId: string }
) {
  const { canal, identificadorContacto, cuentaCanalId, instanciaId, contenido, tipo, idExterno, pushName } = payload;

  // 1. Buscar contacto por identificador de canal
  let identificador = await prisma.contactoIdentificadorCanal.findUnique({
    where: { canal_identificador_instanciaId: { canal, identificador: identificadorContacto, instanciaId } },
    include: { contacto: true },
  });

  // 2. Si no existe el mapping, buscar contacto por teléfono antes de crear uno nuevo
  if (!identificador) {
    const soloNumeros = normalizarTelefono(identificadorContacto);

    const contactoExistente = soloNumeros
      ? await prisma.contacto.findFirst({
          where: {
            instanciaId,
            OR: [
              { telefonoPrincipal: identificadorContacto },
              { telefonoPrincipal: soloNumeros },
              { telefonoPrincipal: `+${soloNumeros}` },
              { telefonoSecundario: identificadorContacto },
              { telefonoSecundario: soloNumeros },
              { telefonoSecundario: `+${soloNumeros}` },
            ],
          },
        })
      : null;

    if (contactoExistente) {
      // Crear el mapping para que futuras búsquedas sean O(1)
      identificador = await prisma.contactoIdentificadorCanal.create({
        data: { canal, identificador: identificadorContacto, contactoId: contactoExistente.id, instanciaId },
        include: { contacto: true },
      });
    } else {
      // Si no hay pushName, crear contacto placeholder sin nombre para que el agente lo identifique
      const nombreInicial = pushName ?? "";
      const telefonoGuardar = canal !== "email"
        ? (soloNumeros ? `+${soloNumeros}` : identificadorContacto)
        : null;

      const contacto = await prisma.contacto.create({
        data: {
          nombre: nombreInicial,
          apellido: "",
          instanciaId,
          estado: "LEAD",
          ...(telefonoGuardar ? { telefonoPrincipal: telefonoGuardar } : {}),
        },
      });
      identificador = await prisma.contactoIdentificadorCanal.create({
        data: { canal, identificador: identificadorContacto, contactoId: contacto.id, instanciaId },
        include: { contacto: true },
      });
    }
  }

  // Auto-actualizar nombre si el contacto es placeholder y tenemos pushName
  if (pushName && identificador.contacto.nombre === "") {
    await prisma.contacto.update({
      where: { id: identificador.contacto.id },
      data: { nombre: pushName },
    });
  }

  const contactoId = identificador.contacto.id;

  // 3. Buscar conversación abierta para contacto + cuenta canal
  let conversacionEsNueva = false;
  let conversacion = await prisma.conversacion.findFirst({
    where: { contactoId, cuentaCanalId, estado: "ABIERTA" },
  });

  // 4. Si no existe, crear conversación nueva
  if (!conversacion) {
    conversacionEsNueva = true;
    conversacion = await prisma.conversacion.create({
      data: { contactoId, cuentaCanalId, instanciaId, estado: "ABIERTA" },
    });

    busEventos.publicar(TIPOS_EVENTO.CONVERSACION_CREADA, {
      conversacionId: conversacion.id,
      instanciaId,
      contactoId,
    });
  }

  // 5. Buscar oportunidad activa por contacto principal
  const opContacto = await prisma.oportunidadContacto.findFirst({
    where: {
      contactoId,
      principal: true,
      oportunidad: {
        instanciaId,
        etapa: { notIn: ["GANADO", "PERDIDO"] },
      },
    },
    include: { oportunidad: true },
    orderBy: { oportunidad: { actualizadoEn: "desc" } },
  });
  let oportunidadActiva = opContacto?.oportunidad ?? null;

  if (oportunidadActiva?.stageId) {
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: oportunidadActiva.stageId },
      select: { esGanado: true, esPerdido: true },
    });
    if (stage?.esGanado || stage?.esPerdido) oportunidadActiva = null;
  }

  // 6. Marcar nuevo mensaje o crear oportunidad si no existe ninguna activa
  if (oportunidadActiva) {
    await prisma.oportunidad.update({
      where: { id: oportunidadActiva.id },
      data: { nuevoMensaje: true, ultimaInteraccionEn: new Date() },
    });
  } else {
    // Resolver pipeline: intentar con instanciaId, luego sin filtro, luego el primero disponible
    const pipelineDefault =
      await prisma.pipeline.findFirst({
        where: { instanciaId, esDefault: true, activo: true },
        include: { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" }, take: 1 } },
      }) ??
      await prisma.pipeline.findFirst({
        where: { esDefault: true, activo: true },
        include: { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" }, take: 1 } },
      }) ??
      await prisma.pipeline.findFirst({
        where: { activo: true },
        orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
        include: { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" }, take: 1 } },
      });
    const stageInicial = pipelineDefault?.stages[0] ?? null;

    const count = await prisma.oportunidad.count({ where: { instanciaId } });

    // Siempre vincular el contacto como principal (incluso si es placeholder)
    // para que obtenerConversacionesPorOportunidad siempre encuentre un contacto principal
    oportunidadActiva = await prisma.oportunidad.create({
      data: {
        titulo: `Oportunidad ${count + 1}`,
        etapa: "PROSPECTO",
        valor: 0,
        instanciaId,
        pipelineId: pipelineDefault?.id ?? null,
        stageId: stageInicial?.id ?? null,
        probabilidad: stageInicial?.probabilidad ?? 20,
        contactos: { create: { contactoId, principal: true } },
      },
    });
    try {
      revalidatePath("/crm/oportunidades");
      revalidatePath("/crm/pipeline");
    } catch { /* fuera de request context */ }
  }

  // 7. Guardar mensaje — deduplicar por idExterno para evitar duplicados en reintentos del worker
  if (idExterno) {
    const existente = await prisma.mensajeConversacion.findFirst({
      where: { conversacionId: conversacion.id, idExterno },
    });
    if (existente) return { mensaje: existente, conversacion };
  }

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

  // revalidatePath no funciona fuera de un request de Next.js (ej: worker); ignorar en ese contexto
  try {
    if (oportunidadActiva) {
      revalidatePath(`/crm/oportunidades/${oportunidadActiva.id}`);
    }
  } catch { /* fuera de request context */ }

  return { mensaje, conversacion };
}

// ── Iniciar conversación manual (agente inicia el contacto) ────────────────

export async function iniciarConversacion(input: {
  contactoId: string;
  cuentaCanalId?: string | null;
  oportunidadId?: string | null;
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
}): Promise<{ ok: true; mensaje: { id: string } } | { ok: false; error: string }> {
  try {
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
    return { ok: true, mensaje: { id: mensaje.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar mensaje" };
  }
}

// ── Obtener datos para workspace (pipeline panel) ──────────────────────────

export async function obtenerConversacionesPorOportunidadAction(oportunidadId: string) {
  try {
    const { obtenerConversacionesPorOportunidad } = await import("./queries");
    return obtenerConversacionesPorOportunidad(oportunidadId);
  } catch {
    return [];
  }
}

export async function obtenerCuentasCanalAction() {
  try {
    const { obtenerTodasLasCuentasCanal } = await import("./queries");
    return obtenerTodasLasCuentasCanal();
  } catch {
    return [];
  }
}

// ── Vincular conversación a otro contacto ─────────────────────────────────────

export async function vincularConversacionAContacto(
  conversacionId: string,
  nuevoContactoId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const conv = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { contactoId: true, instanciaId: true },
    });
    if (!conv) return { ok: false, error: "Conversación no encontrada" };

    const viejoContactoId = conv.contactoId;

    // Transferir los identificadores de canal del contacto anterior al nuevo
    if (conv.instanciaId) {
      await prisma.contactoIdentificadorCanal.updateMany({
        where: { contactoId: viejoContactoId, instanciaId: conv.instanciaId },
        data: { contactoId: nuevoContactoId },
      });
    }

    // Actualizar conversación al nuevo contacto
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { contactoId: nuevoContactoId },
    });

    // Encontrar oportunidades donde el contacto viejo era el principal
    const opsVinculadas = await prisma.oportunidadContacto.findMany({
      where: { contactoId: viejoContactoId, principal: true },
      select: { oportunidadId: true },
    });

    // Reasignar contacto principal en esas oportunidades al nuevo contacto
    for (const { oportunidadId } of opsVinculadas) {
      await prisma.$transaction([
        prisma.oportunidadContacto.deleteMany({
          where: { oportunidadId, contactoId: viejoContactoId },
        }),
        prisma.oportunidadContacto.upsert({
          where: { oportunidadId_contactoId: { oportunidadId, contactoId: nuevoContactoId } },
          create: { oportunidadId, contactoId: nuevoContactoId, principal: true },
          update: {},
        }),
      ]);
    }

    revalidatePath("/crm/inbox");
    revalidatePath("/crm/pipeline");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al vincular contacto" };
  }
}

// ── Cerrar conversación ─────────────────────────────────────────────────────

export async function cerrarConversacion(
  conversacionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { estado: "CERRADA" },
    });
    revalidatePath("/crm/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cerrar la conversación" };
  }
}

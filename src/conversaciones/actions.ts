"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { EventosSistema, ComandosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { EnviarMensajeSchema } from "./schema";
import { normalizarTelefono } from "@/lib/normalizar-telefono";
import { obtenerProvider } from "./providers/registry";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { obtenerConversacionPorId, obtenerConversacionesInbox } from "./queries";
import { requireSesion } from "@/shared/auth/sesion";
import type { MensajeEntranteNormalizado, ConversacionResumen } from "./types";

// ── Resolución compartida de contacto + conversación ────────────────────────
//
// Extraído de procesarMensajeEntrante (pasos 1-4 originales) para que
// registrarMensajeAppNativa (mensaje detectado por eco desde la app nativa
// del canal, ver specs/020-fix-mensajes-app-nativa) pueda reutilizar la
// misma resolución de contacto/conversación sin duplicar el manejo de
// condición de carrera ni el criterio de qué cuenta como "conversación
// previa" — ambos flujos deben comportarse igual en ese punto.
async function resolverContactoYConversacion(payload: {
  canal: string;
  identificadorContacto: string;
  cuentaCanalId: string;
  instanciaId: string;
  pushName?: string;
  avatarUrl?: string;
  handleCanal?: string;
}) {
  const { canal, identificadorContacto, cuentaCanalId, instanciaId, pushName, avatarUrl, handleCanal } = payload;

  // 1. Buscar contacto por identificador de canal
  let identificador = await prisma.contactoIdentificadorCanal.findUnique({
    where: { canal_identificador_instanciaId: { canal, identificador: identificadorContacto, instanciaId } },
    include: { contacto: true },
  });

  // 2. Si no existe el mapping, buscar contacto por teléfono antes de crear uno nuevo
  if (!identificador) {
    // Solo los canales de WhatsApp usan un número de teléfono como identificador.
    // Instagram (IGSID), email u otros canales futuros traen un identificador propio
    // que NO es un teléfono — guardarlo en telefonoPrincipal produciría un "número"
    // falso e indistinguible de uno real.
    const esCanalTelefonico = canal.startsWith("whatsapp");
    // Los JIDs @lid son IDs internos de WhatsApp (privacidad activada), no son teléfonos
    const esLid = esCanalTelefonico && identificadorContacto.endsWith("@lid");
    const soloNumeros = esCanalTelefonico && !esLid ? normalizarTelefono(identificadorContacto) : null;

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
        data: { canal, identificador: identificadorContacto, contactoId: contactoExistente.id, instanciaId, handle: handleCanal ?? null },
        include: { contacto: true },
      });
    } else {
      // Si no hay pushName, crear contacto placeholder sin nombre para que el agente lo identifique
      const nombreInicial = pushName ?? "";
      // Solo guardamos el identificador como teléfono si el canal es telefónico y no es @lid
      // (el identificador ya queda de todos modos en ContactoIdentificadorCanal para ese canal)
      const telefonoGuardar = esCanalTelefonico && !esLid
        ? (soloNumeros ? `+${soloNumeros}` : identificadorContacto)
        : null;

      const contacto = await prisma.contacto.create({
        data: {
          nombre: nombreInicial,
          apellido: "",
          instanciaId,
          estado: "LEAD",
          ...(telefonoGuardar ? { telefonoPrincipal: telefonoGuardar } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      });
      identificador = await prisma.contactoIdentificadorCanal.create({
        data: { canal, identificador: identificadorContacto, contactoId: contacto.id, instanciaId, handle: handleCanal ?? null },
        include: { contacto: true },
      });
    }
  }

  // Auto-actualizar nombre/avatar si el contacto es placeholder o no tiene foto aún
  const actualizarContacto: Record<string, string> = {};
  if (pushName && identificador.contacto.nombre === "") actualizarContacto.nombre = pushName;
  if (avatarUrl && !identificador.contacto.avatarUrl) actualizarContacto.avatarUrl = avatarUrl;
  if (Object.keys(actualizarContacto).length > 0) {
    await prisma.contacto.update({
      where: { id: identificador.contacto.id },
      data: actualizarContacto,
    });
  }

  // Auto-completar el handle (@usuario) si el mapping ya existía sin él
  if (handleCanal && !identificador.handle) {
    await prisma.contactoIdentificadorCanal.update({
      where: { id: identificador.id },
      data: { handle: handleCanal },
    });
  }

  const contactoId = identificador.contacto.id;

  // 3. Buscar conversación abierta o en espera para contacto + instancia
  // Se busca por instanciaId en vez de cuentaCanalId para tolerar re-escaneos de QR
  // (cada re-escaneo crea un nuevo CuentaCanal; la conversación existente tiene el id anterior)
  let conversacion = await prisma.conversacion.findFirst({
    where: { contactoId, instanciaId, estado: { in: ["ABIERTA", "EN_ESPERA", "CERRADA"] } },
    orderBy: { actualizadoEn: "desc" },
  });

  if (conversacion) {
    // Actualizar cuenta canal si cambió (re-escaneo de QR), reabrir si estaba en espera o cerrada
    const estabasCerrada = conversacion.estado === "CERRADA";
    const needsUpdate =
      conversacion.cuentaCanalId !== cuentaCanalId ||
      conversacion.estado === "EN_ESPERA" ||
      conversacion.estado === "CERRADA";
    if (needsUpdate) {
      const upd: { cuentaCanalId?: string; estado?: "ABIERTA" } = {};
      if (conversacion.cuentaCanalId !== cuentaCanalId) upd.cuentaCanalId = cuentaCanalId;
      if (conversacion.estado === "EN_ESPERA" || conversacion.estado === "CERRADA") upd.estado = "ABIERTA";
      await prisma.conversacion.update({ where: { id: conversacion.id }, data: upd });
      conversacion = { ...conversacion, ...upd };
      if (estabasCerrada) {
        await registrarEventoConversacion(conversacion.id, "REABIERTA");
      }
    }
  }

  // 4. Si no existe, crear conversación nueva
  if (!conversacion) {
    conversacion = await prisma.conversacion.create({
      data: { contactoId, cuentaCanalId, instanciaId, estado: "ABIERTA" },
    });

    void publicadorEventos.publicar(EventosSistema.ConversacionCreada, instanciaId, {
      conversacionId: conversacion.id,
      instanciaId,
      contactoId,
    });
  }

  return { contactoId, conversacion };
}

// ── Procesar mensaje entrante desde webhook ─────────────────────────────────

export async function procesarMensajeEntrante(
  payload: MensajeEntranteNormalizado & { instanciaId: string }
) {
  const { canal, identificadorContacto, cuentaCanalId, instanciaId, contenido, tipo, idExterno, pushName, avatarUrl, handleCanal, mediaUrl, mediaMimeType, mediaDuracion } = payload;

  const { contactoId, conversacion } = await resolverContactoYConversacion({
    canal, identificadorContacto, cuentaCanalId, instanciaId, pushName, avatarUrl, handleCanal,
  });

  // 4.5 Deduplicar por idExterno ANTES de crear oportunidades (evita duplicados en procesamiento concurrente)
  if (idExterno) {
    const msgExistente = await prisma.mensajeConversacion.findFirst({
      where: { conversacionId: conversacion.id, idExterno },
    });
    if (msgExistente) return { mensaje: msgExistente, conversacion };
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

  // 6. Marcar nuevo mensaje o gestionar según historial de oportunidades
  if (oportunidadActiva) {
    await Promise.all([
      prisma.oportunidad.update({
        where: { id: oportunidadActiva.id },
        data: { nuevoMensaje: true, ultimaInteraccionEn: new Date() },
      }),
      // Asegurar que la conversación quede vinculada a la oportunidad activa
      prisma.oportunidadConversacion.upsert({
        where: { oportunidadId_conversacionId: { oportunidadId: oportunidadActiva.id, conversacionId: conversacion.id } },
        create: { oportunidadId: oportunidadActiva.id, conversacionId: conversacion.id },
        update: {},
      }),
    ]);
  } else {
    // Buscar última oportunidad FINALIZADA del contacto (ganada o perdida) —
    // en ambos casos se trata igual: no crear una nueva en automático, sino
    // dejar que el agente clasifique la conversación desde el Inbox.
    const ultimaFinalizada = await prisma.oportunidad.findFirst({
      where: {
        instanciaId,
        contactos: { some: { contactoId, principal: true } },
        OR: [
          { etapa: { in: ["GANADO", "PERDIDO"] } },
          { stage: { OR: [{ esGanado: true }, { esPerdido: true }] } },
        ],
      },
      orderBy: { actualizadoEn: "desc" },
      select: { id: true },
    });

    if (ultimaFinalizada) {
      // Cliente con historial cerrado (ganado o perdido) — NO crear
      // oportunidad, solo registrar referencia para que se clasifique.
      await prisma.conversacion.update({
        where: { id: conversacion.id },
        data: { oportunidadGanadaRelId: ultimaFinalizada.id },
      });
    } else {
      // Primer contacto o sin historial cerrado → crear oportunidad (lead entrante)
      // Pre-cargar configuración de pipeline fuera de la sección crítica (lecturas idempotentes)
      const stagesInclude = { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" } as const, take: 1 } };

      const cuentaCanalCfg = cuentaCanalId
        ? await prisma.cuentaCanal.findUnique({ where: { id: cuentaCanalId }, select: { pipelineId: true, stageId: true } })
        : null;

      const pipelineCfgId = cuentaCanalCfg != null ? cuentaCanalCfg.pipelineId : null;
      const pipelineDefault =
        (pipelineCfgId != null
          ? await prisma.pipeline.findUnique({ where: { id: pipelineCfgId, activo: true }, include: stagesInclude })
          : null) ??
        await prisma.pipeline.findFirst({ where: { instanciaId, esDefault: true, activo: true }, include: stagesInclude }) ??
        await prisma.pipeline.findFirst({ where: { esDefault: true, activo: true }, include: stagesInclude }) ??
        await prisma.pipeline.findFirst({ where: { activo: true }, orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }], include: stagesInclude });

      const stageCfgId = cuentaCanalCfg != null ? cuentaCanalCfg.stageId : null;
      const stageConfigurado = stageCfgId != null
        ? await prisma.pipelineStage.findUnique({ where: { id: stageCfgId, activo: true }, select: { id: true, probabilidad: true } })
        : null;
      const stageInicial = stageConfigurado ?? pipelineDefault?.stages[0] ?? null;

      const [count, moneda] = await Promise.all([
        prisma.oportunidad.count({ where: { instanciaId } }),
        obtenerMonedaPrincipal(instanciaId),
      ]);

      // Sección crítica: bloquear fila de conversación para serializar llamadas concurrentes
      // que llegaron hasta aquí en paralelo (Baileys puede emitir el mismo mensaje 3 veces).
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Conversacion" WHERE id = ${conversacion.id} FOR UPDATE`;

        // Re-verificar si otra llamada concurrente ya creó la oportunidad mientras hacíamos las lecturas
        const opExistente = await tx.oportunidadContacto.findFirst({
          where: {
            contactoId,
            principal: true,
            oportunidad: { instanciaId, etapa: { notIn: ["GANADO", "PERDIDO"] } },
          },
          include: { oportunidad: true },
          orderBy: { oportunidad: { actualizadoEn: "desc" } },
        });

        if (opExistente) {
          oportunidadActiva = opExistente.oportunidad;
          await tx.oportunidadConversacion.upsert({
            where: { oportunidadId_conversacionId: { oportunidadId: opExistente.oportunidad.id, conversacionId: conversacion.id } },
            create: { oportunidadId: opExistente.oportunidad.id, conversacionId: conversacion.id },
            update: {},
          });
          return;
        }

        oportunidadActiva = await tx.oportunidad.create({
          data: {
            titulo: `Oportunidad ${count + 1}`,
            etapa: "PROSPECTO",
            valor: 0,
            moneda,
            instanciaId,
            pipelineId: pipelineDefault?.id ?? null,
            stageId: stageInicial?.id ?? null,
            probabilidad: stageInicial?.probabilidad ?? 20,
            contactos: { create: { contactoId, principal: true } },
          },
        });
        await tx.oportunidadConversacion.create({
          data: { oportunidadId: oportunidadActiva.id, conversacionId: conversacion.id },
        });
      });

      try {
        revalidatePath("/crm/oportunidades");
        revalidatePath("/crm/pipeline");
      } catch { /* fuera de request context */ }
    }
  }

  // 7. Guardar mensaje — segunda barrera dedup para la ventana de carrera entre paso 4.5 y aquí
  if (idExterno) {
    const existente = await prisma.mensajeConversacion.findFirst({
      where: { conversacionId: conversacion.id, idExterno },
    });
    if (existente) return { mensaje: existente, conversacion };
  }

  // Vincular contactoId al MediaArchivo si viene de una imagen procesada
  const mediaArchivoIdPayload = payload.mediaArchivoId as string | undefined;
  if (mediaArchivoIdPayload) {
    await prisma.mediaArchivo.update({
      where: { id: mediaArchivoIdPayload },
      data: { contactoId },
    }).catch(() => { /* ignorar si el registro no existe */ });
  }

  const mensaje = await prisma.mensajeConversacion.create({
    data: {
      conversacionId: conversacion.id,
      contenido: contenido ?? null,
      tipo,
      remitente: "CONTACTO",
      estado: "RECIBIDO",
      idExterno: idExterno ?? null,
      mediaUrl: (mediaUrl as string | undefined) ?? null,
      mediaMimeType: (mediaMimeType as string | undefined) ?? null,
      mediaDuracion: (mediaDuracion as number | undefined) ?? null,
      mediaArchivoId: mediaArchivoIdPayload ?? null,
      creadoEn: new Date(),
    },
  });

  // 8. Actualizar timestamp de la conversación
  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: { actualizadoEn: new Date() },
  });

  // 9. Publicar evento para SSE
  void publicadorEventos.publicar(EventosSistema.MensajeRecibido, instanciaId, {
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

// ── Registrar mensaje enviado desde la app nativa del canal (no desde Karia) ─
//
// Se llama cuando el webhook/listener de un canal detecta un evento de "eco"
// (is_echo/fromMe) cuyo idExterno NO corresponde a un mensaje que Karia ya
// envió — es decir, alguien respondió desde la app nativa de Instagram,
// Messenger o WhatsApp por fuera de Karia. Ver specs/020-fix-mensajes-app-nativa.
//
// Deliberadamente NO reutiliza procesarMensajeEntrante completo: reusa solo
// la resolución de contacto/conversación (resolverContactoYConversacion),
// pero evita sus otros dos efectos secundarios, que acá serían incorrectos:
//   1. remitente="CONTACTO" haría ver el mensaje como si lo hubiera escrito
//      el cliente.
//   2. Publicar MensajeRecibido dispararía OrquestarIASuscriptor, que le
//      "contestaría" automáticamente a un mensaje que el propio negocio ya
//      envió por fuera de Karia.
// Tampoco crea/actualiza Oportunidad — ese efecto es una señal de interés
// entrante del contacto, no de un mensaje saliente del negocio (ver
// research.md R3, R8 de la spec).
export async function registrarMensajeAppNativa(
  payload: MensajeEntranteNormalizado & { instanciaId: string }
) {
  const { canal, identificadorContacto, cuentaCanalId, instanciaId, contenido, tipo, idExterno, pushName, avatarUrl, handleCanal, mediaUrl, mediaMimeType, mediaDuracion } = payload;

  // Primera barrera dedup: si el idExterno ya está registrado (Karia lo envió,
  // o ya se procesó este mismo evento en un intento anterior), no hay nada
  // que hacer — resolverContactoYConversacion ni siquiera hace falta.
  if (idExterno) {
    const yaExiste = await prisma.mensajeConversacion.findFirst({ where: { idExterno } });
    if (yaExiste) return { mensaje: yaExiste, conversacion: null };
  }

  // pushName se reenvía tal cual venga en el payload — la responsabilidad de
  // NO incluirlo cuando no es confiable es de quien publica el comando, no
  // de acá. Para WhatsApp/Baileys, el productor (encolarMensajeAppNativaWA)
  // deliberadamente no lo incluye: en un evento fromMe, Baileys reporta el
  // pushName de la propia cuenta del negocio, no el del contacto (research.md
  // R5). Para Instagram/Messenger sí es seguro: se resuelve con una consulta
  // a Graph API por el ID del contacto real (recipient.id en el evento de
  // eco, ver research.md R4), no con un campo autoreportado por el emisor.
  const { contactoId, conversacion } = await resolverContactoYConversacion({
    canal, identificadorContacto, cuentaCanalId, instanciaId, pushName, avatarUrl, handleCanal,
  });

  // Segunda barrera dedup, misma ventana de carrera que procesarMensajeEntrante
  if (idExterno) {
    const existente = await prisma.mensajeConversacion.findFirst({
      where: { conversacionId: conversacion.id, idExterno },
    });
    if (existente) return { mensaje: existente, conversacion };
  }

  const mediaArchivoIdPayload = payload.mediaArchivoId as string | undefined;
  if (mediaArchivoIdPayload) {
    await prisma.mediaArchivo.update({
      where: { id: mediaArchivoIdPayload },
      data: { contactoId },
    }).catch(() => { /* ignorar si el registro no existe */ });
  }

  const mensaje = await prisma.mensajeConversacion.create({
    data: {
      conversacionId: conversacion.id,
      contenido: contenido ?? null,
      tipo,
      remitente: "AGENTE_CANAL_NATIVO",
      estado: "ENTREGADO",
      idExterno: idExterno ?? null,
      mediaUrl: (mediaUrl as string | undefined) ?? null,
      mediaMimeType: (mediaMimeType as string | undefined) ?? null,
      mediaDuracion: (mediaDuracion as number | undefined) ?? null,
      mediaArchivoId: mediaArchivoIdPayload ?? null,
      enviadoEn: new Date(),
      creadoEn: new Date(),
    },
  });

  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: { actualizadoEn: new Date() },
  });

  // Reusa el contrato MensajeEnviado (sin cambios) — el frontend ya lo
  // escucha por SSE solo como señal de "volvé a pedir los mensajes"
  // (inbox-layout.tsx, panel-conversacion.tsx). No dispara IA: eso solo
  // escucha MensajeRecibido.
  void publicadorEventos.publicar(EventosSistema.MensajeEnviado, instanciaId, {
    mensajeId: mensaje.id,
    conversacionId: conversacion.id,
    instanciaId,
  });

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
      void publicadorEventos.publicar(EventosSistema.ConversacionCreada, instanciaId ?? "", {
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
  mediaUrl?: string;
  /** Solo para llamadores internos de confianza (workers de cola, ej.
   *  GenerarRespuestaIASuscriptor) que ya resolvieron y validaron el
   *  instanciaId contra la conversación antes de llegar acá — nunca lo
   *  manda un cliente. Si no viene, se resuelve por sesión (llamada desde
   *  el navegador). Ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md, hallazgo #2. */
  instanciaId?: string;
}): Promise<{ ok: true; mensaje: { id: string } } | { ok: false; error: string }> {
  try {
    const validado = EnviarMensajeSchema.parse(input);

    const conversacion = await prisma.conversacion.findUniqueOrThrow({
      where: { id: validado.conversacionId },
      include: { cuentaCanal: true, contacto: true },
    });

    // Aislamiento multi-tenant: un llamador de confianza (worker) trae su
    // propio instanciaId ya validado; si no, se exige sesión real y se
    // compara contra ella — nunca se confía en la conversación por su solo id.
    const instanciaIdEsperado = input.instanciaId ?? (await requireSesion()).instanciaId;
    if (conversacion.instanciaId !== instanciaIdEsperado) {
      return { ok: false, error: "Conversación no encontrada" };
    }

    // Crear mensaje en BD de inmediato (optimistic — el agente lo ve al instante)
    const mensaje = await prisma.mensajeConversacion.create({
      data: {
        conversacionId: validado.conversacionId,
        contenido: validado.contenido ?? null,
        tipo: validado.tipo,
        mediaUrl: validado.mediaUrl ?? null,
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
      void publicadorEventos.publicar(EventosSistema.MensajeEnviado, conversacion.instanciaId, {
        mensajeId: mensaje.id,
        conversacionId: validado.conversacionId,
        instanciaId: conversacion.instanciaId,
      });
    }

    // Encolar job asíncrono para la entrega real solo si hay canal configurado
    if (!validado.esNotaInterna && conversacion.cuentaCanalId && conversacion.instanciaId && conversacion.cuentaCanal) {
      // Resolver el identificador real del contacto en este canal.
      // Para contactos @lid (privacidad activada en WhatsApp) telefonoPrincipal es null,
      // pero el JID correcto está guardado en ContactoIdentificadorCanal desde el primer mensaje entrante.
      const idCanal = await prisma.contactoIdentificadorCanal.findFirst({
        where: {
          contactoId: conversacion.contactoId,
          instanciaId: conversacion.instanciaId,
          canal: conversacion.cuentaCanal.canal,
        },
        select: { identificador: true },
      });
      const destinatario =
        idCanal?.identificador ??
        conversacion.contacto.telefonoPrincipal ??
        conversacion.contacto.email ??
        "";

      await publicadorEventos.publicar(ComandosSistema.EnviarMensaje, conversacion.instanciaId, {
        instanciaId: conversacion.instanciaId,
        mensajeId: mensaje.id,
        conversacionId: validado.conversacionId,
        contenido: validado.contenido,
        tipo: validado.tipo,
        mediaUrl: input.mediaUrl ?? undefined,
        destinatario,
        canal: conversacion.cuentaCanal.canal,
        cuentaCanalId: conversacion.cuentaCanalId,
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
    const sesion = await requireSesion();
    const { obtenerConversacionesPorOportunidad } = await import("./queries");
    return obtenerConversacionesPorOportunidad(oportunidadId, sesion.instanciaId);
  } catch {
    return [];
  }
}

export async function obtenerCuentasCanalAction() {
  try {
    const sesion = await requireSesion();
    const { obtenerCuentasCanal } = await import("./queries");
    return obtenerCuentasCanal(sesion.instanciaId);
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

// ── Eventos de ciclo de vida ────────────────────────────────────────────────

type TipoEvento = "CERRADA" | "REABIERTA" | "RESPONDIDA";

async function registrarEventoConversacion(
  conversacionId: string,
  tipo: TipoEvento,
  usuarioNombre?: string
) {
  await prisma.mensajeConversacion.create({
    data: {
      conversacionId,
      tipo: "EVENTO_SISTEMA",
      remitente: "SISTEMA",
      estado: "ENVIADO",
      esNotaInterna: false,
      contenido: JSON.stringify({ tipo, usuarioNombre: usuarioNombre ?? null }),
    },
  });
}

// ── Cerrar / marcar respondida / reabrir ────────────────────────────────────

export async function cerrarConversacion(
  conversacionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { estado: "CERRADA" },
    });
    await registrarEventoConversacion(conversacionId, "CERRADA");
    revalidatePath("/crm/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cerrar la conversación" };
  }
}

export async function marcarRespondida(
  conversacionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { estado: "EN_ESPERA" },
    });
    await registrarEventoConversacion(conversacionId, "RESPONDIDA");
    revalidatePath("/crm/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al marcar respondida" };
  }
}

export async function reabrirConversacion(
  conversacionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { estado: "ABIERTA" },
    });
    await registrarEventoConversacion(conversacionId, "REABIERTA");
    revalidatePath("/crm/inbox");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al reabrir la conversación" };
  }
}

// ── Marcar mensajes como leídos ─────────────────────────────────────────────

export async function marcarMensajesLeidos(
  conversacionId: string,
  mensajeIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!mensajeIds.length) return { ok: false, error: "Sin mensajes" };

    // Actualizar en DB de forma inmediata — fuente de verdad local
    await prisma.mensajeConversacion.updateMany({
      where: {
        id: { in: mensajeIds },
        conversacionId,
        remitente: "CONTACTO",
      },
      data: { estado: "LEIDO", leidoEn: new Date() },
    });

    // Encolar sincronización externa solo si el canal y la sesión lo soportan
    const conv = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: {
        instanciaId: true,
        cuentaCanal: { select: { canal: true } },
      },
    });

    if (conv?.instanciaId && conv.cuentaCanal) {
      const provider = obtenerProvider(conv.cuentaCanal.canal);
      if (provider?.marcarLeido) {
        await publicadorEventos.publicar(ComandosSistema.MarcarLeido, conv.instanciaId, {
          instanciaId: conv.instanciaId,
          mensajeIds,
          conversacionId,
        });
      }
    }

    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al marcar como leído" };
  }
}

// ── Obtener conversación actualizada (para refrescar estado en cliente) ────────

export async function obtenerConversacionAction(conversacionId: string): Promise<ConversacionResumen | null> {
  return obtenerConversacionPorId(conversacionId);
}

// ── Refrescar el listado completo del Inbox (auto-refresh periódico) ───────────

export async function obtenerConversacionesInboxAction(): Promise<ConversacionResumen[]> {
  const sesion = await requireSesion();
  return obtenerConversacionesInbox(sesion.instanciaId);
}

// ── Clasificar conversación ────────────────────────────────────────────────────

export async function clasificarConversacion({
  conversacionId,
  clasificacion,
}: {
  conversacionId: string;
  clasificacion: "NINGUNA" | "POSTVENTA" | "SOPORTE" | "COMERCIAL";
}): Promise<{ ok: boolean; error?: string; oportunidadId?: string; aviso?: string; conversacion?: ConversacionResumen }> {
  try {
    const anterior = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { clasificacion: true, instanciaId: true, contactoId: true, cuentaCanalId: true },
    });
    if (!anterior) return { ok: false, error: "Conversación no encontrada" };

    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: { clasificacion, clasificadoEn: new Date() },
    });

    if (anterior.instanciaId) {
      await prisma.eventoLog.create({
        data: {
          tipo: "CLASIFICACION_CAMBIADA",
          payload: { de: anterior.clasificacion, a: clasificacion, conversacionId },
          entidadTipo: "Conversacion",
          entidadId: conversacionId,
          instanciaId: anterior.instanciaId,
        },
      });
    }

    // Clasificar como Comercial crea automáticamente una nueva oportunidad
    // (si el contacto no tiene ya una activa) — así el agente no tiene que
    // hacerlo como paso aparte.
    let oportunidadId: string | undefined;
    let aviso: string | undefined;
    if (clasificacion === "COMERCIAL" && anterior.instanciaId) {
      const resultado = await crearOportunidadDesdeConversacion({
        conversacionId,
        contactoId: anterior.contactoId,
        instanciaId: anterior.instanciaId,
        cuentaCanalId: anterior.cuentaCanalId,
      });
      // Si ya existía una oportunidad activa (de este contacto, no
      // necesariamente de esta conversación), no es un error real — pero
      // antes se descartaba en silencio: la clasificación quedaba en
      // "Comercial" sin que el agente supiera que no se creó nada nuevo.
      if (resultado.ok) oportunidadId = resultado.oportunidadId;
      else aviso = resultado.error;
    }

    // Devolver la conversación ya fresca (misma llamada, sin round-trip
    // aparte) — evita que el cliente tenga que pedirla de nuevo por
    // separado para ver la oportunidad recién creada/vinculada, que antes
    // tardaba en reflejarse (a veces solo se veía recargando la página).
    const conversacionFresca = await obtenerConversacionPorId(conversacionId);

    revalidatePath("/crm/inbox");
    return { ok: true, oportunidadId, aviso, conversacion: conversacionFresca ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al clasificar" };
  }
}

// ── Crear oportunidad desde conversación (acción explícita del agente) ─────────

export async function crearOportunidadDesdeConversacion({
  conversacionId,
  contactoId,
  instanciaId,
  cuentaCanalId,
}: {
  conversacionId: string;
  contactoId: string;
  instanciaId: string;
  cuentaCanalId?: string | null;
}): Promise<{ ok: boolean; oportunidadId?: string; error?: string }> {
  try {
    // Guard: verificar que no exista oportunidad activa (ni por etapa enum ni por stage pipeline)
    const opActiva = await prisma.oportunidadContacto.findFirst({
      where: {
        contactoId,
        principal: true,
        oportunidad: {
          instanciaId,
          etapa: { notIn: ["GANADO", "PERDIDO"] },
          // Excluir también oportunidades en stages marcados como ganado/perdido
          NOT: { stage: { OR: [{ esGanado: true }, { esPerdido: true }] } },
        },
      },
      select: { oportunidadId: true },
    });
    if (opActiva) {
      return { ok: false, error: "Ya existe una oportunidad activa para este contacto" };
    }

    const stagesInclude = { stages: { where: { esInicial: true, activo: true }, orderBy: { orden: "asc" } as const, take: 1 } };

    const cuentaCanalCfg = cuentaCanalId
      ? await prisma.cuentaCanal.findUnique({ where: { id: cuentaCanalId }, select: { pipelineId: true, stageId: true } })
      : null;

    const pipelineCfgId = cuentaCanalCfg != null ? cuentaCanalCfg.pipelineId : null;
    const pipelineDefault =
      (pipelineCfgId != null
        ? await prisma.pipeline.findUnique({ where: { id: pipelineCfgId, activo: true }, include: stagesInclude })
        : null) ??
      await prisma.pipeline.findFirst({ where: { instanciaId, esDefault: true, activo: true }, include: stagesInclude }) ??
      await prisma.pipeline.findFirst({ where: { activo: true }, orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }], include: stagesInclude });

    const stageInicial = pipelineDefault?.stages[0] ?? null;

    const [count, moneda] = await Promise.all([
      prisma.oportunidad.count({ where: { instanciaId } }),
      obtenerMonedaPrincipal(instanciaId),
    ]);

    const oportunidad = await prisma.oportunidad.create({
      data: {
        titulo: `Oportunidad ${count + 1}`,
        etapa: "PROSPECTO",
        valor: 0,
        moneda,
        instanciaId,
        pipelineId: pipelineDefault?.id ?? null,
        stageId: stageInicial?.id ?? null,
        probabilidad: stageInicial?.probabilidad ?? 20,
        contactos: { create: { contactoId, principal: true } },
        conversaciones: { create: { conversacionId } },
      },
    });

    // Limpiar la referencia a oportunidad ganada — ya no aplica, hay una nueva activa
    await prisma.conversacion.update({
      where: { id: conversacionId },
      data: {
        clasificacion: "COMERCIAL",
        clasificadoEn: new Date(),
        oportunidadGanadaRelId: null,
      },
    });

    await prisma.eventoLog.create({
      data: {
        tipo: "OPORTUNIDAD_CREADA_DESDE_INBOX",
        payload: { oportunidadId: oportunidad.id, conversacionId },
        entidadTipo: "Oportunidad",
        entidadId: oportunidad.id,
        instanciaId,
      },
    });

    revalidatePath("/crm/inbox");
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/pipeline");
    return { ok: true, oportunidadId: oportunidad.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear oportunidad" };
  }
}

// ── Reacciones a mensajes ────────────────────────────────────────────────────

export async function toggleReaccion(
  mensajeId: string,
  emoji: string,
  tipo: "CANAL" | "INTERNA",
  usuarioId: string | null,
  nombreUsuario: string | null,
): Promise<{ exito: true } | { exito: false; error: string }> {
  try {
    const mensaje = await prisma.mensajeConversacion.findUnique({
      where: { id: mensajeId },
      select: {
        conversacionId: true,
        idExterno: true,
        remitente: true,
        conversacion: {
          select: {
            instanciaId: true,
            cuentaCanal: { select: { canal: true, configuracion: true } },
            contacto: { include: { identificadoresCanal: true } },
          },
        },
      },
    });
    if (!mensaje) return { exito: false, error: "Mensaje no encontrado" };

    const existente = await prisma.mensajeReaccion.findFirst({
      where: { mensajeId, usuarioId, emoji },
    });

    const fueBorrado = !!existente;

    if (existente) {
      await prisma.mensajeReaccion.delete({ where: { id: existente.id } });
    } else {
      await prisma.mensajeReaccion.create({
        data: {
          mensajeId,
          emoji,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tipo: tipo as any,
          usuarioId,
          nombreUsuario: nombreUsuario ?? "Agente",
        },
      });
    }

    void publicadorEventos.publicar(EventosSistema.ReaccionActualizada, mensaje.conversacion?.instanciaId ?? "", {
      mensajeId,
      conversacionId: mensaje.conversacionId,
      instanciaId: mensaje.conversacion?.instanciaId ?? "",
    });

    // Enviar reacción al canal externo si aplica
    if (tipo === "CANAL" && mensaje.idExterno && mensaje.conversacion?.cuentaCanal) {
      const cuentaCanal = mensaje.conversacion.cuentaCanal;
      const provider = obtenerProvider(cuentaCanal.canal);

      if (provider?.enviarReaccion && provider.capacidades.reacciones) {
        const canal = cuentaCanal.canal;
        const identificador =
          mensaje.conversacion.contacto.identificadoresCanal.find((i) => i.canal === canal)?.identificador ?? "";

        // El campo "jid" es en realidad el identificador de destino en el canal —
        // solo WhatsApp usa formato JID; el resto de canales (ej. Instagram) pasa
        // su identificador tal cual (IGSID, no un número de teléfono).
        const jid = canal.startsWith("whatsapp")
          ? (identificador.endsWith("@lid") || identificador.endsWith("@s.whatsapp.net")
              ? identificador
              : identificador.replace(/\D/g, "") + "@s.whatsapp.net")
          : identificador;

        const fromMe = mensaje.remitente === "AGENTE";
        const emojiAEnviar = fueBorrado ? "" : emoji;

        try {
          await provider.enviarReaccion({
            jid,
            idExternoMensaje: mensaje.idExterno,
            fromMe,
            emoji: emojiAEnviar,
            configuracion: cuentaCanal.configuracion as Record<string, unknown>,
          });
        } catch (e) {
          // La reacción ya se guardó en BD — solo log del error de envío al canal
          console.error("[toggleReaccion] Error enviando reacción al canal:", e);
        }
      }
    }

    return { exito: true };
  } catch {
    return { exito: false, error: "Error al guardar la reacción" };
  }
}

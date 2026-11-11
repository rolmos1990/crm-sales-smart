// Sin "use server" a propósito: nada de este módulo debe ser invocable desde
// el navegador. Lo usan las Server Actions de conversaciones/actions.ts
// (después de validar la sesión) y los procesos internos de confianza
// (worker de IA, motor de Workflows), que ya validaron el instanciaId.
import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { EventosSistema, ComandosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { moverOportunidadAEtapa } from "@/crm/pipeline/mover-stage";
import { EnviarMensajeSchema } from "./schema";

export interface EnviarMensajeInternoInput {
  conversacionId: string;
  contenido?: string;
  tipo?: string;
  esNotaInterna?: boolean;
  usuarioId?: string;
  mediaUrl?: string;
  /** Instancia ya validada por el llamador. La conversación DEBE pertenecerle. */
  instanciaId: string;
  /** "WORKFLOW": un Workflow solo cambia de etapa con su nodo "Mover etapa"
   *  explícito (D2), así que su mensaje no dispara el movimiento automático
   *  por primera respuesta. */
  origen?: "WORKFLOW";
}

export type ResultadoEnvio = { ok: true; mensaje: { id: string } } | { ok: false; error: string };

export async function enviarMensajeInterno(input: EnviarMensajeInternoInput): Promise<ResultadoEnvio> {
  try {
    const validado = EnviarMensajeSchema.parse(input);

    const conversacion = await prisma.conversacion.findUniqueOrThrow({
      where: { id: validado.conversacionId },
      include: { cuentaCanal: true, contacto: true },
    });

    // Aislamiento multi-tenant: nunca se confía en la conversación por su solo id.
    if (conversacion.instanciaId !== input.instanciaId) {
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

    // Cubre tanto una respuesta manual de un agente humano como una respuesta
    // automática de IA — las notas internas no cuentan como "responder al contacto".
    if (!validado.esNotaInterna && input.origen !== "WORKFLOW") {
      await procesarPrimeraRespuestaProspecto(validado.conversacionId, mensaje.id);
    }

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

    // Fuera de un request de Next (worker) revalidatePath lanza: best effort.
    try {
      revalidatePath(`/crm/oportunidades`);
    } catch { /* fuera de request context */ }
    return { ok: true, mensaje: { id: mensaje.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar mensaje" };
  }
}

// ── Primera respuesta a un prospecto → mover etapa automáticamente ─────────
//
// Config por CuentaCanal.stageIdRespuestaAutomatica (dropdown "Al responder
// por primera vez, mover prospecto a:" en cada panel de integración). Se
// llama desde AMBOS puntos donde nace un mensaje saliente hacia el contacto:
// enviarMensajeInterno (respuesta manual de un agente o automática de IA) y
// registrarMensajeAppNativa (respuesta enviada desde la app nativa del canal,
// fuera de Karia). Deliberadamente resiliente: un error acá nunca debe impedir
// que el mensaje se termine de enviar/registrar.
export async function procesarPrimeraRespuestaProspecto(conversacionId: string, mensajeRecienCreadoId: string) {
  try {
    const conversacion = await prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { cuentaCanalId: true },
    });
    if (!conversacion?.cuentaCanalId) return;

    const cuentaCanal = await prisma.cuentaCanal.findUnique({
      where: { id: conversacion.cuentaCanalId },
      select: { stageIdRespuestaAutomatica: true },
    });
    if (!cuentaCanal?.stageIdRespuestaAutomatica) return;

    // "Primera respuesta" = no hay otro mensaje saliente previo (agente
    // humano o app nativa) en esta conversación. Las notas internas
    // (remitente SISTEMA) y los mensajes del propio contacto no cuentan —
    // el llamador ya filtra notas internas antes de invocar esto.
    const respuestasPrevias = await prisma.mensajeConversacion.count({
      where: {
        conversacionId,
        remitente: { in: ["AGENTE", "AGENTE_CANAL_NATIVO"] },
        id: { not: mensajeRecienCreadoId },
      },
    });
    if (respuestasPrevias > 0) return;

    // Misma resolución de "oportunidad activa de la conversación" que usa
    // el endpoint de contexto de IA (src/app/api/conversaciones/[id]/contexto/route.ts).
    const oportunidadConv = await prisma.oportunidadConversacion.findFirst({
      where: { conversacionId, esActiva: true },
      orderBy: { creadoEn: "desc" },
      include: { oportunidad: { select: { id: true, stageId: true } } },
    });
    const oportunidad = oportunidadConv?.oportunidad;
    if (!oportunidad?.stageId) return;

    const stageActual = await prisma.pipelineStage.findUnique({
      where: { id: oportunidad.stageId },
      select: { esInicial: true },
    });
    if (!stageActual?.esInicial) return; // ya no está en la etapa inicial — no tocar

    const stageDestino = await prisma.pipelineStage.findUnique({
      where: { id: cuentaCanal.stageIdRespuestaAutomatica },
      select: { id: true, pipelineId: true, nombre: true },
    });
    if (!stageDestino || stageDestino.id === oportunidad.stageId) return;

    const resultado = await moverOportunidadAEtapa({
      oportunidadId: oportunidad.id,
      stageId: stageDestino.id,
      pipelineId: stageDestino.pipelineId,
      origen: { tipo: "SISTEMA" },
      motivo: "Primera respuesta al prospecto",
    });
    if (resultado.exito) {
      await registrarEventoConversacion(conversacionId, "ETAPA_AUTOMATICA", { etapaNombre: stageDestino.nombre });
    } else {
      // Ej. el stage destino tiene campos personalizados requeridos sin
      // completar — skip silencioso, una automatización no puede pedirle al
      // usuario que los complete en este instante.
      console.error(
        `[procesarPrimeraRespuestaProspecto] No se pudo mover oportunidad ${oportunidad.id}: ${resultado.error}`
      );
    }
  } catch (e) {
    console.error("[procesarPrimeraRespuestaProspecto] Error inesperado:", e);
  }
}

// ── Eventos de ciclo de vida ────────────────────────────────────────────────

export type TipoEventoConversacion = "CERRADA" | "REABIERTA" | "RESPONDIDA" | "ETAPA_AUTOMATICA";

export async function registrarEventoConversacion(
  conversacionId: string,
  tipo: TipoEventoConversacion,
  detalle?: { usuarioNombre?: string; etapaNombre?: string }
) {
  await prisma.mensajeConversacion.create({
    data: {
      conversacionId,
      tipo: "EVENTO_SISTEMA",
      remitente: "SISTEMA",
      estado: "ENVIADO",
      esNotaInterna: false,
      contenido: JSON.stringify({ tipo, usuarioNombre: detalle?.usuarioNombre ?? null, etapaNombre: detalle?.etapaNombre ?? null }),
    },
  });
}

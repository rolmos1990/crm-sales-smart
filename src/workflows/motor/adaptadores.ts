import { prisma } from "@/shared/db/prisma";
import { moverOportunidadAEtapa } from "@/crm/pipeline/mover-stage";
import { enviarMensajeInterno } from "@/conversaciones/envio";
import { encolarEmail } from "@/lib/email/encolar-email";
import { CAMPOS_ACTUALIZABLES } from "../definicion/schema";
import { ErrorDefinitivoWorkflow, type AdaptadoresEjecucion } from "./tipos";

// Implementación real de la frontera del motor: reutiliza los servicios
// existentes de Karia (envío de mensajes, movimiento de etapa, IA), nunca
// versiones paralelas.

export function crearAdaptadoresReales(iniciar: AdaptadoresEjecucion["iniciarWorkflow"]): AdaptadoresEjecucion {
  return {
    async enviarMensaje({ instanciaId, conversacionId, texto, mediaUrl }) {
      const r = await enviarMensajeInterno({
        conversacionId,
        instanciaId,
        contenido: texto,
        mediaUrl,
        tipo: mediaUrl ? "IMAGEN" : "TEXTO",
        origen: "WORKFLOW",
      });
      if (!r.ok) {
        if (r.error === "Conversación no encontrada") throw new ErrorDefinitivoWorkflow(r.error);
        throw new Error(r.error);
      }
      return { mensajeId: r.mensaje.id };
    },

    async obtenerPlantilla({ instanciaId, plantillaId }) {
      const p = await prisma.plantillaCRM.findFirst({
        where: { id: plantillaId, instanciaId, activo: true },
        select: { contenidoTexto: true, imagenUrl: true },
      });
      return p ? { texto: p.contenidoTexto ?? "", imagenUrl: p.imagenUrl } : null;
    },

    moverEtapa({ instanciaId, oportunidadId, pipelineId, stageId, motivo, ejecucionId }) {
      return moverOportunidadAEtapa({
        oportunidadId,
        pipelineId,
        stageId,
        instanciaId,
        motivo,
        origen: { tipo: "WORKFLOW", ejecucionWorkflowId: ejecucionId },
      });
    },

    async responderConAgente(p) {
      const { responderConAgente } = await import("@/ai/respuesta/responder-con-agente");
      return responderConAgente(p);
    },

    async hayMensajeClientePendiente(conversacionId) {
      const ultimo = await prisma.mensajeConversacion.findFirst({
        where: { conversacionId, esNotaInterna: false, tipo: { not: "EVENTO_SISTEMA" } },
        orderBy: { creadoEn: "desc" },
        select: { remitente: true },
      });
      return ultimo?.remitente === "CONTACTO";
    },

    async crearTarea({ instanciaId, oportunidadId, contactoId, titulo, descripcion, usuarioInstanciaId, vence, prioridad, ejecucionId }) {
      const usuario = await usuarioDeInstancia(usuarioInstanciaId, instanciaId);
      const actividad = await prisma.actividad.create({
        data: {
          tipo: "TAREA",
          titulo: titulo.slice(0, 200),
          descripcion: descripcion ?? null,
          fecha: vence,
          prioridad,
          instanciaId,
          oportunidadId,
          contactoId,
          usuarioInstanciaId: usuario?.id ?? null,
          usuarioId: usuario?.usuarioId ?? null,
          metadata: { workflowEjecucionId: ejecucionId },
        },
        select: { id: true },
      });
      return { actividadId: actividad.id };
    },

    // Aún no existe un modelo de notificaciones in-app: el aviso queda como
    // tarea de prioridad alta asignada al destinatario (aparece en sus
    // Actividades) y, si se pide, también por email.
    async notificar({ instanciaId, oportunidadId, usuarioInstanciaId, mensaje, email, ejecucionId }) {
      const usuario = await usuarioDeInstancia(usuarioInstanciaId, instanciaId);
      await prisma.actividad.create({
        data: {
          tipo: "TAREA",
          titulo: `Aviso: ${mensaje}`.slice(0, 200),
          descripcion: mensaje,
          fecha: new Date(),
          prioridad: "ALTA",
          instanciaId,
          oportunidadId,
          usuarioInstanciaId: usuario?.id ?? null,
          usuarioId: usuario?.usuarioId ?? null,
          metadata: { workflowEjecucionId: ejecucionId, notificacion: true },
        },
      });
      if (email && usuario?.email) {
        await encolarEmail(
          { tipo: "NOTIFICACION", data: { titulo: "Aviso de un Workflow", cuerpo: mensaje } },
          { destinatario: usuario.email, instanciaId },
        );
      }
    },

    async actualizarOportunidad({ instanciaId, oportunidadId, cambios }) {
      const op = await prisma.oportunidad.findFirst({ where: { id: oportunidadId, instanciaId }, select: { metadata: true } });
      if (!op) throw new ErrorDefinitivoWorkflow("La oportunidad ya no existe");

      const data: Record<string, unknown> = {};
      const metadata = { ...((op.metadata as Record<string, unknown> | null) ?? {}) };
      let tocaMetadata = false;
      for (const { campo, valor } of cambios) {
        if (campo.startsWith("campo:")) {
          metadata[campo.slice("campo:".length)] = valor;
          tocaMetadata = true;
          continue;
        }
        if (!(CAMPOS_ACTUALIZABLES as readonly string[]).includes(campo)) throw new ErrorDefinitivoWorkflow(`Campo no permitido: ${campo}`);
        if (campo === "titulo") data.titulo = valor.slice(0, 200);
        else if (campo === "notas") data.notas = valor;
        else if (campo === "valor" || campo === "probabilidad") {
          const n = Number(valor);
          if (!Number.isFinite(n)) throw new ErrorDefinitivoWorkflow(`Valor numérico inválido para ${campo}: "${valor}"`);
          data[campo] = campo === "probabilidad" ? Math.max(0, Math.min(100, Math.round(n))) : n;
        } else if (campo === "responsable") {
          const usuario = await usuarioDeInstancia(valor, instanciaId);
          if (!usuario) throw new ErrorDefinitivoWorkflow("El responsable elegido ya no existe");
          data.usuarioInstanciaId = usuario.id;
          data.usuarioId = usuario.usuarioId;
        } else if (campo === "agregarEtiqueta" || campo === "quitarEtiqueta") {
          const tag = await prisma.tag.findFirst({ where: { id: valor, instanciaId }, select: { id: true } });
          if (!tag) throw new ErrorDefinitivoWorkflow("La etiqueta elegida ya no existe");
          if (campo === "agregarEtiqueta") {
            await prisma.oportunidadTag.upsert({
              where: { oportunidadId_tagId: { oportunidadId, tagId: tag.id } },
              create: { oportunidadId, tagId: tag.id },
              update: {},
            });
          } else {
            await prisma.oportunidadTag.deleteMany({ where: { oportunidadId, tagId: tag.id } });
          }
        }
      }
      if (tocaMetadata) data.metadata = metadata;
      if (Object.keys(data).length > 0) await prisma.oportunidad.update({ where: { id: oportunidadId }, data });
    },

    async asignarHumano({ instanciaId, conversacionId, oportunidadId, usuarioInstanciaId, motivo, ejecucionId }) {
      const usuario = await usuarioDeInstancia(usuarioInstanciaId, instanciaId);
      if (conversacionId) {
        await prisma.conversacion.updateMany({
          where: { id: conversacionId, instanciaId },
          data: {
            modoAtencion: "HUMANO",
            atencionDesde: new Date(),
            atencionMotivo: motivo ?? "Asignada por un Workflow",
            atencionUsuarioId: usuario?.id ?? null,
            atencionEjecucionId: null,
          },
        });
        await registrarCambioAtencionChat(conversacionId, "HUMANO", motivo ?? "Asignada por un Workflow");
      }
      if (oportunidadId && usuario) {
        await prisma.oportunidad.updateMany({
          where: { id: oportunidadId, instanciaId },
          data: { usuarioInstanciaId: usuario.id, usuarioId: usuario.usuarioId },
        });
      }
      void ejecucionId;
    },

    iniciarWorkflow: iniciar,
  };
}

async function usuarioDeInstancia(usuarioInstanciaId: string | null, instanciaId: string) {
  if (!usuarioInstanciaId) return null;
  const ui = await prisma.usuarioInstancia.findFirst({
    where: { id: usuarioInstanciaId, instanciaId, activo: true },
    select: { id: true, usuarioId: true, usuario: { select: { email: true } } },
  });
  return ui ? { id: ui.id, usuarioId: ui.usuarioId, email: ui.usuario.email } : null;
}

/** Evento visible en el chat cuando cambia quién atiende (D6). */
export async function registrarCambioAtencionChat(conversacionId: string, a: string, motivo?: string | null, usuarioNombre?: string | null) {
  await prisma.mensajeConversacion.create({
    data: {
      conversacionId,
      tipo: "EVENTO_SISTEMA",
      remitente: "SISTEMA",
      estado: "ENVIADO",
      esNotaInterna: false,
      contenido: JSON.stringify({ tipo: "ATENCION_CAMBIADA", a, motivo: motivo ?? null, usuarioNombre: usuarioNombre ?? null }),
    },
  });
}

import { prisma } from "@/shared/db/prisma";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";

/**
 * Procesa una reacción entrante de WhatsApp (del contacto hacia un mensaje).
 * Se llama desde messages.upsert cuando el mensaje tiene reactionMessage.
 *
 * En WhatsApp un contacto solo puede tener UNA reacción activa por mensaje.
 * Si cambia de emoji, el anterior se reemplaza. Si envía "" elimina la reacción.
 */
export async function procesarReaccionEntranteWA(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any,
  instanciaId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactionMsg = (msg.message as any)?.reactionMessage as {
    key?: { id?: string; fromMe?: boolean; remoteJid?: string };
    text?: string;
  } | null | undefined;

  if (!reactionMsg) return;

  const idExternoMensaje = reactionMsg.key?.id;
  const emoji = reactionMsg.text ?? "";

  if (!idExternoMensaje) return;

  // Buscar el mensaje original en nuestra BD por su idExterno (key.id de Baileys)
  const mensajeEnBD = await prisma.mensajeConversacion.findFirst({
    where: { idExterno: idExternoMensaje },
    select: {
      id: true,
      conversacionId: true,
      conversacion: {
        select: {
          instanciaId: true,
          contacto: { select: { id: true, nombre: true, apellido: true } },
        },
      },
    },
  });

  if (!mensajeEnBD) {
    console.log(`[WA Reaccion] Mensaje original key.id=${idExternoMensaje} no encontrado en BD`);
    return;
  }

  const contacto = mensajeEnBD.conversacion.contacto;

  // Eliminar reacciones previas del mismo contacto en este mensaje
  // (WhatsApp permite solo 1 reacción activa por usuario por mensaje)
  await prisma.mensajeReaccion.deleteMany({
    where: {
      mensajeId: mensajeEnBD.id,
      contactoId: contacto.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tipo: "CANAL" as any,
    },
  });

  if (emoji !== "") {
    await prisma.mensajeReaccion.create({
      data: {
        mensajeId: mensajeEnBD.id,
        emoji,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tipo: "CANAL" as any,
        contactoId: contacto.id,
        nombreUsuario: `${contacto.nombre} ${contacto.apellido}`.trim(),
        canal: "whatsapp_lite",
        idExterno: msg.key?.id as string | undefined,
      },
    });
  }

  busEventos.publicar(TIPOS_EVENTO.REACCION_ACTUALIZADA, {
    mensajeId: mensajeEnBD.id,
    conversacionId: mensajeEnBD.conversacionId,
    instanciaId,
  });

  console.log(
    `[WA Reaccion] ${emoji ? `"${emoji}"` : "(eliminada)"} de contacto ${contacto.id} → mensaje ${mensajeEnBD.id}`
  );
}

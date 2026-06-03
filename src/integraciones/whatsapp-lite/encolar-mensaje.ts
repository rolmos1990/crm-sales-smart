import { prisma } from "@/shared/db/prisma";
import { sesionManagerWA } from "./sesion-manager";

export async function encolarMensajeEntrante(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any,
  cuentaCanalId: string,
  instanciaId: string
): Promise<void> {
  const idExterno = msg.key.id as string | undefined;

  // Idempotencia: no encolar si ya existe el mensaje o ya hay un job pendiente/procesado
  if (idExterno) {
    const [yaExiste, yaEncolado] = await Promise.all([
      prisma.mensajeConversacion.findFirst({ where: { idExterno }, select: { id: true } }),
      prisma.jobMensaje.findFirst({
        where: {
          tipo: "PROCESAR_ENTRANTE",
          payload: { path: ["idExterno"], equals: idExterno },
        },
        select: { id: true },
      }),
    ]);
    if (yaExiste || yaEncolado) return;
  }

  const jid = msg.key.remoteJid ?? "";
  let identificadorContacto: string;
  if (jid.endsWith("@s.whatsapp.net")) {
    // Número real: extraer dígitos y construir E.164
    const soloNumeros = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:\d+$/, "").replace(/\D/g, "");
    identificadorContacto = soloNumeros ? `+${soloNumeros}` : jid;
  } else if (jid.endsWith("@lid")) {
    // Número privado (LID): guardar tal cual, no es un teléfono
    identificadorContacto = jid;
  } else {
    // Grupos u otros formatos: guardar el JID completo
    identificadorContacto = jid;
  }

  const message = msg.message as Record<string, unknown> | null | undefined;
  const contenido =
    (message?.conversation as string | undefined) ??
    ((message?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ??
    undefined;

  const audioMsg   = message?.audioMessage as Record<string, unknown> | undefined;
  const pttMsg     = message?.pttMessage   as Record<string, unknown> | undefined;
  const imageMsg   = message?.imageMessage  as Record<string, unknown> | undefined;

  const esAudio  = !!audioMsg || !!pttMsg;
  const esImagen = !!imageMsg;
  const esPtt    = (!!audioMsg && audioMsg?.ptt === true) || !!pttMsg;

  const tipo = esAudio
    ? (esPtt ? "NOTA_VOZ" : "AUDIO")
    : esImagen ? "IMAGEN"
    : "TEXTO";

  const pushName = (msg.pushName && msg.pushName !== "") ? msg.pushName : undefined;

  // Intentar obtener foto de perfil de WhatsApp solo si el contacto no tiene avatar aún (best-effort)
  let avatarUrl: string | undefined;
  try {
    const sesion = sesionManagerWA.obtenerPorCuenta(cuentaCanalId);
    if (sesion?.socket && jid.endsWith("@s.whatsapp.net")) {
      const soloNumeros = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:\d+$/, "").replace(/\D/g, "");
      const telefono = soloNumeros ? `+${soloNumeros}` : null;
      const yaTieneFoto = telefono
        ? await prisma.contacto.findFirst({
            where: { instanciaId, OR: [{ telefonoPrincipal: telefono }, { telefonoPrincipal: soloNumeros }] },
            select: { avatarUrl: true },
          }).then((c) => !!c?.avatarUrl)
        : false;
      if (!yaTieneFoto) {
        avatarUrl = await sesion.socket.profilePictureUrl(jid, "image");
      }
    }
  } catch { /* sesión no disponible, sin foto o privacidad activada */ }

  // Descargar y subir media en el contexto del API route (Baileys requiere módulos nativos aquí).
  // El worker recibe URLs y IDs ya resueltos en el payload.
  let mediaUrl: string | undefined;
  let mediaMimeType: string | undefined;
  let mediaDuracion: number | undefined;
  let mediaArchivoId: string | undefined;

  if (esAudio) {
    try {
      const { descargarMediaWA } = await import("./descargar-media-wa");
      const { guardarArchivoRaw } = await import("@/lib/media/services/media-raw.service");
      const descarga = await descargarMediaWA(msg);
      if (descarga) {
        const resultado = await guardarArchivoRaw({
          buffer: descarga.buffer,
          mimeType: descarga.mimeType,
          nombreArchivo: `audio-${idExterno ?? Date.now()}`,
          instanciaId,
          modulo: "conversaciones",
          canalOrigen: "whatsapp",
        });
        mediaUrl = resultado.urlOptimizada;
        mediaMimeType = descarga.mimeType;
        mediaDuracion = descarga.duracion;
      }
    } catch (e) {
      console.error("[encolarMensaje] Error descargando audio WA:", e);
    }
  }

  if (esImagen) {
    try {
      const { descargarMediaWA } = await import("./descargar-media-wa");
      const { subirImagenConversacion } = await import("@/lib/media/services/media-conversacion.service");
      const descarga = await descargarMediaWA(msg);
      if (descarga) {
        const resultado = await subirImagenConversacion({
          buffer: descarga.buffer,
          mimeTypeProveedor: descarga.mimeType,
          instanciaId,
          canal: "whatsapp",
          contactoId: null, // se completa en procesarMensajeEntrante cuando el contacto está resuelto
        });
        mediaArchivoId = resultado.mediaArchivoId;
        mediaUrl = resultado.urlThumbnail ?? resultado.urlOptimizada ?? undefined;
        mediaMimeType = "image/webp";
      }
    } catch (e) {
      console.error("[encolarMensaje] Error procesando imagen WA:", e);
    }
  }

  await prisma.jobMensaje.create({
    data: {
      tipo: "PROCESAR_ENTRANTE",
      instanciaId,
      payload: {
        canal: "whatsapp_lite",
        identificadorContacto,
        cuentaCanalId,
        instanciaId,
        contenido,
        tipo,
        idExterno,
        pushName,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(mediaMimeType ? { mediaMimeType } : {}),
        ...(mediaDuracion !== undefined ? { mediaDuracion } : {}),
        ...(mediaArchivoId ? { mediaArchivoId } : {}),
      },
    },
  });
}

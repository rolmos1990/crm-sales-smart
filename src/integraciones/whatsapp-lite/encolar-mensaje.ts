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
        tipo: "TEXTO",
        idExterno,
        pushName,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    },
  });
}

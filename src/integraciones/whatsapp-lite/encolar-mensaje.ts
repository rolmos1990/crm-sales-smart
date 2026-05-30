import { prisma } from "@/shared/db/prisma";

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
  const soloNumeros = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:\d+$/, "").replace(/\D/g, "");
  const telefono = soloNumeros ? `+${soloNumeros}` : jid;

  const message = msg.message as Record<string, unknown> | null | undefined;
  const contenido =
    (message?.conversation as string | undefined) ??
    ((message?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ??
    undefined;

  const pushName = (msg.pushName && msg.pushName !== "") ? msg.pushName : undefined;

  await prisma.jobMensaje.create({
    data: {
      tipo: "PROCESAR_ENTRANTE",
      instanciaId,
      payload: {
        canal: "whatsapp_lite",
        identificadorContacto: telefono,
        cuentaCanalId,
        instanciaId,
        contenido,
        tipo: "TEXTO",
        idExterno,
        pushName,
      },
    },
  });
}

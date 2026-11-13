import { prisma } from "@/shared/db/prisma";

/**
 * true si este comando quedó obsoleto: llegó un mensaje del cliente posterior
 * al que lo disparó, y el comando de ESE mensaje es el que debe responder.
 *
 * Sin `mensajeId` (comando publicado antes de esta feature, o por un flujo que
 * no lo informa) nunca se descarta: responder de más es preferible a no
 * responder.
 */
export async function quedoObsoleto(params: {
  conversacionId: string;
  mensajeId?: string;
}): Promise<boolean> {
  if (!params.mensajeId) return false;

  const ultimo = await prisma.mensajeConversacion.findFirst({
    where: {
      conversacionId: params.conversacionId,
      remitente: "CONTACTO",
      esNotaInterna: false,
      tipo: { not: "EVENTO_SISTEMA" },
    },
    orderBy: { creadoEn: "desc" },
    select: { id: true },
  });

  // Sin mensajes del cliente no hay con qué comparar: que siga su curso.
  if (!ultimo) return false;
  return ultimo.id !== params.mensajeId;
}

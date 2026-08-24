import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { obtenerMensajesConversacion, obtenerUltimosMensajes, obtenerMensajesAnteriores } from "@/conversaciones/queries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sesion = await requireSesion();

  // Sin esto, cualquier usuario autenticado de cualquier tenant que
  // conociera/adivinara un conversacionId podía leer la conversación de
  // otro tenant — ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md, hallazgo #2.
  const conversacion = await prisma.conversacion.findFirst({
    where: { id, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const url = new URL(req.url);
  const recientes = url.searchParams.get("recientes");
  const antes = url.searchParams.get("antes");

  if (recientes) {
    const limite = Math.min(parseInt(recientes) || 50, 200);
    const mensajes = await obtenerUltimosMensajes(id, limite);
    return NextResponse.json(mensajes);
  }

  if (antes) {
    const limite = Math.min(parseInt(url.searchParams.get("limite") || "50") || 50, 200);
    const mensajes = await obtenerMensajesAnteriores(id, antes, limite);
    return NextResponse.json(mensajes);
  }

  // Default: all messages ASC (used by panel-conversacion in oportunidades)
  const mensajes = await obtenerMensajesConversacion(id);
  return NextResponse.json(mensajes);
}

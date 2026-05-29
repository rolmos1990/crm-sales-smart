import { NextRequest, NextResponse } from "next/server";
import { obtenerMensajesConversacion, obtenerUltimosMensajes, obtenerMensajesAnteriores } from "@/conversaciones/queries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

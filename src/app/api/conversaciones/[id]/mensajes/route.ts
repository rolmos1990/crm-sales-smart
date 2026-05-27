import { NextRequest, NextResponse } from "next/server";
import { obtenerMensajesConversacion } from "@/conversaciones/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mensajes = await obtenerMensajesConversacion(id);
  return NextResponse.json(mensajes);
}

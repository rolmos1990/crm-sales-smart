import { NextRequest, NextResponse } from "next/server";
import { obtenerConversacionesContacto } from "@/conversaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";

export async function GET(req: NextRequest) {
  const sesion = await requireSesion();
  const contactoId = req.nextUrl.searchParams.get("contactoId");
  if (!contactoId) return NextResponse.json({ error: "contactoId requerido" }, { status: 400 });

  const conversaciones = await obtenerConversacionesContacto(contactoId, sesion.instanciaId);
  return NextResponse.json({ conversaciones });
}

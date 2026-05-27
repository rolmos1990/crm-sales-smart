import { NextRequest, NextResponse } from "next/server";
import { obtenerConversacionesContacto } from "@/conversaciones/queries";

export async function GET(req: NextRequest) {
  const contactoId = req.nextUrl.searchParams.get("contactoId");
  if (!contactoId) return NextResponse.json({ error: "contactoId requerido" }, { status: 400 });

  const conversaciones = await obtenerConversacionesContacto(contactoId);
  return NextResponse.json({ conversaciones });
}

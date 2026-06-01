import { NextRequest, NextResponse } from "next/server";
import { obtenerPlantillas } from "@/configuracion/plantillas/queries";

export async function GET(req: NextRequest) {
  const instanciaId = req.nextUrl.searchParams.get("instanciaId");
  if (!instanciaId) {
    return NextResponse.json({ error: "instanciaId requerido" }, { status: 400 });
  }
  const plantillas = await obtenerPlantillas(instanciaId);
  return NextResponse.json(plantillas);
}

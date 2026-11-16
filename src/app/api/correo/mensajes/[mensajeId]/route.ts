// 035 — Datos de correo de un mensaje, para la página de Karia (con sesión).
//
// Devuelve cabeceras, estado del HTML, adjuntos y las URLs firmadas de la
// vista aislada. El HTML en sí NO sale por acá: solo por la ruta de vista,
// hacia el iframe con sandbox. Ver contracts/rutas-http.md §1.
import { NextRequest, NextResponse } from "next/server";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { obtenerMensajeCorreoParaSesion } from "@/integraciones/email/vista/queries";
import { construirRespuestaCorreo } from "@/integraciones/email/vista/respuesta";
import { origenPublico } from "@/integraciones/email/vista/documento";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

function noEncontrado() {
  return NextResponse.json({ error: "No encontrado" }, { status: 404, headers: SIN_CACHE });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ mensajeId: string }> }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return noEncontrado();

  const { mensajeId } = await params;
  const datos = await obtenerMensajeCorreoParaSesion(mensajeId, sesion.instanciaId);
  if (!datos) return noEncontrado();

  const respuesta = construirRespuestaCorreo(datos, sesion.instanciaId, origenPublico(req.nextUrl.origin));
  return NextResponse.json(respuesta, { headers: SIN_CACHE });
}

// 035 — Imagen externa de un correo, descargada por Karia (proxy SSRF-seguro).
//
// Solo se pide cuando el agente eligió "Cargar imágenes". El token trae un
// ÍNDICE, no una URL: el navegador no puede pedir una dirección arbitraria,
// solo alguna de las que el propio correo traía. Cualquier rechazo → 404 sin
// detalle; el motivo va al log, sin la URL.
import { NextRequest } from "next/server";
import { verificarToken } from "@/integraciones/email/vista/token";
import { obtenerCorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { cabecerasImagen } from "@/integraciones/email/vista/documento";
import { descargarImagenSegura } from "@/integraciones/email/vista/proxy-imagen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noEncontrado() {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(req: NextRequest) {
  const token = verificarToken(req.nextUrl.searchParams.get("t"), "imagen");
  if (!token?.recurso || !/^\d{1,3}$/.test(token.recurso)) return noEncontrado();

  const correo = await obtenerCorreoDeMensaje(token.mensajeId, token.instanciaId);
  const url = correo?.imagenesExternas[Number(token.recurso)];
  if (!correo || !url) return noEncontrado();

  const resultado = await descargarImagenSegura(url);
  if (!resultado.ok) {
    console.warn("[correo] imagen externa rechazada", { mensajeId: correo.mensajeId, motivo: resultado.motivo });
    return noEncontrado();
  }
  return new Response(new Uint8Array(resultado.webp), { status: 200, headers: cabecerasImagen() });
}

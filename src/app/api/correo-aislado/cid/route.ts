// 035 — Imagen incrustada (cid) de un correo, para la vista aislada.
//
// Autorizada por token (el iframe no manda la sesión). Además del token, se
// exige que el cid figure en el mapa de ESE correo y que el archivo sea del
// mismo comercio. Cualquier discrepancia → 404 sin detalle.
import { NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { verificarToken } from "@/integraciones/email/vista/token";
import { obtenerCorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { cabecerasImagen } from "@/integraciones/email/vista/documento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noEncontrado() {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(req: NextRequest) {
  const token = verificarToken(req.nextUrl.searchParams.get("t"), "cid");
  if (!token?.recurso) return noEncontrado();

  const correo = await obtenerCorreoDeMensaje(token.mensajeId, token.instanciaId);
  const entrada = correo?.adjuntos.find((a) => a.cid === token.recurso);
  if (!correo || !entrada) return noEncontrado();

  const archivo = await prisma.mediaArchivo.findFirst({
    where: { id: entrada.mediaArchivoId, instanciaId: correo.instanciaId },
    select: { keyOptimizado: true, mimeOptimizado: true },
  });
  // Solo imágenes procesadas por Karia (webp): nunca se sirve un archivo crudo.
  if (!archivo || archivo.mimeOptimizado !== "image/webp") return noEncontrado();

  try {
    const descarga = await getStorageProvider().download(archivo.keyOptimizado);
    if (!descarga) return noEncontrado();
    return new Response(new Uint8Array(descarga.buffer), { status: 200, headers: cabecerasImagen() });
  } catch {
    console.warn("[correo] no se pudo leer una imagen cid", { mensajeId: correo.mensajeId });
    return noEncontrado();
  }
}

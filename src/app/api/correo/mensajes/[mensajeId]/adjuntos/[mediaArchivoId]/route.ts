// 035 — Descarga de un adjunto de correo (con sesión).
//
// Siempre como DESCARGA y como `application/octet-stream`: un adjunto HTML,
// SVG o similar nunca se abre ni se interpreta dentro de Karia (FR-025).
// El adjunto tiene que pertenecer a ESE mensaje y al comercio de la sesión.
import { NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { obtenerMensajeCorreoParaSesion } from "@/integraciones/email/vista/queries";
import { conExtension, contentDispositionAdjunto, nombreDescarga } from "@/integraciones/email/vista/descarga";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noEncontrado() {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mensajeId: string; mediaArchivoId: string }> },
) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return noEncontrado();

  const { mensajeId, mediaArchivoId } = await params;
  const datos = await obtenerMensajeCorreoParaSesion(mensajeId, sesion.instanciaId);
  if (!datos) return noEncontrado();

  const entrada = datos.correo?.adjuntos.find((a) => a.mediaArchivoId === mediaArchivoId);
  if (!entrada && datos.mediaArchivoId !== mediaArchivoId) return noEncontrado();

  const archivo = await prisma.mediaArchivo.findFirst({
    where: { id: mediaArchivoId, instanciaId: sesion.instanciaId },
    select: { nombreOriginal: true, keyOriginal: true, keyOptimizado: true, mimeOptimizado: true, mimeOriginal: true },
  });
  if (!archivo) return noEncontrado();

  const key = archivo.keyOriginal ?? archivo.keyOptimizado;
  let nombre = nombreDescarga(entrada?.nombre ?? archivo.nombreOriginal);
  // Las imágenes se guardan optimizadas (webp): el nombre lo dice, para que
  // el archivo descargado abra con el programa correcto.
  if (!archivo.keyOriginal && archivo.mimeOptimizado === "image/webp" && archivo.mimeOriginal !== "image/webp") {
    nombre = conExtension(nombre, ".webp");
  }

  try {
    const descarga = await getStorageProvider().download(key);
    if (!descarga) return noEncontrado();
    return new Response(new Uint8Array(descarga.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDispositionAdjunto(nombre),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    console.warn("[correo] no se pudo descargar un adjunto", { mensajeId });
    return noEncontrado();
  }
}

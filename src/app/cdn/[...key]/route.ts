import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/media/providers/factory";

/**
 * Proxy de media para proveedores S3-compatibles sin soporte de dominio
 * personalizado (ej. Hetzner Object Storage). `S3Provider.getPublicUrl()`
 * devuelve `/cdn/<key>`, que esta ruta resuelve descargando el archivo del
 * storage real y sirviéndolo bajo el dominio propio de la app — así el
 * navegador nunca ve el host del bucket (hel1.your-objectstorage.com).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segmentos } = await params;

  // Evitar path traversal / segmentos vacíos antes de tocar el storage
  if (segmentos.some((s) => !s || s === "." || s === "..")) {
    return new NextResponse(null, { status: 400 });
  }

  const key = segmentos.join("/");
  const provider = getStorageProvider();
  const archivo = await provider.download(key);

  if (!archivo) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(archivo.buffer), {
    status: 200,
    headers: {
      "Content-Type": archivo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

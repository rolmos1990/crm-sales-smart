import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/media/providers/factory";
import { parsearRange } from "./range";

/**
 * Proxy de media para proveedores S3-compatibles sin soporte de dominio
 * personalizado (ej. Hetzner Object Storage). `S3Provider.getPublicUrl()`
 * devuelve `/cdn/<key>`, que esta ruta resuelve descargando el archivo del
 * storage real y sirviéndolo bajo el dominio propio de la app — así el
 * navegador nunca ve el host del bucket (hel1.your-objectstorage.com).
 *
 * Admite `Range` (048): sin respuestas 206, Safari/iOS no reproduce <video> y
 * ningún navegador puede adelantar un video sin bajarlo entero.
 */
export async function GET(
  req: NextRequest,
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

  const total = archivo.buffer.length;
  const cabecerasBase = {
    "Content-Type": archivo.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  const rango = parsearRange(req.headers.get("range"), total);

  if (rango === "INVALIDO") {
    return new NextResponse(null, {
      status: 416,
      headers: { ...cabecerasBase, "Content-Range": `bytes */${total}` },
    });
  }

  if (rango) {
    const parte = archivo.buffer.subarray(rango.inicio, rango.fin + 1);
    return new NextResponse(new Uint8Array(parte), {
      status: 206,
      headers: {
        ...cabecerasBase,
        "Content-Range": `bytes ${rango.inicio}-${rango.fin}/${total}`,
        "Content-Length": String(parte.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(archivo.buffer), {
    status: 200,
    headers: { ...cabecerasBase, "Content-Length": String(total) },
  });
}

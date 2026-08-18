import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const media = await prisma.mediaArchivo.findUnique({
    where: { id },
    select: { urlOptimizada: true, estadoProcesado: true },
  });

  if (!media || media.estadoProcesado !== "LISTO") {
    return new NextResponse(null, { status: 404 });
  }

  // Detrás de Coolify/Traefik el Host real no siempre llega al contenedor,
  // así que `req.url` puede resolver a `http://localhost:80` (mismo problema
  // que tuvimos con el redirect_uri de Instagram). Para URLs relativas
  // (proveedor local) se usa APP_URL como base y solo se cae a `req.nextUrl.origin`
  // si esa variable no está configurada.
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const destino = media.urlOptimizada.startsWith("http")
    ? media.urlOptimizada
    : new URL(media.urlOptimizada, appUrl).toString();

  return NextResponse.redirect(destino, {
    status: 301,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

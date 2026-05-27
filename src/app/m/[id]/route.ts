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

  const destino = media.urlOptimizada.startsWith("http")
    ? media.urlOptimizada
    : new URL(media.urlOptimizada, req.url).toString();

  return NextResponse.redirect(destino, {
    status: 301,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

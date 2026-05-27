import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url requerida" }, { status: 400 });
  }

  const media = await prisma.mediaArchivo.findFirst({
    where: { urlOptimizada: url },
    select: { id: true },
  });

  if (!media) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ id: media.id, urlPublica: `/m/${media.id}` });
}

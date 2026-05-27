import { NextRequest, NextResponse } from "next/server";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { procesarMensajeEntrante } from "@/conversaciones/actions";
import { prisma } from "@/shared/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  const { canal } = await params;
  const provider = obtenerProvider(canal);

  if (!provider) {
    return NextResponse.json({ error: `Canal "${canal}" no configurado` }, { status: 404 });
  }

  if (!provider.validarWebhook(req)) {
    return NextResponse.json({ error: "Webhook inválido" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const normalizado = provider.mapearEntrante(raw);

  // Resolver instanciaId desde cuentaCanalId
  const cuentaCanal = await prisma.cuentaCanal.findUnique({
    where: { id: normalizado.cuentaCanalId },
    select: { instanciaId: true },
  });

  if (!cuentaCanal) {
    return NextResponse.json({ error: "Cuenta de canal no encontrada" }, { status: 404 });
  }

  await procesarMensajeEntrante({ ...normalizado, instanciaId: cuentaCanal.instanciaId });

  return NextResponse.json({ ok: true });
}

// Algunos canales requieren validación GET del webhook (ej: Meta/WhatsApp)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  const { canal } = await params;
  const { searchParams } = new URL(req.url);

  if (canal === "whatsapp_lite" || canal === "whatsapp_business" || canal === "instagram") {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

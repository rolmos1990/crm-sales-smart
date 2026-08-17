import { NextRequest, NextResponse } from "next/server";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { prisma } from "@/shared/db/prisma";
import { publicadorEventos } from "@/shared/rabbitmq";
import { TIPOS_COMANDO } from "@/shared/eventos/registro";

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

  // Idempotencia: si ya procesamos este mensaje, responder OK sin encolar de nuevo
  if (normalizado.idExterno) {
    const yaExiste = await prisma.mensajeConversacion.findFirst({
      where: { idExterno: normalizado.idExterno },
      select: { id: true },
    });
    if (yaExiste) return NextResponse.json({ ok: true });
  }

  const cuentaCanal = await prisma.cuentaCanal.findUnique({
    where: { id: normalizado.cuentaCanalId },
    select: { instanciaId: true },
  });

  if (!cuentaCanal) {
    return NextResponse.json({ error: "Cuenta de canal no encontrada" }, { status: 404 });
  }

  await publicadorEventos.publicar(TIPOS_COMANDO.PROCESAR_ENTRANTE, cuentaCanal.instanciaId, {
    ...normalizado,
    instanciaId: cuentaCanal.instanciaId,
  });

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
    const tokenValido =
      (!!process.env.WEBHOOK_VERIFY_TOKEN && token === process.env.WEBHOOK_VERIFY_TOKEN) ||
      (canal === "instagram" && !!process.env.META_INSTAGRAM_VERIFY_TOKEN && token === process.env.META_INSTAGRAM_VERIFY_TOKEN);
    if (mode === "subscribe" && tokenValido) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

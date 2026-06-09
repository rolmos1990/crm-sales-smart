import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";

export const runtime = "nodejs";

// ── Tipos del payload de Meta/Instagram ──────────────────────────────────────

interface IGMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type: string; payload: { url?: string } }>;
  };
  reaction?: {
    mid: string;
    action: "react" | "unreact";
    emoji?: string;
  };
  read?: { watermark: number };
}

interface IGWebhookPayload {
  object: "instagram" | string;
  entry?: Array<{
    id: string; // Instagram Business Account ID
    time?: number;
    messaging?: IGMessagingEvent[];
  }>;
}

// ── GET: verificación de webhook por Meta ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log(JSON.stringify({
    event: "IG_WEBHOOK_GET",
    ts: new Date().toISOString(),
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    params: { mode, token: token ? "***" : null, challenge },
  }, null, 2));

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("[IG Webhook] Verificación exitosa");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[IG Webhook] Verificación fallida — token incorrecto");
  return new Response("Forbidden", { status: 403 });
}

// ── POST: mensajes entrantes en batch de Meta ─────────────────────────────────

export async function POST(req: NextRequest) {
  const rawText = await req.text();

  console.log(JSON.stringify({
    event: "IG_WEBHOOK_POST",
    ts: new Date().toISOString(),
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    body: (() => { try { return JSON.parse(rawText); } catch { return rawText; } })(),
  }, null, 2));

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const payload = body as IGWebhookPayload;

  // Aceptar tanto "instagram" (DMs clásicos) como "page" (Instagram via Facebook Page)
  if (payload.object !== "instagram" && payload.object !== "page") {
    return NextResponse.json({ ok: true });
  }

  const provider = obtenerProvider("instagram");
  if (!provider) {
    console.error("[IG Webhook] InstagramProvider no registrado");
    return NextResponse.json({ error: "Provider no configurado" }, { status: 503 });
  }

  for (const entry of payload.entry ?? []) {
    // object:"instagram" → entry.id es el Instagram Business Account ID
    // object:"page"      → entry.id es el Facebook Page ID; buscar por configuracion.pageId
    const cuentaCanal = await (payload.object === "instagram"
      ? prisma.cuentaCanal.findFirst({
          where: { canal: "instagram", identificador: entry.id, activa: true },
          select: { id: true, instanciaId: true },
        })
      : prisma.cuentaCanal.findFirst({
          where: {
            canal: "instagram",
            activa: true,
            configuracion: { path: ["pageId"], equals: entry.id },
          },
          select: { id: true, instanciaId: true },
        })
    );

    if (!cuentaCanal) {
      console.log(`[IG Webhook] CuentaCanal no encontrada para id: ${entry.id} (object: ${payload.object})`);
      continue;
    }

    for (const event of entry.messaging ?? []) {
      // Ignorar mensajes propios (echo) y eventos de lectura
      if (event.message?.is_echo || event.read) continue;

      // Reacciones entrantes del contacto
      if (event.reaction) {
        await procesarReaccionIG(event, cuentaCanal.instanciaId);
        continue;
      }

      // Ignorar eventos sin mensaje
      if (!event.message) continue;

      const mid = event.message.mid;

      // Idempotencia: evitar duplicados si Meta reenvía el mismo webhook
      if (mid) {
        const [yaExiste, yaEncolado] = await Promise.all([
          prisma.mensajeConversacion.findFirst({ where: { idExterno: mid }, select: { id: true } }),
          prisma.jobMensaje.findFirst({
            where: { tipo: "PROCESAR_ENTRANTE", payload: { path: ["idExterno"], equals: mid } },
            select: { id: true },
          }),
        ]);
        if (yaExiste || yaEncolado) continue;
      }

      // Normalizar el evento individual
      const normalizado = provider.mapearEntrante({ ...event, cuentaCanalId: cuentaCanal.id });

      await prisma.jobMensaje.create({
        data: {
          tipo: "PROCESAR_ENTRANTE",
          instanciaId: cuentaCanal.instanciaId,
          payload: { ...normalizado, instanciaId: cuentaCanal.instanciaId },
        },
      });

      console.log(`[IG Webhook] Job encolado → mid: ${mid ?? "sin-id"} | from: ${event.sender.id}`);
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Procesamiento de reacciones entrantes desde Instagram ─────────────────────

async function procesarReaccionIG(event: IGMessagingEvent, instanciaId: string): Promise<void> {
  const reaction = event.reaction!;
  const idExternoMensaje = reaction.mid;
  const emoji = reaction.emoji ?? "";

  // Buscar el mensaje original en nuestra BD
  const mensajeEnBD = await prisma.mensajeConversacion.findFirst({
    where: { idExterno: idExternoMensaje },
    select: {
      id: true,
      conversacionId: true,
      conversacion: {
        select: {
          contacto: { select: { id: true, nombre: true, apellido: true } },
        },
      },
    },
  });

  if (!mensajeEnBD) {
    console.log(`[IG Reacción] Mensaje original mid=${idExternoMensaje} no encontrado en BD`);
    return;
  }

  const contacto = mensajeEnBD.conversacion.contacto;

  // En Instagram un contacto solo puede tener una reacción activa por mensaje
  await prisma.mensajeReaccion.deleteMany({
    where: {
      mensajeId: mensajeEnBD.id,
      contactoId: contacto.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tipo: "CANAL" as any,
    },
  });

  if (reaction.action === "react" && emoji !== "") {
    await prisma.mensajeReaccion.create({
      data: {
        mensajeId: mensajeEnBD.id,
        emoji,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tipo: "CANAL" as any,
        contactoId: contacto.id,
        nombreUsuario: `${contacto.nombre} ${contacto.apellido}`.trim(),
        canal: "instagram",
      },
    });
  }

  busEventos.publicar(TIPOS_EVENTO.REACCION_ACTUALIZADA, {
    mensajeId: mensajeEnBD.id,
    conversacionId: mensajeEnBD.conversacionId,
    instanciaId,
  });

  console.log(
    `[IG Reacción] ${emoji ? `"${emoji}"` : "(eliminada)"} de ${contacto.id} → mensaje ${mensajeEnBD.id}`
  );
}

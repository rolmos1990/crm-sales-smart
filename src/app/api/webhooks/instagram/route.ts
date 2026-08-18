import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { obtenerProvider } from "@/conversaciones/providers/registry";
import { TIPOS_EVENTO, TIPOS_COMANDO } from "@/shared/eventos/registro";
import { publicadorEventos } from "@/shared/rabbitmq";
import { resolverApiBaseIG } from "@/conversaciones/providers/instagram-estrategia-auth";

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

// ── Perfil del remitente (nombre + foto) ──────────────────────────────────────
//
// El payload del webhook de mensajería NO trae nombre ni foto del remitente
// (solo su IGSID) — hay que pedirlos aparte a Graph API con el token de la
// cuenta conectada. Solo se llama cuando el contacto todavía no tiene nombre
// o foto guardados (ver uso más abajo), para no gastar cuota de API en cada
// mensaje de gente que ya conocemos.
async function obtenerPerfilRemitenteIG(
  igsid: string,
  cuentaCanal: { configuracion: unknown },
): Promise<{ pushName?: string; avatarUrl?: string; handleCanal?: string }> {
  const cfg = cuentaCanal.configuracion as { accessToken?: string; proveedorAuth?: string } | null;
  if (!cfg?.accessToken) return {};

  const apiBase = resolverApiBaseIG(cfg.proveedorAuth);

  try {
    const res = await fetch(
      `${apiBase}/${igsid}?fields=name,username,profile_pic&access_token=${encodeURIComponent(cfg.accessToken)}`,
      { cache: "no-store" },
    );
    const data = (await res.json().catch(() => ({}))) as {
      name?: string;
      username?: string;
      profile_pic?: string;
      error?: unknown;
    };
    if (!res.ok || data.error) {
      console.warn(`[IG Webhook] No se pudo obtener el perfil de ${igsid}:`, data.error ?? `HTTP ${res.status}`);
      return {};
    }
    return {
      pushName: data.name || data.username || undefined,
      avatarUrl: data.profile_pic || undefined,
      // Se guarda aparte del nombre para mostrar el @usuario aunque el
      // contacto tenga un nombre real (data.name) como nombre de pila.
      handleCanal: data.username || undefined,
    };
  } catch (e) {
    console.warn(`[IG Webhook] Error de red obteniendo perfil de ${igsid}:`, e);
    return {};
  }
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

  // Acepta el verify token compartido (WEBHOOK_VERIFY_TOKEN) o uno dedicado
  // para la app de Instagram Login (META_INSTAGRAM_VERIFY_TOKEN), por si se
  // configuró uno distinto al registrar el webhook en esa app de Meta.
  const tokenValido =
    (!!process.env.WEBHOOK_VERIFY_TOKEN && token === process.env.WEBHOOK_VERIFY_TOKEN) ||
    (!!process.env.META_INSTAGRAM_VERIFY_TOKEN && token === process.env.META_INSTAGRAM_VERIFY_TOKEN);

  if (mode === "subscribe" && tokenValido) {
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
          select: { id: true, instanciaId: true, configuracion: true },
        })
      : prisma.cuentaCanal.findFirst({
          where: {
            canal: "instagram",
            activa: true,
            configuracion: { path: ["pageId"], equals: entry.id },
          },
          select: { id: true, instanciaId: true, configuracion: true },
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
        const yaExiste = await prisma.mensajeConversacion.findFirst({ where: { idExterno: mid }, select: { id: true } });
        if (yaExiste) continue;
      }

      // Normalizar el evento individual
      const normalizado = provider.mapearEntrante({ ...event, cuentaCanalId: cuentaCanal.id });

      // Si el contacto ya existe y ya tiene nombre + foto, no vale la pena
      // gastar una llamada a Graph API por cada mensaje suyo.
      const contactoConocido = await prisma.contactoIdentificadorCanal.findUnique({
        where: {
          canal_identificador_instanciaId: {
            canal: "instagram",
            identificador: event.sender.id,
            instanciaId: cuentaCanal.instanciaId,
          },
        },
        select: { contacto: { select: { nombre: true, avatarUrl: true } } },
      });
      const faltaPerfil = !contactoConocido || !contactoConocido.contacto.nombre || !contactoConocido.contacto.avatarUrl;

      const perfil = faltaPerfil ? await obtenerPerfilRemitenteIG(event.sender.id, cuentaCanal) : {};

      await publicadorEventos.publicar(TIPOS_COMANDO.PROCESAR_ENTRANTE, cuentaCanal.instanciaId, {
        ...normalizado,
        ...perfil,
        instanciaId: cuentaCanal.instanciaId,
      });

      console.log(`[IG Webhook] Mensaje encolado → mid: ${mid ?? "sin-id"} | from: ${event.sender.id}`);
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

  void publicadorEventos.publicar(TIPOS_EVENTO.REACCION_ACTUALIZADA, instanciaId, {
    mensajeId: mensajeEnBD.id,
    conversacionId: mensajeEnBD.conversacionId,
    instanciaId,
  });

  console.log(
    `[IG Reacción] ${emoji ? `"${emoji}"` : "(eliminada)"} de ${contacto.id} → mensaje ${mensajeEnBD.id}`
  );
}

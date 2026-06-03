import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sesionManagerWA } from "@/integraciones/whatsapp-lite/sesion-manager";
import { prisma } from "@/shared/db/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { instanciaId, nombre, pipelineId, stageId } = await req.json() as {
    instanciaId: string;
    nombre: string;
    pipelineId?: string;
    stageId?: string;
  };
  if (!instanciaId || !nombre?.trim()) {
    return NextResponse.json({ error: "instanciaId y nombre son requeridos" }, { status: 400 });
  }

  const sessionId = randomUUID();
  sesionManagerWA.crear(sessionId);

  // Iniciar Baileys en background — propaga errores al session manager para que el SSE los reciba
  iniciarSesionBaileys(sessionId, instanciaId, nombre.trim(), pipelineId, stageId).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "Error iniciando sesión";
    console.error("[WA Sesión] Error:", msg, e);
    sesionManagerWA.emitirError(sessionId, msg);
  });

  return NextResponse.json({ sessionId });
}

export async function DELETE(req: NextRequest) {
  const { sessionId, cuentaId } = await req.json() as { sessionId?: string; cuentaId?: string };

  if (sessionId) {
    sesionManagerWA.eliminar(sessionId);
  }

  if (cuentaId) {
    await prisma.cuentaCanal.update({ where: { id: cuentaId }, data: { activa: false } });
  }

  return NextResponse.json({ ok: true });
}

// ── Baileys session bootstrap ───────────────────────────────────────────────

async function iniciarSesionBaileys(
  sessionId: string,
  instanciaId: string,
  nombre: string,
  pipelineId?: string,
  stageId?: string,
) {
  // Dynamic imports to keep Baileys out of the webpack bundle
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } =
    await import("@whiskeysockets/baileys");
  const { default: pino } = await import("pino");
  const { toDataURL } = await import("qrcode");

  const authPath = sesionManagerWA.obtenerRutaAuth(sessionId);

  async function conectar() {
    const sesion = sesionManagerWA.obtener(sessionId);
    if (!sesion) return; // sesión eliminada por el usuario

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
      getMessage: async (_key) => undefined, // fallback para reenvíos internos de Baileys
    });

    sesion.socket = socket;
    sesion.estado = "qr_pendiente";

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await toDataURL(qr, { width: 280, margin: 2 });
          sesionManagerWA.emitirQR(sessionId, qrDataUrl);
        } catch (e) {
          console.error("[WA QR]", e);
        }
      }

      if (connection === "open") {
        // Guardia contra el doble "open" que Baileys dispara tras el ciclo close(515)+reconexión
        const sesionActual = sesionManagerWA.obtener(sessionId);
        if (sesionActual?.cuentaCanalId) return;

        const jid = socket.user?.id ?? "";
        const telefono = jid.split(":")[0].split("@")[0];
        const telefonoFormateado = `+${telefono}`;

        try {
          const cuenta = await prisma.cuentaCanal.create({
            data: {
              instanciaId,
              canal: "whatsapp_lite",
              nombre,
              identificador: telefonoFormateado,
              configuracion: { sessionId, authPath },
              activa: true,
              ...(pipelineId ? { pipelineId } : {}),
              ...(stageId ? { stageId } : {}),
            },
          });
          const s = sesionManagerWA.obtener(sessionId);
          if (s) s.cuentaCanalId = cuenta.id;
          sesionManagerWA.emitirConectado(sessionId, telefonoFormateado);
        } catch (e) {
          console.error("[WA] Error guardando CuentaCanal:", e);
          const msg = e instanceof Error ? e.message : "Error guardando número en base de datos";
          sesionManagerWA.emitirError(sessionId, msg);
        }
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;

        if (loggedOut) {
          // Usuario cerró sesión desde el teléfono — limpiar memoria y marcar cuenta inactiva en BD
          const sesionActual = sesionManagerWA.obtener(sessionId);
          if (sesionActual?.cuentaCanalId) {
            prisma.cuentaCanal
              .update({ where: { id: sesionActual.cuentaCanalId }, data: { activa: false } })
              .catch((e) => console.error("[WA] Error marcando cuenta inactiva:", e));
          }
          sesionManagerWA.eliminar(sessionId);
        } else {
          // WhatsApp cerró la conexión para que reconectemos (código 515 restartRequired
          // es normal justo después de escanear el QR). Reconectar inmediatamente.
          console.log(`[WA] Reconectando sesión ${sessionId} (código ${code})…`);
          setTimeout(() => {
            conectar().catch((e: unknown) => {
              const msg = e instanceof Error ? e.message : "Error reconectando";
              console.error("[WA] Error reconectando:", msg);
              sesionManagerWA.emitirError(sessionId, msg);
            });
          }, 1000);
        }
      }
    });

    // Escuchar mensajes entrantes usando el cuentaCanalId que se asigna al conectar
    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      const sesionActual = sesionManagerWA.obtener(sessionId);
      const cuentaCanalId = sesionActual?.cuentaCanalId;
      if (!cuentaCanalId) return; // aún no se ha guardado la cuenta (antes del "open")
      for (const msg of messages) {
        if (msg.key.remoteJid === "status@broadcast") continue;
        if (msg.key.remoteJid?.endsWith("@g.us")) continue; // ignorar mensajes de grupos

        // Reacción entrante del contacto (no del agente)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const esReaccion = !!(msg.message as any)?.reactionMessage;
        if (esReaccion && !msg.key.fromMe) {
          try {
            const { procesarReaccionEntranteWA } = await import("@/integraciones/whatsapp-lite/procesar-reaccion-wa");
            await procesarReaccionEntranteWA(msg, instanciaId);
          } catch (e) {
            console.error("[WA Sesión] Error procesando reacción entrante:", e);
          }
          continue;
        }

        if (msg.key.fromMe) continue;
        try {
          const { encolarMensajeEntrante } = await import("@/integraciones/whatsapp-lite/encolar-mensaje");
          await encolarMensajeEntrante(msg, cuentaCanalId, instanciaId);
        } catch (e) {
          console.error("[WA Sesión] Error encolando mensaje entrante:", e);
        }
      }
    });
  }

  await conectar();
}

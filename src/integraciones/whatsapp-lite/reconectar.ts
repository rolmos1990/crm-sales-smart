import fs from "fs";

interface OpcionesReconexion {
  // Cuando es true, solo crea el socket para envío — no registra el listener
  // de mensajes entrantes. Usar en el worker para evitar duplicar el procesamiento
  // que ya hace Next.js.
  soloEnvio?: boolean;
}

// Reconecta todas las sesiones de WhatsApp Lite que tienen auth guardado en disco.
// Se llama una sola vez al arrancar el servidor (globalThis guard).
export async function reconectarSesionesWA(opciones: OpcionesReconexion = {}): Promise<void> {
  const guardKey = opciones.soloEnvio ? "_waReconectWorkerIniciado" : "_waReconectIniciado";
  const g = globalThis as Record<string, unknown>;
  if (g[guardKey]) return;
  g[guardKey] = true;

  try {
    const { prisma } = await import("@/shared/db/prisma");
    const cuentas = await prisma.cuentaCanal.findMany({
      where: { canal: "whatsapp_lite", activa: true },
      select: { id: true, nombre: true, instanciaId: true, configuracion: true },
    });

    for (const cuenta of cuentas) {
      const cfg = cuenta.configuracion as { sessionId?: string; authPath?: string } | null;
      if (!cfg?.sessionId || !cfg?.authPath) continue;
      if (!fs.existsSync(cfg.authPath)) {
        console.log(`[WA Reconect] Sin auth en disco para "${cuenta.nombre}", omitiendo`);
        continue;
      }
      console.log(`[WA Reconect] Reconectando "${cuenta.nombre}"${opciones.soloEnvio ? " (solo envío)" : ""}…`);
      reconectarSocket(cfg.sessionId, cuenta.id, cuenta.instanciaId, cfg.authPath, opciones).catch((e) =>
        console.error(`[WA Reconect] Error en "${cuenta.nombre}":`, e)
      );
    }
  } catch (e) {
    console.error("[WA Reconect] Error leyendo cuentas:", e);
  }
}

async function reconectarSocket(
  sessionId: string,
  cuentaCanalId: string,
  instanciaId: string,
  authPath: string,
  opciones: OpcionesReconexion = {}
): Promise<void> {
  const { sesionManagerWA } = await import("./sesion-manager");

  // No reconectar si ya está activa en memoria
  const existente = sesionManagerWA.obtener(sessionId);
  if (existente?.estado === "conectado") return;

  // Crear (o reutilizar) entrada en el manager
  if (!existente) sesionManagerWA.crear(sessionId);

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    await import("@whiskeysockets/baileys");
  const { default: pino } = await import("pino");

  async function conectar() {
    const sesion = sesionManagerWA.obtener(sessionId);
    if (!sesion) return;

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Vento", "Chrome", "22.04.4"] as [string, string, string],
      syncFullHistory: false,
      getMessage: async (_key) => undefined, // fallback para reenvíos internos de Baileys
    });

    sesion.socket = socket;
    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Auth expiró — no podemos reconectar sin escanear QR de nuevo
        console.warn(`[WA Reconect] Auth expirado para "${cuentaCanalId}", marcando cuenta inactiva`);
        try {
          const { prisma } = await import("@/shared/db/prisma");
          await prisma.cuentaCanal.update({ where: { id: cuentaCanalId }, data: { activa: false } });
        } catch { /* ignore */ }
        sesionManagerWA.eliminar(sessionId);
        return;
      }

      if (connection === "open") {
        sesion.estado = "conectado";
        sesion.cuentaCanalId = cuentaCanalId;
        console.log(`[WA Reconect] Reconectado exitosamente: "${cuentaCanalId}"`);
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          // Reintento con backoff de 5 s
          setTimeout(() => conectar().catch(console.error), 5_000);
        } else {
          console.log(`[WA Reconect] Sesión cerrada (loggedOut) para "${cuentaCanalId}"`);
          sesionManagerWA.eliminar(sessionId);
        }
      }
    });

    // En modo solo-envío (worker) no escuchar mensajes entrantes — Next.js ya los procesa.
    if (!opciones.soloEnvio) {
      socket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          if (msg.key.remoteJid === "status@broadcast") continue;
          if (msg.key.remoteJid?.endsWith("@g.us")) continue; // ignorar mensajes de grupos

          // Reacción entrante del contacto
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const esReaccion = !!(msg.message as any)?.reactionMessage;
          if (esReaccion && !msg.key.fromMe) {
            try {
              const { procesarReaccionEntranteWA } = await import("./procesar-reaccion-wa");
              await procesarReaccionEntranteWA(msg, instanciaId);
            } catch (e) {
              console.error("[WA Reconect] Error procesando reacción entrante:", e);
            }
            continue;
          }

          if (msg.key.fromMe) continue;
          try {
            await encolarMensajeEntrante(msg, cuentaCanalId, instanciaId);
          } catch (e) {
            console.error("[WA Reconect] Error encolando mensaje entrante:", e);
          }
        }
      });
    }
  }

  await conectar();
}

async function encolarMensajeEntrante(msg: any, cuentaCanalId: string, instanciaId: string): Promise<void> {
  const { encolarMensajeEntrante: encolar } = await import("./encolar-mensaje");
  await encolar(msg, cuentaCanalId, instanciaId);
}

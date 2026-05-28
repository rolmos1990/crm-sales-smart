import path from "path";
import fs from "fs";
import type { WASocket } from "@whiskeysockets/baileys";

export type EstadoSesion = "qr_pendiente" | "conectando" | "conectado" | "desconectado" | "error";

export interface SesionWA {
  sessionId: string;
  socket: WASocket | null;
  estado: EstadoSesion;
  qrActual: string | null;       // QR como string raw de Baileys
  errorMsg: string | null;       // último error, para propagarlo al SSE que conecte tarde
  telefono: string | null;       // número detectado tras conectar
  cuentaCanalId: string | null;  // FK a CuentaCanal una vez guardado
  qrControllers: Set<ReadableStreamDefaultController<Uint8Array>>;
  creadoEn: Date;
}

class SesionManagerWA {
  private sesiones = new Map<string, SesionWA>();

  crear(sessionId: string): SesionWA {
    const sesion: SesionWA = {
      sessionId,
      socket: null,
      estado: "qr_pendiente",
      qrActual: null,
      errorMsg: null,
      telefono: null,
      cuentaCanalId: null,
      qrControllers: new Set(),
      creadoEn: new Date(),
    };
    this.sesiones.set(sessionId, sesion);
    return sesion;
  }

  obtener(sessionId: string): SesionWA | undefined {
    return this.sesiones.get(sessionId);
  }

  eliminar(sessionId: string): void {
    const sesion = this.sesiones.get(sessionId);
    if (sesion?.socket) {
      try { sesion.socket.end(undefined); } catch { /* ignore */ }
    }
    for (const ctrl of sesion?.qrControllers ?? []) {
      try { ctrl.close(); } catch { /* ignore */ }
    }
    this.sesiones.delete(sessionId);
  }

  emitirQR(sessionId: string, qrDataUrl: string): void {
    const sesion = this.sesiones.get(sessionId);
    if (!sesion) return;
    sesion.qrActual = qrDataUrl;
    const data = new TextEncoder().encode(`event: qr\ndata: ${JSON.stringify({ qr: qrDataUrl })}\n\n`);
    for (const ctrl of sesion.qrControllers) {
      try { ctrl.enqueue(data); } catch { sesion.qrControllers.delete(ctrl); }
    }
  }

  emitirConectado(sessionId: string, telefono: string): void {
    const sesion = this.sesiones.get(sessionId);
    if (!sesion) return;
    sesion.telefono = telefono;
    sesion.estado = "conectado";
    const data = new TextEncoder().encode(`event: conectado\ndata: ${JSON.stringify({ telefono })}\n\n`);
    for (const ctrl of sesion.qrControllers) {
      try { ctrl.enqueue(data); ctrl.close(); } catch { /* ignore */ }
    }
    sesion.qrControllers.clear();
  }

  emitirError(sessionId: string, error: string): void {
    const sesion = this.sesiones.get(sessionId);
    if (!sesion) return;
    sesion.estado = "error";
    sesion.errorMsg = error;
    const data = new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    for (const ctrl of sesion.qrControllers) {
      try { ctrl.enqueue(data); ctrl.close(); } catch { /* ignore */ }
    }
    sesion.qrControllers.clear();
  }

  obtenerRutaAuth(sessionId: string): string {
    const base = process.env.WA_AUTH_PATH ?? path.join(process.cwd(), "data", "wa-sessions");
    const ruta = path.join(base, sessionId);
    if (!fs.existsSync(ruta)) fs.mkdirSync(ruta, { recursive: true });
    return ruta;
  }

  listar(): SesionWA[] {
    return Array.from(this.sesiones.values());
  }
}

const g = globalThis as unknown as { _sesionManagerWA?: SesionManagerWA };
export const sesionManagerWA = g._sesionManagerWA ?? new SesionManagerWA();
if (process.env.NODE_ENV !== "production") g._sesionManagerWA = sesionManagerWA;

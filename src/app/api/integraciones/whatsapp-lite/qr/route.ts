import { NextRequest } from "next/server";
import { sesionManagerWA } from "@/integraciones/whatsapp-lite/sesion-manager";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("sessionId requerido", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sesion = sesionManagerWA.obtener(sessionId);
      if (!sesion) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Sesión no encontrada" })}\n\n`));
        controller.close();
        return;
      }

      // Si ya hubo un error antes de que el SSE conectara, propagarlo de inmediato
      if (sesion.estado === "error") {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: sesion.errorMsg ?? "Error iniciando sesión" })}\n\n`));
        controller.close();
        return;
      }

      // Si ya hay un QR disponible, enviarlo de inmediato
      if (sesion.qrActual) {
        controller.enqueue(encoder.encode(`event: qr\ndata: ${JSON.stringify({ qr: sesion.qrActual })}\n\n`));
      }

      sesion.qrControllers.add(controller);
    },
    cancel(controller) {
      const sesion = sesionManagerWA.obtener(sessionId);
      sesion?.qrControllers.delete(controller as ReadableStreamDefaultController<Uint8Array>);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

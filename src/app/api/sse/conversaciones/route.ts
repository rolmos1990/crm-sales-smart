import { manejadorSSE } from "@/shared/eventos/sse";
import { busEventos } from "@/shared/eventos/bus";
import { TIPOS_EVENTO } from "@/shared/eventos/registro";
import type { MensajeRecibidoPayload, MensajeEnviadoPayload } from "@/shared/eventos/registro";
import type { EventoDominio } from "@/shared/eventos/types";
import { workerMensajes } from "@/shared/workers/worker-mensajes";
import { reconectarSesionesWA } from "@/integraciones/whatsapp-lite/reconectar";

export const runtime = "nodejs";

// Conecta el bus de eventos al manejador SSE una sola vez por proceso
let puenteInicializado = false;
function inicializarPuente() {
  if (puenteInicializado) return;
  puenteInicializado = true;

  // Arrancar worker de jobs y reconexión WA (idempotente — solo se ejecutan una vez)
  workerMensajes.iniciar();
  reconectarSesionesWA();

  busEventos.suscribir<MensajeRecibidoPayload>(TIPOS_EVENTO.MENSAJE_RECIBIDO, (evento: EventoDominio<MensajeRecibidoPayload>) => {
    manejadorSSE.emitir(evento.payload.instanciaId, TIPOS_EVENTO.MENSAJE_RECIBIDO, evento.payload);
  });

  busEventos.suscribir<MensajeEnviadoPayload>(TIPOS_EVENTO.MENSAJE_ENVIADO, (evento: EventoDominio<MensajeEnviadoPayload>) => {
    manejadorSSE.emitir(evento.payload.instanciaId, TIPOS_EVENTO.MENSAJE_ENVIADO, evento.payload);
  });
}

inicializarPuente();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instanciaId = searchParams.get("instanciaId");

  if (!instanciaId) {
    return new Response("instanciaId requerido", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Enviar evento de conexión establecida
      controller.enqueue(encoder.encode(`event: conectado\ndata: {"ok":true}\n\n`));
      manejadorSSE.suscribir(instanciaId, controller);
    },
    cancel(controller) {
      manejadorSSE.desuscribir(instanciaId, controller as ReadableStreamDefaultController<Uint8Array>);
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

import { manejadorSSE } from "@/shared/eventos/sse";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instanciaId = searchParams.get("instanciaId");

  if (!instanciaId) {
    return new Response("instanciaId requerido", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
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

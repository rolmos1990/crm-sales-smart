import "dotenv/config";
import { ejecutarJobsPendientes } from "../crm/pipeline/disparadores/ejecutor";
import { workerMensajes } from "../shared/workers/worker-mensajes";
import { workerSistema } from "../shared/workers/worker-sistema";
import { workerEmail } from "../shared/workers/worker-email";
import { busEventos } from "../shared/eventos/bus";
import { TIPOS_EVENTO } from "../shared/eventos/registro";
import type { MensajeEnviadoPayload, MensajeRecibidoPayload, ConversacionCreadaPayload } from "../shared/eventos/registro";
import type { EventoDominio } from "../shared/eventos/types";

const INTERVALO_MS = 10_000; // 10 segundos

// ── Suscripciones a eventos que este worker genera ──────────────────────────
// Nota: busEventos es in-memory. Solo se ven los eventos publicados dentro de
// este mismo proceso (worker). Los eventos de Next.js no son visibles aquí.

busEventos.suscribir<MensajeEnviadoPayload>(
  TIPOS_EVENTO.MENSAJE_ENVIADO,
  (evento: EventoDominio<MensajeEnviadoPayload>) => {
    console.log(
      `[worker:evento] ${evento.tipo} | ${evento.ocurridoEn.toISOString()} | instancia: ${evento.payload.instanciaId} | conversacion: ${evento.payload.conversacionId}`
    );
  }
);

busEventos.suscribir<MensajeRecibidoPayload>(
  TIPOS_EVENTO.MENSAJE_RECIBIDO,
  (evento: EventoDominio<MensajeRecibidoPayload>) => {
    console.log(
      `[worker:evento] ${evento.tipo} | ${evento.ocurridoEn.toISOString()} | instancia: ${evento.payload.instanciaId} | conversacion: ${evento.payload.conversacionId}`
    );
  }
);

busEventos.suscribir<ConversacionCreadaPayload>(
  TIPOS_EVENTO.CONVERSACION_CREADA,
  (evento: EventoDominio<ConversacionCreadaPayload>) => {
    console.log(
      `[worker:evento] ${evento.tipo} | ${evento.ocurridoEn.toISOString()} | instancia: ${evento.payload.instanciaId} | contacto: ${evento.payload.contactoId}`
    );
  }
);

// ── Arrancar worker de mensajes (jobs de JobMensaje) ─────────────────────────
// El patrón PENDIENTE→PROCESANDO en la DB evita doble procesamiento si Next.js
// también está corriendo. Los eventos MENSAJE_ENVIADO que genere se loguean arriba.
workerMensajes.iniciar();
workerSistema.iniciar();
workerEmail.iniciar();

// ── Loop principal: disparadores de pipeline CRM ─────────────────────────────
async function run() {
  console.log(`[worker:disparadores] iniciando — polling cada ${INTERVALO_MS / 1000}s`);

  while (true) {
    try {
      const resultado = await ejecutarJobsPendientes();
      if (resultado.procesados > 0) {
        console.log(
          `[worker:disparadores] ${resultado.completados}/${resultado.procesados} completados` +
            (resultado.fallidos > 0 ? `, ${resultado.fallidos} fallidos` : "")
        );
      }
    } catch (err) {
      console.error("[worker:disparadores] error en ciclo:", err);
    }

    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

run().catch((e) => {
  console.error("[worker:disparadores] error fatal:", e);
  process.exit(1);
});

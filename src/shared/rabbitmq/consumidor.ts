import type amqplib from "amqplib";
import { obtenerCanal } from "./conexion";
import { EXCHANGE } from "./exchanges";
import { esErrorConReintentabilidad, type EventoEnvelope } from "./tipos";

const MAX_INTENTOS = 3;
const PREFETCH = 10;

export abstract class ConsumidorBase<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  abstract readonly queue: string;
  abstract readonly routingKeys: string[];

  abstract manejar(envelope: EventoEnvelope<TPayload>): Promise<void>;

  /** Se llama cuando un mensaje queda definitivamente sin procesar — agotó
   *  sus MAX_INTENTOS, o el error declaró `reintentable: false` (ver
   *  ErrorConReintentabilidad) — y se va a la dead-letter queue
   *  (crm.muertos, sin consumidor). Por defecto no hace nada. Los
   *  suscriptores que necesiten reflejar el fallo definitivo en algún lado
   *  (ej. EnviarMensajeSuscriptor marcando FALLIDO) lo sobreescriben. Un
   *  error acá se loguea pero nunca debe impedir el nack final. */
  protected async alAgotarReintentos(
    envelope: EventoEnvelope<TPayload>,
    error: unknown
  ): Promise<void> {}

  async iniciar(): Promise<void> {
    const ch = await obtenerCanal();
    await ch.prefetch(PREFETCH);

    for (const rk of this.routingKeys) {
      await ch.bindQueue(this.queue, EXCHANGE, rk);
    }

    await ch.consume(this.queue, async (msg) => {
      if (!msg) return;
      await this.procesarMensaje(ch, msg);
    });

    console.log(`[${this.constructor.name}] Suscrito → ${this.queue}`);
  }

  private async procesarMensaje(
    ch: amqplib.Channel,
    msg: amqplib.Message
  ): Promise<void> {
    let envelope: EventoEnvelope<TPayload>;

    try {
      envelope = JSON.parse(msg.content.toString()) as EventoEnvelope<TPayload>;
    } catch {
      console.error(`[${this.constructor.name}] Mensaje no es JSON válido — descartando`);
      ch.nack(msg, false, false);
      return;
    }

    // x-delivery-count solo lo rellena RabbitMQ en colas quorum — las de
    // este proyecto son clásicas (ver conexion.ts, queueOpts, sin
    // x-queue-type: "quorum"), así que ese header nunca llega y esto
    // siempre daba 0 sin importar cuántas veces ya se reintentó. El
    // conteo real se lleva a mano en "x-intentos", un header propio que
    // nosotros mismos seteamos al republicar más abajo — en la primera
    // entrega no existe todavía, por eso el fallback a 0.
    const intentos = (msg.properties.headers?.["x-intentos"] as number | undefined) ?? 0;

    try {
      await this.manejar(envelope);
      ch.ack(msg);
    } catch (err) {
      // Si el error declara explícitamente que no vale la pena reintentarlo
      // (ver ErrorConReintentabilidad/EnvioMensajeError — ej. un permiso
      // denegado por Meta, ninguna cantidad de reintentos lo arregla), se
      // corta ahí mismo sin importar en qué intento estemos. Un Error común
      // (sin esa forma) sigue exactamente la política de siempre: reintenta
      // hasta agotar MAX_INTENTOS — esto no cambia nada para el resto de
      // los suscriptores que todavía no adoptaron la excepción tipada.
      const reintentablePorTipo = esErrorConReintentabilidad(err) ? err.reintentable : true;
      const agotoIntentos = intentos + 1 >= MAX_INTENTOS;

      console.error(
        `[${this.constructor.name}] Error procesando ${envelope.tipo} | eventId: ${envelope.eventId} | intento ${intentos + 1}/${MAX_INTENTOS}` +
          (esErrorConReintentabilidad(err) ? ` | reintentable: ${err.reintentable}` : "") +
          ":",
        err
      );

      if (reintentablePorTipo && !agotoIntentos) {
        // nack(requeue=true) no serviría acá — en una cola clásica vuelve
        // a poner el MISMO mensaje con sus headers originales intactos,
        // nunca incrementa nada. Se republica una copia con el contador
        // subido y se hace ack() del original (ya quedó reemplazado).
        ch.sendToQueue(this.queue, msg.content, {
          persistent: true,
          contentType: msg.properties.contentType,
          headers: { ...msg.properties.headers, "x-intentos": intentos + 1 },
        });
        ch.ack(msg);
      } else {
        await this.alAgotarReintentos(envelope, err).catch((hookErr) =>
          console.error(`[${this.constructor.name}] alAgotarReintentos falló:`, hookErr)
        );
        ch.nack(msg, false, false); // definitivo (agotó intentos o no es reintentable) → dead-letter (crm.muertos)
      }
    }
  }
}

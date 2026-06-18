import type amqplib from "amqplib";
import { obtenerCanal } from "./conexion";
import { EXCHANGE } from "./exchanges";
import type { EventoEnvelope } from "./tipos";

const MAX_INTENTOS = 3;
const PREFETCH = 10;

export abstract class ConsumidorBase {
  abstract readonly queue: string;
  abstract readonly routingKeys: string[];

  abstract manejar(envelope: EventoEnvelope): Promise<void>;

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
    let envelope: EventoEnvelope;

    try {
      envelope = JSON.parse(msg.content.toString()) as EventoEnvelope;
    } catch {
      console.error(`[${this.constructor.name}] Mensaje no es JSON válido — descartando`);
      ch.nack(msg, false, false);
      return;
    }

    const intentos = (msg.properties.headers?.["x-delivery-count"] as number | undefined) ?? 0;

    try {
      await this.manejar(envelope);
      ch.ack(msg);
    } catch (err) {
      console.error(
        `[${this.constructor.name}] Error procesando ${envelope.tipo} | eventId: ${envelope.eventId} | intento ${intentos + 1}/${MAX_INTENTOS}:`,
        err
      );

      const reintentar = intentos < MAX_INTENTOS - 1;
      ch.nack(msg, false, reintentar);
    }
  }
}

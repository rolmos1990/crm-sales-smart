import { randomUUID } from "crypto";
import { obtenerCanal } from "./conexion";
import { EXCHANGE, TIPO_EVENTO_A_RK } from "./exchanges";
import type { EventoEnvelope } from "./tipos";
import type { MapaPayloads, NombreEvento } from "@/eventos/mapa";
import { prisma } from "@/shared/db/prisma";

class PublicadorEventos {
  async publicar<K extends NombreEvento>(
    tipo: K,
    instanciaId: string,
    payload: MapaPayloads[K]
  ): Promise<void> {
    const routingKey = TIPO_EVENTO_A_RK[tipo] ?? tipo.toLowerCase().replace(/_/g, ".");

    const envelope: EventoEnvelope<MapaPayloads[K]> = {
      eventId: randomUUID(),
      instanciaId,
      tipo,
      ocurridoEn: new Date().toISOString(),
      version: 1,
      payload,
    };

    // Persistir en EventoLog antes de enviar a RabbitMQ — bitácora y base para reenvíos futuros
    try {
      await prisma.eventoLog.create({
        data: {
          id:         envelope.eventId,
          tipo,
          payload:    envelope as object,
          ocurridoEn: new Date(envelope.ocurridoEn),
          instanciaId,
        },
      });
    } catch (err) {
      console.error(`[PublicadorEventos] No se pudo guardar EventoLog para ${tipo}:`, err);
      // No lanzar — el log falla en silencio, el evento se publica igual
    }

    try {
      const ch = await obtenerCanal();
      ch.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(envelope)),
        { persistent: true, contentType: "application/json" }
      );
    } catch (err) {
      console.error(`[PublicadorEventos] Error publicando ${tipo}:`, err);
      throw err;
    }
  }
}

const g = globalThis as unknown as { _publicadorEventos?: PublicadorEventos };
export const publicadorEventos: PublicadorEventos =
  g._publicadorEventos ?? new PublicadorEventos();
g._publicadorEventos = publicadorEventos;

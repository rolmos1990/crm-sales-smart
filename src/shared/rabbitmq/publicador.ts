import { randomUUID } from "crypto";
import { obtenerCanal } from "./conexion";
import { EXCHANGE, TIPO_EVENTO_A_RK } from "./exchanges";
import type { EventoEnvelope } from "./tipos";
import type { MapaPayloads, NombreEvento } from "@/eventos/mapa";

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

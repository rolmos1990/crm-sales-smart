import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { EventoDominio, HandlerEvento, IBusEventos } from "./types";

const WILDCARD = "__todos__";

class BusEventos implements IBusEventos {
  private emisor = new EventEmitter();

  constructor() {
    this.emisor.setMaxListeners(50);
    this.suscribirTodos((evento) => {
      const instanciaId = (evento.payload as Record<string, unknown>).instanciaId;
      const sufijo = instanciaId ? ` | instancia: ${instanciaId}` : "";
      console.log(`[EventoBus] ${evento.tipo} | ${evento.ocurridoEn.toISOString()}${sufijo}`);
    });
  }

  publicar<P extends Record<string, unknown>>(tipo: string, payload: P): EventoDominio<P> {
    const evento: EventoDominio<P> = {
      id: randomUUID(),
      tipo,
      payload,
      ocurridoEn: new Date(),
      version: 1,
    };
    this.emisor.emit(tipo, evento);
    this.emisor.emit(WILDCARD, evento);
    return evento;
  }

  suscribir<P extends Record<string, unknown>>(tipo: string, handler: HandlerEvento<P>): void {
    this.emisor.on(tipo, handler as HandlerEvento);
  }

  desuscribir<P extends Record<string, unknown>>(tipo: string, handler: HandlerEvento<P>): void {
    this.emisor.off(tipo, handler as HandlerEvento);
  }

  suscribirTodos(handler: HandlerEvento): void {
    this.emisor.on(WILDCARD, handler);
  }
}

const globalForBus = globalThis as unknown as { busEventos: BusEventos | undefined };
export const busEventos = globalForBus.busEventos ?? new BusEventos();
if (process.env.NODE_ENV !== "production") globalForBus.busEventos = busEventos;

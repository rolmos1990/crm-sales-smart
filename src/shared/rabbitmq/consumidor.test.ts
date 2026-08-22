import { describe, expect, it, vi } from "vitest";
import { ConsumidorBase } from "./consumidor";
import type { EventoEnvelope } from "./tipos";

// Mock de conexion.ts — ConsumidorBase.iniciar() llama obtenerCanal(), pero
// estos tests solo ejercitan el método privado procesarMensaje() con un
// canal simulado, así que no hace falta un canal real ni RabbitMQ.
vi.mock("./conexion", () => ({ obtenerCanal: vi.fn() }));

interface Payload extends Record<string, unknown> {
  valor: string;
}

function crearEnvelope(): EventoEnvelope<Payload> {
  return {
    eventId: "evt-1",
    tipo: "TEST",
    instanciaId: "inst-1",
    ocurridoEn: new Date().toISOString(),
    version: 1,
    payload: { valor: "x" },
  };
}

function crearCanalFalso() {
  const llamadas: string[] = [];
  const headersRepublicados: { headers?: Record<string, unknown> }[] = [];
  return {
    llamadas,
    headersRepublicados,
    ack: () => { llamadas.push("ack"); },
    nack: (_msg: unknown, _allUpTo: boolean, requeue: boolean) => { llamadas.push(`nack(requeue=${requeue})`); },
    sendToQueue: (_queue: string, _content: Buffer, opts: { headers?: Record<string, unknown> }) => {
      llamadas.push("sendToQueue");
      headersRepublicados.push(opts);
    },
  };
}

function crearMensajeFalso(envelope: EventoEnvelope<Payload>, headers?: Record<string, unknown>) {
  return { content: Buffer.from(JSON.stringify(envelope)), properties: { headers, contentType: "application/json" } };
}

describe("ConsumidorBase — clasificación de reintentos", () => {
  it("un error SIN forma de ErrorConReintentabilidad (Error común) reintenta hasta agotar MAX_INTENTOS=3, luego llama alAgotarReintentos y hace nack sin requeue — comportamiento previo intacto", async () => {
    const alAgotar = vi.fn();
    class SubFalla extends ConsumidorBase<Payload> {
      readonly queue = "q-test";
      readonly routingKeys = ["rk.test"];
      async manejar(): Promise<void> { throw new Error("fallo genérico"); }
      protected async alAgotarReintentos(envelope: EventoEnvelope<Payload>, error: unknown) {
        alAgotar(envelope, error);
      }
    }
    const sub = new SubFalla();
    const ch = crearCanalFalso();
    const envelope = crearEnvelope();

    let headers: Record<string, unknown> | undefined;
    for (let i = 1; i <= 3; i++) {
      await (sub as any).procesarMensaje(ch, crearMensajeFalso(envelope, headers));
      headers = ch.headersRepublicados.at(-1)?.headers as Record<string, unknown> | undefined;
    }

    // sendToQueue republica con el contador subido y hace ack() del
    // original (ya quedó reemplazado) — ver el comentario en consumidor.ts.
    expect(ch.llamadas).toEqual(["sendToQueue", "ack", "sendToQueue", "ack", "nack(requeue=false)"]);
    expect(alAgotar).toHaveBeenCalledTimes(1);
  });

  it("Caso H — un error con reintentable:false (ej. EnvioMensajeError de code 10) corta en el PRIMER intento: no republica, llama alAgotarReintentos y hace nack sin requeue de una — no gasta los 3 intentos", async () => {
    const alAgotar = vi.fn();
    class SubPermanente extends ConsumidorBase<Payload> {
      readonly queue = "q-test";
      readonly routingKeys = ["rk.test"];
      async manejar(): Promise<void> {
        const err = new Error("permiso denegado") as Error & { reintentable: boolean };
        err.reintentable = false;
        throw err;
      }
      protected async alAgotarReintentos(envelope: EventoEnvelope<Payload>, error: unknown) {
        alAgotar(envelope, error);
      }
    }
    const sub = new SubPermanente();
    const ch = crearCanalFalso();

    await (sub as any).procesarMensaje(ch, crearMensajeFalso(crearEnvelope()));

    expect(ch.llamadas).toEqual(["nack(requeue=false)"]);
    expect(alAgotar).toHaveBeenCalledTimes(1);
  });

  it("Caso F/G — un error con reintentable:true (ej. RATE_LIMIT o 5xx) sí reintenta como cualquier otro, no corta antes de MAX_INTENTOS", async () => {
    class SubTransitoria extends ConsumidorBase<Payload> {
      readonly queue = "q-test";
      readonly routingKeys = ["rk.test"];
      async manejar(): Promise<void> {
        const err = new Error("rate limit") as Error & { reintentable: boolean };
        err.reintentable = true;
        throw err;
      }
    }
    const sub = new SubTransitoria();
    const ch = crearCanalFalso();

    await (sub as any).procesarMensaje(ch, crearMensajeFalso(crearEnvelope()));

    expect(ch.llamadas).toEqual(["sendToQueue", "ack"]);
  });

  it("un intento exitoso hace ack simple, nunca llama alAgotarReintentos", async () => {
    const alAgotar = vi.fn();
    class SubOk extends ConsumidorBase<Payload> {
      readonly queue = "q-test";
      readonly routingKeys = ["rk.test"];
      async manejar(): Promise<void> {}
      protected async alAgotarReintentos(envelope: EventoEnvelope<Payload>, error: unknown) {
        alAgotar(envelope, error);
      }
    }
    const sub = new SubOk();
    const ch = crearCanalFalso();

    await (sub as any).procesarMensaje(ch, crearMensajeFalso(crearEnvelope()));

    expect(ch.llamadas).toEqual(["ack"]);
    expect(alAgotar).not.toHaveBeenCalled();
  });
});

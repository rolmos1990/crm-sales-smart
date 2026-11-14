import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConsumidorBase } from "./consumidor";
import type { EventoEnvelope } from "./tipos";

// Reproduce el modo de falla que tiró la mensajería entera: RabbitMQ se cae un
// instante, el proceso reconecta, loguea "Conectado"… y no vuelve a consumir
// nada. Sin crash, sin log de error, sin reinicio automático. Lo único visible
// era que los mensajes se quedaban encolados para siempre.
//
// El canal se simula porque lo que se verifica es el ciclo de vida de la
// suscripción, no el protocolo AMQP.

const resuscriptores = new Map<string, () => Promise<void>>();
let canalActual: ReturnType<typeof crearCanal>;

vi.mock("./conexion", () => ({
  obtenerCanal: () => Promise.resolve(canalActual),
  registrarResuscripcion: (cola: string, fn: () => Promise<void>) => resuscriptores.set(cola, fn),
}));

function crearCanal() {
  return {
    id: Math.random().toString(36).slice(2, 8),
    consumos: [] as string[],
    bindeos: [] as string[],
    prefetch: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn(function (this: void, cola: string) { canalActual.bindeos.push(cola); return Promise.resolve(); }),
    consume: vi.fn(function (this: void, cola: string) { canalActual.consumos.push(cola); return Promise.resolve({ consumerTag: "t" }); }),
    ack: vi.fn(), nack: vi.fn(), publish: vi.fn(),
  };
}

class ConsumidorDePrueba extends ConsumidorBase<Record<string, unknown>> {
  readonly queue = "crm.comando.mensaje.enviar";
  readonly routingKeys = ["comando.mensaje.enviar"];
  async manejar(_e: EventoEnvelope<Record<string, unknown>>): Promise<void> {}
}

/** Lo que hace conexion.ts tras reconectar: canal nuevo + reinstalar. */
async function simularCaidaYReconexion() {
  canalActual = crearCanal();
  for (const volverASuscribir of resuscriptores.values()) await volverASuscribir();
}

describe("consumidores tras una reconexión de RabbitMQ", () => {
  beforeEach(() => {
    resuscriptores.clear();
    canalActual = crearCanal();
  });

  it("al iniciar deja registrado cómo volver a suscribirse", async () => {
    await new ConsumidorDePrueba().iniciar();

    expect([...resuscriptores.keys()]).toEqual(["crm.comando.mensaje.enviar"]);
  });

  it("vuelve a consumir sobre el canal nuevo — el bug que dejaba al worker sordo", async () => {
    await new ConsumidorDePrueba().iniciar();
    expect(canalActual.consumos).toEqual(["crm.comando.mensaje.enviar"]);

    const canalViejo = canalActual;
    await simularCaidaYReconexion();

    expect(canalActual.id).not.toBe(canalViejo.id);
    // Sin el fix esto queda vacío: el consumidor se fue con el canal muerto.
    expect(canalActual.consumos).toEqual(["crm.comando.mensaje.enviar"]);
    expect(canalActual.bindeos).toEqual(["crm.comando.mensaje.enviar"]);
  });

  it("sobrevive a varias caídas seguidas, no solo a la primera", async () => {
    await new ConsumidorDePrueba().iniciar();

    for (let i = 0; i < 3; i++) await simularCaidaYReconexion();

    expect(canalActual.consumos).toEqual(["crm.comando.mensaje.enviar"]);
  });

  it("re-registrar la misma cola reemplaza en vez de acumular suscripciones", async () => {
    await new ConsumidorDePrueba().iniciar();
    await new ConsumidorDePrueba().iniciar();

    expect(resuscriptores.size).toBe(1);

    await simularCaidaYReconexion();
    // Una sola suscripción por cola: duplicarlas entregaría cada mensaje dos veces.
    expect(canalActual.consumos).toEqual(["crm.comando.mensaje.enviar"]);
  });

  it("cada consumidor se repone por su cuenta", async () => {
    class OtroConsumidor extends ConsumidorBase<Record<string, unknown>> {
      readonly queue = "crm.comando.mensaje.entrante";
      readonly routingKeys = ["comando.mensaje.entrante"];
      async manejar(_e: EventoEnvelope<Record<string, unknown>>): Promise<void> {}
    }
    await new ConsumidorDePrueba().iniciar();
    await new OtroConsumidor().iniciar();

    await simularCaidaYReconexion();

    expect(canalActual.consumos.sort()).toEqual([
      "crm.comando.mensaje.entrante",
      "crm.comando.mensaje.enviar",
    ]);
  });
});

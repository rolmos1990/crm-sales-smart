// ManejadorSSE: distribuye eventos del bus a clientes conectados vía Server-Sent Events.
// Funciona en single-process. Para multi-instancia, reemplazar con Redis PubSub
// manteniendo la misma interfaz pública (suscribir/desuscribir/emitir).

type Controlador = ReadableStreamDefaultController<Uint8Array>;

class ManejadorSSE {
  private clientes = new Map<string, Set<Controlador>>();

  suscribir(instanciaId: string, controlador: Controlador): void {
    if (!this.clientes.has(instanciaId)) {
      this.clientes.set(instanciaId, new Set());
    }
    this.clientes.get(instanciaId)!.add(controlador);
  }

  desuscribir(instanciaId: string, controlador: Controlador): void {
    this.clientes.get(instanciaId)?.delete(controlador);
    if (this.clientes.get(instanciaId)?.size === 0) {
      this.clientes.delete(instanciaId);
    }
  }

  emitir(instanciaId: string, tipo: string, payload: unknown): void {
    const set = this.clientes.get(instanciaId);
    if (!set?.size) return;

    const data = `event: ${tipo}\ndata: ${JSON.stringify(payload)}\n\n`;
    const encoded = new TextEncoder().encode(data);

    for (const ctrl of set) {
      try {
        ctrl.enqueue(encoded);
      } catch {
        this.clientes.get(instanciaId)?.delete(ctrl);
      }
    }
  }
}

const globalForSSE = globalThis as unknown as { manejadorSSE: ManejadorSSE | undefined };
export const manejadorSSE = globalForSSE.manejadorSSE ?? new ManejadorSSE();
if (process.env.NODE_ENV !== "production") globalForSSE.manejadorSSE = manejadorSSE;

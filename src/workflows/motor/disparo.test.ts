import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 049 — Una nota de voz tiene que poder contestar un nodo Menú o Capturar
 * dato. Antes, `enrutarMensajeEntrante` pasaba `mensaje?.contenido ?? ""` y un
 * cliente que respondía hablando trababa la ejecución con cadena vacía.
 *
 * Este test existe para que volver a esa línea rompa algo.
 */

const configFindUnique = vi.fn(async (..._a: unknown[]) => ({ workflowsHabilitado: true }));
const conversacionFindFirst = vi.fn();
const mensajeFindUnique = vi.fn();
const ejecucionFindMany = vi.fn(async (..._a: unknown[]) => [] as unknown[]);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUnique(...a) },
    conversacion: { findFirst: (...a: unknown[]) => conversacionFindFirst(...a) },
    mensajeConversacion: { findUnique: (...a: unknown[]) => mensajeFindUnique(...a) },
    workflowEjecucion: { findMany: (...a: unknown[]) => ejecucionFindMany(...a) },
    workflow: { findMany: async () => [] },
  },
}));

const avanzarEjecucion = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("./motor", () => ({
  ESTADOS_ACTIVOS: ["ESPERANDO_RESPUESTA", "IA_ACTIVA", "ESPERANDO_TIMER"],
  avanzarEjecucion: (...a: unknown[]) => avanzarEjecucion(...a),
  aplicarInterrupcion: vi.fn(),
  cancelarEjecucion: vi.fn(),
  crearEjecucion: vi.fn(),
}));

const { enrutarMensajeEntrante } = await import("./disparo");

const CONV = {
  modoAtencion: "AUTOMATICO",
  contactoId: "c1",
  bloqueadaPorAprobacion: false,
  contacto: { noContactarDesde: null },
};

function params() {
  return { instanciaId: "i1", conversacionId: "conv1", mensajeId: "m1" };
}

function textoEntregado(): string | undefined {
  const call = avanzarEjecucion.mock.calls[0];
  if (!call) return undefined;
  return (call[1] as { texto?: string } | undefined)?.texto;
}

beforeEach(() => {
  vi.clearAllMocks();
  configFindUnique.mockResolvedValue({ workflowsHabilitado: true });
  conversacionFindFirst.mockResolvedValue(CONV);
  ejecucionFindMany.mockResolvedValue([
    { id: "ej1", estado: "ESPERANDO_RESPUESTA", esperaTipo: null },
  ]);
});

describe("enrutarMensajeEntrante con notas de voz", () => {
  it("entrega la transcripción al workflow cuando el cliente responde hablando", async () => {
    mensajeFindUnique.mockResolvedValue({
      contenido: null,
      tipo: "NOTA_VOZ",
      mediaArchivo: { transcripcion: "opción dos", transcripcionEstado: "LISTO" },
    });

    await enrutarMensajeEntrante(params());

    expect(avanzarEjecucion).toHaveBeenCalledTimes(1);
    expect(textoEntregado()).toContain("opción dos");
  });

  it("un mensaje de texto sigue entregando su contenido, sin prefijo", async () => {
    mensajeFindUnique.mockResolvedValue({ contenido: "opción dos", tipo: "TEXTO", mediaArchivo: null });

    await enrutarMensajeEntrante(params());

    expect(textoEntregado()).toBe("opción dos");
  });

  it("una nota de voz sin transcribir entrega cadena vacía, como antes", async () => {
    // Degradación: no se inventa texto. El workflow decide qué hacer con "".
    mensajeFindUnique.mockResolvedValue({
      contenido: null,
      tipo: "NOTA_VOZ",
      mediaArchivo: { transcripcion: null, transcripcionEstado: "PENDIENTE" },
    });

    await enrutarMensajeEntrante(params());

    expect(textoEntregado()).toBe("");
  });

  it("el SELECT trae la transcripción, no solo el contenido", async () => {
    mensajeFindUnique.mockResolvedValue({ contenido: "hola", tipo: "TEXTO", mediaArchivo: null });

    await enrutarMensajeEntrante(params());

    const select = (mensajeFindUnique.mock.calls[0]![0] as { select: Record<string, unknown> }).select;
    expect(select).toHaveProperty("tipo");
    expect(select).toHaveProperty("mediaArchivo");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 049 — EL test de la feature. No borrar ni "simplificar".
 *
 * En Instagram una nota de voz y un video llegan los DOS con mime video/mp4
 * (727 contra 203 en datos reales de producción), y ElevenLabs transcribe
 * video sin devolver error. Un filtro por mime no falla: transcribe los
 * videos, los factura y nadie se entera.
 *
 * Lo único que distingue es `MensajeConversacion.tipo`. Estos casos son los
 * que una refactorización del tipo "simplifiquemos el filtro al mime" rompe
 * sin que ningún otro test se queje.
 *
 * Contrato: specs/049-proveedores-de-voz/contracts/alcance-transcripcion.md
 */

const mediaFindUnique = vi.fn();
const mensajeCount = vi.fn();
const mediaUpdate = vi.fn(async (..._a: unknown[]) => ({}));
const usoVozCreate = vi.fn(async (..._a: unknown[]) => ({}));
const executeRaw = vi.fn(async (..._a: unknown[]) => 1);

const mensajeUpdateMany = vi.fn(async (..._a: unknown[]) => ({ count: 1 }));
const mensajeFindMany = vi.fn(async (..._a: unknown[]) => [{ conversacionId: "conv1" }]);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    mediaArchivo: {
      findUnique: (...a: unknown[]) => mediaFindUnique(...a),
      update: (...a: unknown[]) => mediaUpdate(...a),
    },
    mensajeConversacion: {
      count: (...a: unknown[]) => mensajeCount(...a),
      updateMany: (...a: unknown[]) => mensajeUpdateMany(...a),
      findMany: (...a: unknown[]) => mensajeFindMany(...a),
    },
    usoVoz: { create: (...a: unknown[]) => usoVozCreate(...a) },
    proveedorVoz: { findMany: async () => [PROVEEDOR_FILA] },
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
  },
}));

const download = vi.fn(async (..._a: unknown[]) => ({ buffer: Buffer.from("audio"), contentType: "audio/ogg" }));
vi.mock("@/lib/media/providers/factory", () => ({
  getStorageProvider: () => ({ download: (...a: unknown[]) => download(...a) }),
}));

vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: vi.fn(async () => undefined) },
}));

vi.mock("@/shared/lib/cifrado-tokens", () => ({ descifrarToken: () => "api-key-de-prueba" }));

/** Espía del proveedor: el conteo de llamadas es la aserción central. */
const transcribirProveedor = vi.fn(async (..._a: unknown[]) => ({
  texto: "hola, quería consultar por el precio",
  idioma: "spa",
  confianzaIdioma: 0.98,
  palabras: 6,
  segundos: 12,
  modelo: "scribe_v3",
  proveedor: "ELEVENLABS" as const,
  tiempoMs: 800,
}));

vi.mock("@/voz/proveedores/registro", () => ({
  crearProveedorVoz: () => ({
    nombre: "ELEVENLABS",
    transcribir: (...a: unknown[]) => transcribirProveedor(...a),
    estaDisponible: async () => true,
  }),
  registrarProveedorVoz: vi.fn(),
  proveedoresVozRegistrados: () => ["ELEVENLABS"],
}));

const PROVEEDOR_FILA = {
  id: "pv1",
  proveedor: "ELEVENLABS",
  apiKeyEncriptada: "enc:v1:xxx",
  baseUrl: null,
  modelo: "scribe_v3",
  costoPorHora: null,
  limiteMinutosDia: null,
  timeoutMs: 30000,
  alias: "principal",
};

const { transcribirMediaArchivo } = await import("./transcribir");

/** Un MediaArchivo de Instagram: mime de VIDEO aunque sea una nota de voz. */
function mediaInstagram(overrides: Record<string, unknown> = {}) {
  return {
    id: "ma1",
    instanciaId: "inst1",
    keyOriginal: "inst1/conversaciones/originals/1.mp4",
    keyOptimizado: "inst1/conversaciones/originals/1.mp4",
    mimeOriginal: "video/mp4",
    nombreOriginal: "audio-1",
    pesoOriginal: 104_631,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  download.mockResolvedValue({ buffer: Buffer.from("audio"), contentType: "audio/ogg" });
});

describe("alcance de la transcripción: solo AUDIO y NOTA_VOZ", () => {
  it("video/mp4 referenciado por un mensaje VIDEO ⇒ CERO llamadas al proveedor", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram());
    mensajeCount.mockResolvedValue(0); // ningún mensaje AUDIO/NOTA_VOZ lo referencia

    const r = await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).not.toHaveBeenCalled();
    expect(usoVozCreate).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: "NO_APLICA", motivo: "NO_ES_NOTA_DE_VOZ" });
  });

  it("video/mp4 referenciado por un mensaje AUDIO ⇒ SÍ se transcribe", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram());
    mensajeCount.mockResolvedValue(1);

    const r = await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ estado: "LISTO" });
  });

  it("audio/ogg referenciado por un mensaje NOTA_VOZ ⇒ se transcribe", async () => {
    mediaFindUnique.mockResolvedValue(
      mediaInstagram({ mimeOriginal: "audio/ogg; codecs=opus", pesoOriginal: 39_166 }),
    );
    mensajeCount.mockResolvedValue(1);

    const r = await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ estado: "LISTO" });
  });

  it("imagen referenciada por un mensaje IMAGEN ⇒ cero llamadas", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram({ mimeOriginal: "image/jpeg" }));
    mensajeCount.mockResolvedValue(0);

    await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).not.toHaveBeenCalled();
  });

  it("fila marcada PENDIENTE a mano cuyo mensaje es VIDEO ⇒ el segundo corte la saca sin llamar", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram());
    mensajeCount.mockResolvedValue(0);

    await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).not.toHaveBeenCalled();
    // Y vuelve a NO_APLICA para que el barrido no la tome una y otra vez.
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).toContain("NO_APLICA");
  });

  it("el filtro consulta por TIPO del mensaje, nunca por el mime del archivo", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram());
    mensajeCount.mockResolvedValue(1);

    await transcribirMediaArchivo("ma1");

    // Si alguien reemplaza el criterio por el mime, este where desaparece.
    expect(mensajeCount).toHaveBeenCalledWith({
      where: { mediaArchivoId: "ma1", tipo: { in: ["AUDIO", "NOTA_VOZ"] } },
    });
  });

  it("archivo por encima del tope ⇒ cero llamadas aunque sea una nota de voz", async () => {
    mediaFindUnique.mockResolvedValue(mediaInstagram({ pesoOriginal: 40 * 1024 * 1024 }));
    mensajeCount.mockResolvedValue(1);

    const r = await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: "ERROR", codigo: "ARCHIVO_DEMASIADO_GRANDE", reintentable: false });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 051 — El invariante del nombre de archivo.
 *
 * Groq y OpenAI aceptan o rechazan un audio por la EXTENSIÓN del nombre que
 * viaja en el formulario, antes de mirar un byte; ElevenLabs lo identifica por
 * el contenido. Ningún canal entrega un nombre con extensión, así que cambiar
 * de proveedor rompía la transcripción entera.
 *
 * Este test NO mira el código de los adaptadores: observa lo que de verdad
 * llega a `IProveedorVoz.transcribir()` a través de un proveedor falso. Por eso
 * un adaptador nuevo queda cubierto sin que nadie se acuerde de nada, que es la
 * razón de arreglarlo en `transcribir.ts` y no en cada proveedor.
 *
 * No se borra.
 */

const mediaFindUnique = vi.fn();
const mensajeCount = vi.fn(async (..._a: unknown[]) => 1);
const mediaUpdate = vi.fn(async (..._a: unknown[]) => ({}));
const usoVozCreate = vi.fn(async (..._a: unknown[]) => ({}));
const executeRaw = vi.fn(async (..._a: unknown[]) => 1);
const proveedorFindMany = vi.fn();
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
    proveedorVoz: { findMany: (...a: unknown[]) => proveedorFindMany(...a) },
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
  },
}));

const download = vi.fn(async (..._a: unknown[]) => ({
  buffer: Buffer.from("a"),
  contentType: "audio/ogg",
}));
vi.mock("@/lib/media/providers/factory", () => ({
  getStorageProvider: () => ({ download: (...a: unknown[]) => download(...a) }),
}));
vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: vi.fn(async () => undefined) },
}));
vi.mock("@/shared/lib/cifrado-tokens", () => ({ descifrarToken: () => "k" }));

const transcribirProveedor = vi.fn();
vi.mock("@/voz/proveedores/registro", () => ({
  crearProveedorVoz: () => ({
    nombre: "ELEVENLABS",
    transcribir: (...a: unknown[]) => transcribirProveedor(...a),
    estaDisponible: async () => true,
  }),
  registrarProveedorVoz: vi.fn(),
  proveedoresVozRegistrados: () => ["ELEVENLABS"],
}));

const { transcribirMediaArchivo } = await import("./transcribir");

const PROVEEDOR = {
  id: "pv1",
  proveedor: "ELEVENLABS",
  apiKeyEncriptada: "enc:v1:x",
  baseUrl: null,
  modelo: "scribe_v3",
  costoPorHora: 0.2,
  limiteMinutosDia: null,
  timeoutMs: 30000,
  alias: "principal",
};

function media(o: Record<string, unknown> = {}) {
  return {
    id: "ma1",
    instanciaId: "inst1",
    keyOriginal: "inst1/conversaciones/originals/1795268255346-m56krsk.mp4",
    keyOptimizado: "inst1/conversaciones/originals/1795268255346-m56krsk.mp4",
    mimeOriginal: "video/mp4",
    nombreOriginal: "audio-1795275488865",
    pesoOriginal: 42_936,
    ...o,
  };
}

/** Lo que de verdad recibió el proveedor. */
function recibido() {
  return transcribirProveedor.mock.calls[0]![0] as {
    nombreArchivo: string;
    mimeType: string;
    buffer: Buffer;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mensajeCount.mockResolvedValue(1);
  proveedorFindMany.mockResolvedValue([PROVEEDOR]);
  download.mockResolvedValue({ buffer: Buffer.from("a"), contentType: "audio/ogg" });
  transcribirProveedor.mockResolvedValue({
    texto: "hola, quería el precio",
    idioma: "spa",
    confianzaIdioma: 0.97,
    palabras: 4,
    segundos: 12,
    modelo: "scribe_v3",
    proveedor: "ELEVENLABS",
    tiempoMs: 700,
  });
});

describe("el nombre que llega al proveedor", () => {
  it("lleva extensión aunque el canal no la haya dado (Instagram, video/mp4)", async () => {
    mediaFindUnique.mockResolvedValue(media());

    await transcribirMediaArchivo("ma1");

    expect(recibido().nombreArchivo).toBe("audio-1795275488865.mp4");
  });

  it("lleva extensión también para los audios de WhatsApp (audio/ogg; codecs=opus)", async () => {
    mediaFindUnique.mockResolvedValue(
      media({
        keyOriginal: "inst1/conversaciones/originals/1795266746123-w8dxg69.ogg",
        keyOptimizado: "inst1/conversaciones/originals/1795266746123-w8dxg69.ogg",
        mimeOriginal: "audio/ogg; codecs=opus",
        nombreOriginal: "audio-1795266746093",
      }),
    );

    await transcribirMediaArchivo("ma1");

    expect(recibido().nombreArchivo).toBe("audio-1795266746093.ogg");
  });

  it("toma la extensión de keyOptimizado cuando no hay keyOriginal", async () => {
    mediaFindUnique.mockResolvedValue(
      media({ keyOriginal: null, keyOptimizado: "inst1/c/o/x.ogg" }),
    );

    await transcribirMediaArchivo("ma1");

    expect(recibido().nombreArchivo).toBe("audio-1795275488865.ogg");
  });

  it("sin extensión en la clave, se degrada al comportamiento anterior a 051", async () => {
    // No se inventa una extensión: el proveedor rechaza y hace bien.
    mediaFindUnique.mockResolvedValue(
      media({ keyOriginal: "inst1/c/o/sinpunto", keyOptimizado: "inst1/c/o/sinpunto" }),
    );

    await transcribirMediaArchivo("ma1");

    expect(recibido().nombreArchivo).toBe("audio-1795275488865");
  });

  it("no toca el mime ni el contenido: solo el nombre", async () => {
    mediaFindUnique.mockResolvedValue(media());

    await transcribirMediaArchivo("ma1");

    expect(recibido().mimeType).toBe("video/mp4");
    expect(recibido().buffer).toEqual(Buffer.from("a"));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Estados terminales y degradación. El caso que más importa:
 * INAUDIBLE NO se reintenta. Tratarlo como un fallo lo metería en el backoff
 * y gastaría cinco llamadas pagas para obtener cinco veces el mismo silencio.
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

type Descarga = { buffer: Buffer; contentType: string } | null;
const download = vi.fn(async (..._a: unknown[]): Promise<Descarga> => ({ buffer: Buffer.from("a"), contentType: "audio/ogg" }));
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
const { ErrorProveedorVoz } = await import("./proveedores/types");

const MEDIA = {
  id: "ma1",
  instanciaId: "inst1",
  keyOriginal: "inst1/c/o/1.ogg",
  keyOptimizado: "inst1/c/o/1.ogg",
  mimeOriginal: "audio/ogg; codecs=opus",
  nombreOriginal: "audio-1",
  pesoOriginal: 39_166,
};

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

function salidaProveedor(o: Record<string, unknown> = {}) {
  return {
    texto: "hola, quería el precio",
    idioma: "spa",
    confianzaIdioma: 0.97,
    palabras: 4,
    segundos: 12,
    modelo: "scribe_v3",
    proveedor: "ELEVENLABS",
    tiempoMs: 700,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mediaFindUnique.mockResolvedValue(MEDIA);
  mensajeCount.mockResolvedValue(1);
  proveedorFindMany.mockResolvedValue([PROVEEDOR]);
  download.mockResolvedValue({ buffer: Buffer.from("a"), contentType: "audio/ogg" });
});

describe("INAUDIBLE es terminal", () => {
  it("guarda el literal 'Inaudible' y el estado INAUDIBLE, no ERROR", async () => {
    transcribirProveedor.mockResolvedValue(salidaProveedor({ texto: "(música)", palabras: 0 }));

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toEqual({ estado: "INAUDIBLE" });
    const data = (mediaUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.transcripcion).toBe("Inaudible");
    expect(data.transcripcionEstado).toBe("INAUDIBLE");
  });

  it("NO incrementa intentos ni devuelve la fila a la cola", async () => {
    transcribirProveedor.mockResolvedValue(salidaProveedor({ texto: "", palabras: 0 }));

    await transcribirMediaArchivo("ma1");

    const data = (mediaUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.transcripcionIntentos).toBeUndefined();
    expect(data.transcripcionBloqueadoHasta).toBeNull();
    // Ningún UPDATE de backoff: el SQL de devolverConBackoff nunca corre.
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).not.toContain("make_interval");
  });

  it("igual registra el consumo: el proveedor cobró el audio", async () => {
    transcribirProveedor.mockResolvedValue(salidaProveedor({ texto: "", palabras: 0, segundos: 5 }));

    await transcribirMediaArchivo("ma1");

    expect(usoVozCreate).toHaveBeenCalledTimes(1);
    expect((usoVozCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data).toMatchObject({ segundos: 5, exito: true });
  });
});

describe("degradación ante fallos", () => {
  it("error reintentable ⇒ backoff, no ERROR definitivo", async () => {
    transcribirProveedor.mockRejectedValue(
      new ErrorProveedorVoz("429", "LIMITE_PROVEEDOR", true),
    );

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toMatchObject({ estado: "ERROR", reintentable: true });
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).toContain("make_interval");
  });

  it("error NO reintentable ⇒ ERROR definitivo, sin backoff", async () => {
    transcribirProveedor.mockRejectedValue(
      new ErrorProveedorVoz("401", "CREDENCIAL_INVALIDA", false),
    );

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toMatchObject({ estado: "ERROR", reintentable: false });
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).not.toContain("make_interval");
  });

  it("un fallo registra el consumo con exito=false y el CÓDIGO, nunca el mensaje crudo", async () => {
    transcribirProveedor.mockRejectedValue(
      new ErrorProveedorVoz("detalle interno que no debe salir", "ERROR_PROVEEDOR", true),
    );

    await transcribirMediaArchivo("ma1");

    const data = (usoVozCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.exito).toBe(false);
    expect(data.error).toBe("ERROR_PROVEEDOR");
    expect(data.error).not.toContain("detalle interno");
  });

  it("sin proveedor configurado NO consume intentos: queda pendiente para cuando lo configuren", async () => {
    proveedorFindMany.mockResolvedValue([]);

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toEqual({ estado: "OMITIDO", motivo: "SIN_PROVEEDOR" });
    expect(transcribirProveedor).not.toHaveBeenCalled();
    expect(usoVozCreate).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("proveedor activo sin credencial se saltea", async () => {
    proveedorFindMany.mockResolvedValue([{ ...PROVEEDOR, apiKeyEncriptada: null }]);

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toEqual({ estado: "OMITIDO", motivo: "SIN_PROVEEDOR" });
  });

  it("archivo ilegible en el storage ⇒ REINTENTABLE, sin llamar al proveedor", async () => {
    // No es culpa del archivo: casi siempre es infraestructura nuestra
    // (STORAGE_PROVIDER mal configurado, credenciales rotadas, un bache del
    // bucket). Marcarlo definitivo dejaría el audio muerto justo cuando basta
    // con arreglar el entorno, y haría falta una persona para resucitarlo.
    download.mockResolvedValue(null);

    const r = await transcribirMediaArchivo("ma1");

    expect(transcribirProveedor).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: "ERROR", codigo: "ARCHIVO_NO_DISPONIBLE", reintentable: true });
    // Vuelve a la cola con backoff en vez de quedar en ERROR definitivo.
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).toContain("make_interval");
  });

  it("si el storage lanza, tampoco se pierde: mismo camino reintentable", async () => {
    download.mockRejectedValue(new Error("ECONNREFUSED"));

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toMatchObject({ codigo: "ARCHIVO_NO_DISPONIBLE", reintentable: true });
  });

  it("un archivo por encima del tope SÍ es definitivo: eso no se arregla solo", async () => {
    mediaFindUnique.mockResolvedValue({ ...MEDIA, pesoOriginal: 40 * 1024 * 1024 });

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toMatchObject({ codigo: "ARCHIVO_DEMASIADO_GRANDE", reintentable: false });
    const sql = (executeRaw.mock.calls as unknown[][]).flat().map(String).join(" ");
    expect(sql).not.toContain("make_interval");
  });
});

describe("camino feliz", () => {
  it("guarda texto recortado, idioma, duración y proveedor", async () => {
    transcribirProveedor.mockResolvedValue(salidaProveedor({ texto: "  hola  " }));

    const r = await transcribirMediaArchivo("ma1");

    expect(r).toEqual({ estado: "LISTO", texto: "hola" });
    expect((mediaUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data).toMatchObject({
      transcripcion: "hola",
      transcripcionEstado: "LISTO",
      transcripcionIdioma: "spa",
      transcripcionSegundos: 12,
      transcripcionProveedorVozId: "pv1",
    });
  });

  it("el timeout efectivo es el menor entre el del proveedor y el de plataforma", async () => {
    transcribirProveedor.mockResolvedValue(salidaProveedor());

    await transcribirMediaArchivo("ma1");

    // Plataforma 12 s por defecto contra 30 s del proveedor.
    expect((transcribirProveedor.mock.calls[0]![0] as { timeoutMs: number }).timeoutMs).toBe(12_000);
  });
});

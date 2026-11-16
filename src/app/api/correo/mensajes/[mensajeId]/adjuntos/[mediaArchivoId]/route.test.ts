import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { MensajeCorreoParaSesion } from "@/integraciones/email/vista/queries";

const sesionMock = vi.fn();
const datosMock = vi.fn();
const mediaMock = vi.fn();
const descargaMock = vi.fn();

vi.mock("@/shared/auth/sesion", () => ({ obtenerSesionActual: () => sesionMock() }));
vi.mock("@/integraciones/email/vista/queries", () => ({
  obtenerMensajeCorreoParaSesion: (id: string, inst: string) => datosMock(id, inst),
}));
vi.mock("@/shared/db/prisma", () => ({
  prisma: { mediaArchivo: { findFirst: (args: unknown) => mediaMock(args) } },
}));
vi.mock("@/lib/media/providers/factory", () => ({
  getStorageProvider: () => ({ download: (key: string) => descargaMock(key) }),
}));

const { GET } = await import("./route");
const { nombreDescarga } = await import("@/integraciones/email/vista/descarga");

const DATOS: MensajeCorreoParaSesion = {
  mensajeId: "msg_1",
  mediaArchivoId: "ma_principal",
  remitente: "CONTACTO",
  correo: {
    mensajeId: "msg_1",
    instanciaId: "inst_A",
    estadoHtml: "SIN_HTML",
    htmlLimpio: null,
    tieneImagenesExternas: false,
    imagenesExternas: [],
    adjuntos: [
      { mediaArchivoId: "ma_html", nombre: "factura.html", mimeType: "text/html", bytes: 50, cid: null, enLinea: false },
      { mediaArchivoId: "ma_svg", nombre: "logo.svg", mimeType: "image/svg+xml", bytes: 50, cid: null, enLinea: false },
    ],
    de: null, para: [], paraTotal: 0, cc: [], ccTotal: 0, asunto: null, fechaEnvio: null,
  },
};

async function pedir(mediaArchivoId: string) {
  return GET(new NextRequest(`http://localhost:3000/api/correo/mensajes/msg_1/adjuntos/${mediaArchivoId}`), {
    params: Promise.resolve({ mensajeId: "msg_1", mediaArchivoId }),
  });
}

describe("GET /api/correo/mensajes/[id]/adjuntos/[mediaArchivoId]", () => {
  beforeEach(() => {
    sesionMock.mockResolvedValue({ instanciaId: "inst_A" });
    datosMock.mockImplementation(async (_id: string, inst: string) => (inst === "inst_A" ? DATOS : null));
    mediaMock.mockImplementation(async (args: { where: { id: string; instanciaId: string } }) =>
      args.where.instanciaId === "inst_A"
        ? { nombreOriginal: "x", keyOriginal: `k/${args.where.id}`, keyOptimizado: "k/opt", mimeOptimizado: "text/html", mimeOriginal: "text/html" }
        : null,
    );
    descargaMock.mockResolvedValue({ buffer: Buffer.from("<script>alert(1)</script>"), contentType: "text/html" });
  });
  afterEach(() => vi.clearAllMocks());

  it.each(["ma_html", "ma_svg"])("%s se entrega SIEMPRE como descarga, nunca interpretado", async (id) => {
    const res = await pedir(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename=/);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox; default-src 'none'");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("el adjunto principal del mensaje también se puede descargar", async () => {
    expect((await pedir("ma_principal")).status).toBe(200);
  });

  it("un archivo que no es de ese mensaje → 404", async () => {
    expect((await pedir("ma_de_otro_mensaje")).status).toBe(404);
    expect(descargaMock).not.toHaveBeenCalled();
  });

  it("otro comercio → 404", async () => {
    sesionMock.mockResolvedValue({ instanciaId: "inst_B" });
    expect((await pedir("ma_html")).status).toBe(404);
  });

  it("sin sesión → 404", async () => {
    sesionMock.mockResolvedValue(null);
    expect((await pedir("ma_html")).status).toBe(404);
  });

  it("el nombre de archivo no puede inyectar cabeceras ni rutas", () => {
    expect(nombreDescarga('../../etc/"pass"\r\nX-Evil: 1')).not.toMatch(/[\r\n"/\\]/);
    expect(nombreDescarga("")).toBe("adjunto");
  });
});

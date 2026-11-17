import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { expiracionNueva, firmarToken } from "@/integraciones/email/vista/token";

const correoMock = vi.fn();
const mediaMock = vi.fn();
const descargaMock = vi.fn();

vi.mock("@/integraciones/email/vista/queries", () => ({
  obtenerCorreoDeMensaje: (id: string, inst: string) => correoMock(id, inst),
}));
vi.mock("@/shared/db/prisma", () => ({
  prisma: { mediaArchivo: { findFirst: (args: unknown) => mediaMock(args) } },
}));
vi.mock("@/lib/media/providers/factory", () => ({
  getStorageProvider: () => ({ download: (key: string) => descargaMock(key) }),
}));

const { GET } = await import("./route");

const CORREO: CorreoDeMensaje = {
  mensajeId: "msg_1",
  instanciaId: "inst_A",
  estadoHtml: "DISPONIBLE",
  htmlLimpio: "<p>x</p>",
  tieneImagenesExternas: false,
  imagenesExternas: [],
  adjuntos: [{ mediaArchivoId: "ma_logo", nombre: "logo.png", mimeType: "image/png", bytes: 3, cid: "logo", enLinea: true }],
  de: null, para: [], paraTotal: 0, cc: [], ccTotal: 0, asunto: null, fechaEnvio: null,
};

function token(extra: Partial<Parameters<typeof firmarToken>[0]> = {}) {
  return firmarToken({ tipo: "cid", mensajeId: "msg_1", instanciaId: "inst_A", recurso: "logo", exp: expiracionNueva(), ...extra })!;
}

async function pedir(t: string) {
  return GET(new NextRequest(`http://localhost:3000/api/correo-aislado/cid?t=${encodeURIComponent(t)}`));
}

describe("GET /api/correo-aislado/cid", () => {
  const original = process.env.CORREO_VISTA_SECRETO;
  beforeEach(() => {
    process.env.CORREO_VISTA_SECRETO = "secreto-de-prueba-de-al-menos-32-bytes!!";
    correoMock.mockImplementation(async (id: string, inst: string) => (id === "msg_1" && inst === "inst_A" ? CORREO : null));
    mediaMock.mockImplementation(async (args: { where: { id: string; instanciaId: string } }) =>
      args.where.id === "ma_logo" && args.where.instanciaId === "inst_A"
        ? { keyOptimizado: "inst_A/conversaciones/logo.webp", mimeOptimizado: "image/webp" }
        : null,
    );
    descargaMock.mockResolvedValue({ buffer: Buffer.from("RIFF0000WEBP"), contentType: "image/webp" });
  });
  afterEach(() => {
    process.env.CORREO_VISTA_SECRETO = original;
    vi.clearAllMocks();
  });

  it("cid del correo → webp con cabeceras seguras", async () => {
    const res = await pedir(token());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(descargaMock).toHaveBeenCalledWith("inst_A/conversaciones/logo.webp");
  });

  it("un token de vista o de imagen no sirve para cid", async () => {
    const vista = firmarToken({ tipo: "vista", mensajeId: "msg_1", instanciaId: "inst_A", exp: expiracionNueva() })!;
    expect((await pedir(vista)).status).toBe(404);
  });

  it("un cid que no está en el mapa del correo → 404", async () => {
    expect((await pedir(token({ recurso: "otro" }))).status).toBe(404);
  });

  it("otro comercio → 404", async () => {
    expect((await pedir(token({ instanciaId: "inst_B" }))).status).toBe(404);
  });

  it("un MediaArchivo de otro comercio → 404", async () => {
    mediaMock.mockResolvedValue(null);
    expect((await pedir(token())).status).toBe(404);
  });

  it("nunca sirve un archivo que no sea la versión webp procesada", async () => {
    mediaMock.mockResolvedValue({ keyOptimizado: "x.svg", mimeOptimizado: "image/svg+xml" });
    expect((await pedir(token())).status).toBe(404);
  });
});

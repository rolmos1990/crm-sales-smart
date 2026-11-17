import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { expiracionNueva, firmarToken } from "@/integraciones/email/vista/token";

const correoMock = vi.fn();
const proxyMock = vi.fn();

vi.mock("@/integraciones/email/vista/queries", () => ({
  obtenerCorreoDeMensaje: (id: string, inst: string) => correoMock(id, inst),
}));
vi.mock("@/integraciones/email/vista/proxy-imagen", () => ({
  descargarImagenSegura: (url: string) => proxyMock(url),
}));

const { GET } = await import("./route");

const CORREO: CorreoDeMensaje = {
  mensajeId: "msg_1",
  instanciaId: "inst_A",
  estadoHtml: "DISPONIBLE",
  htmlLimpio: "<p>x</p>",
  tieneImagenesExternas: true,
  imagenesExternas: ["https://cdn.remitente.test/logo.png"],
  adjuntos: [],
  de: null, para: [], paraTotal: 0, cc: [], ccTotal: 0, asunto: null, fechaEnvio: null,
};

function token(extra: Partial<Parameters<typeof firmarToken>[0]> = {}) {
  return firmarToken({ tipo: "imagen", mensajeId: "msg_1", instanciaId: "inst_A", recurso: "0", exp: expiracionNueva(), ...extra })!;
}

async function pedir(t: string) {
  return GET(new NextRequest(`http://localhost:3000/api/correo-aislado/imagen?t=${encodeURIComponent(t)}`));
}

describe("GET /api/correo-aislado/imagen", () => {
  const original = process.env.CORREO_VISTA_SECRETO;
  beforeEach(() => {
    process.env.CORREO_VISTA_SECRETO = "secreto-de-prueba-de-al-menos-32-bytes!!";
    correoMock.mockImplementation(async (id: string, inst: string) => (id === "msg_1" && inst === "inst_A" ? CORREO : null));
    proxyMock.mockResolvedValue({ ok: true, webp: Buffer.from("RIFF0000WEBP") });
  });
  afterEach(() => {
    process.env.CORREO_VISTA_SECRETO = original;
    vi.clearAllMocks();
  });

  it("descarga SOLO la URL del índice que trae el correo", async () => {
    const res = await pedir(token());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(proxyMock).toHaveBeenCalledWith("https://cdn.remitente.test/logo.png");
  });

  it("un índice fuera de rango o no numérico → 404, sin descargar nada", async () => {
    expect((await pedir(token({ recurso: "1" }))).status).toBe(404);
    expect((await pedir(token({ recurso: "http://169.254.169.254/" }))).status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it("otro comercio → 404", async () => {
    expect((await pedir(token({ instanciaId: "inst_B" }))).status).toBe(404);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it("un token de cid no sirve para el proxy", async () => {
    const cid = firmarToken({ tipo: "cid", mensajeId: "msg_1", instanciaId: "inst_A", recurso: "0", exp: expiracionNueva() })!;
    expect((await pedir(cid)).status).toBe(404);
  });

  it("si el proxy rechaza, 404 sin detalle", async () => {
    proxyMock.mockResolvedValue({ ok: false, motivo: "DIRECCION_BLOQUEADA" });
    const res = await pedir(token());
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("DIRECCION_BLOQUEADA");
  });
});

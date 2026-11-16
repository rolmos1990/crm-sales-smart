import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { expiracionNueva, firmarToken, verificarToken } from "@/integraciones/email/vista/token";

const correoMock = vi.fn();
vi.mock("@/integraciones/email/vista/queries", () => ({
  obtenerCorreoDeMensaje: (id: string, instanciaId: string) => correoMock(id, instanciaId),
}));

const { GET } = await import("./route");

const BASE: CorreoDeMensaje = {
  mensajeId: "msg_1",
  instanciaId: "inst_A",
  estadoHtml: "DISPONIBLE",
  htmlLimpio:
    '<p>Hola</p><img src="cid:logo"><img data-karia-externa="0"><script>alert(1)</script>',
  tieneImagenesExternas: true,
  imagenesExternas: ["https://t.test/p.gif"],
  adjuntos: [{ mediaArchivoId: "ma_2", nombre: "logo.png", mimeType: "image/png", bytes: 3, cid: "logo", enLinea: true }],
  de: null,
  para: [],
  paraTotal: 0,
  cc: [],
  ccTotal: 0,
  asunto: null,
  fechaEnvio: null,
};

function token(extra: Partial<Parameters<typeof firmarToken>[0]> = {}) {
  return firmarToken({ tipo: "vista", mensajeId: "msg_1", instanciaId: "inst_A", imagenes: false, exp: expiracionNueva(), ...extra })!;
}

async function pedir(t: string | null) {
  const url = new URL("http://localhost:3000/api/correo-aislado/vista");
  if (t !== null) url.searchParams.set("t", t);
  const res = await GET(new NextRequest(url));
  return { res, cuerpo: await res.text() };
}

describe("GET /api/correo-aislado/vista", () => {
  const original = { secreto: process.env.CORREO_VISTA_SECRETO, app: process.env.APP_URL };
  beforeEach(() => {
    process.env.CORREO_VISTA_SECRETO = "secreto-de-prueba-de-al-menos-32-bytes!!";
    delete process.env.APP_URL;
    correoMock.mockImplementation(async (id: string, instanciaId: string) =>
      id === "msg_1" && instanciaId === "inst_A" ? BASE : null,
    );
  });
  afterEach(() => {
    process.env.CORREO_VISTA_SECRETO = original.secreto;
    process.env.APP_URL = original.app;
    vi.clearAllMocks();
  });

  it("token válido → documento con todas las cabeceras de seguridad", async () => {
    const { res, cuerpo } = await pedir(token());
    expect(res.status).toBe(200);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("sandbox allow-popups allow-popups-to-escape-sandbox");
    expect(csp).not.toMatch(/allow-scripts|allow-same-origin/);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(cuerpo).toContain("<p>Hola</p>");
    // Defensa en profundidad: lo que estuviera guardado de más sale limpio.
    expect(cuerpo).not.toContain("<script");
  });

  it("las imágenes cid salen como ruta firmada de Karia y las externas bloqueadas", async () => {
    const { cuerpo } = await pedir(token());
    const cid = cuerpo.match(/src="(http:\/\/localhost:3000\/api\/correo-aislado\/cid\?t=[^"]+)"/);
    expect(cid).not.toBeNull();
    const tCid = new URL(cid![1].replaceAll("&amp;", "&")).searchParams.get("t");
    expect(verificarToken(tCid, "cid")).toMatchObject({ mensajeId: "msg_1", instanciaId: "inst_A", recurso: "logo" });
    expect(cuerpo).not.toContain("correo-aislado/imagen");
    expect(cuerpo).not.toContain("t.test");
  });

  it("con permiso de imágenes, las externas apuntan al proxy firmado", async () => {
    const { cuerpo } = await pedir(token({ imagenes: true }));
    expect(cuerpo).toMatch(/src="http:\/\/localhost:3000\/api\/correo-aislado\/imagen\?t=/);
    expect(cuerpo).not.toContain("t.test");
  });

  it("token ausente, alterado o de otro tipo → 404", async () => {
    expect((await pedir(null)).res.status).toBe(404);
    const t = token();
    expect((await pedir(t.slice(0, -2) + "xx")).res.status).toBe(404);
    const cid = firmarToken({ tipo: "cid", mensajeId: "msg_1", instanciaId: "inst_A", recurso: "logo", exp: expiracionNueva() })!;
    expect((await pedir(cid)).res.status).toBe(404);
  });

  it("token vencido → 404", async () => {
    const vencido = firmarToken({ tipo: "vista", mensajeId: "msg_1", instanciaId: "inst_A", exp: Math.floor(Date.now() / 1000) - 1 })!;
    expect((await pedir(vencido)).res.status).toBe(404);
  });

  it("token válido pero de otro comercio → 404", async () => {
    expect((await pedir(token({ instanciaId: "inst_B" }))).res.status).toBe(404);
    expect(correoMock).toHaveBeenCalledWith("msg_1", "inst_B");
  });

  it("correo sin HTML disponible → 404", async () => {
    correoMock.mockResolvedValue({ ...BASE, estadoHtml: "NO_DISPONIBLE", htmlLimpio: null });
    expect((await pedir(token())).res.status).toBe(404);
  });
});

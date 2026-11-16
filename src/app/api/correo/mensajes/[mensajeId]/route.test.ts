import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { MensajeCorreoParaSesion, CorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { verificarToken } from "@/integraciones/email/vista/token";

const sesionMock = vi.fn();
const datosMock = vi.fn();

vi.mock("@/shared/auth/sesion", () => ({ obtenerSesionActual: () => sesionMock() }));
vi.mock("@/integraciones/email/vista/queries", () => ({
  // La consulta real filtra por instanciaId: el mock reproduce ese contrato.
  obtenerMensajeCorreoParaSesion: (id: string, instanciaId: string) => datosMock(id, instanciaId),
}));

const { GET } = await import("./route");

function correo(extra: Partial<CorreoDeMensaje> = {}): CorreoDeMensaje {
  return {
    mensajeId: "msg_1",
    instanciaId: "inst_A",
    estadoHtml: "DISPONIBLE",
    htmlLimpio: "<p>hola</p>",
    tieneImagenesExternas: true,
    imagenesExternas: ["https://t.test/p.gif"],
    adjuntos: [
      { mediaArchivoId: "ma_1", nombre: "factura.pdf", mimeType: "application/pdf", bytes: 1200, cid: null, enLinea: false },
      { mediaArchivoId: "ma_2", nombre: "logo.png", mimeType: "image/png", bytes: 300, cid: "logo", enLinea: true },
    ],
    de: { nombre: "Juan", direccion: "juan@cliente.test" },
    para: [{ nombre: null, direccion: "ventas@negocio.test" }],
    paraTotal: 1,
    cc: [],
    ccTotal: 0,
    asunto: "Hola",
    fechaEnvio: new Date("2026-11-16T10:00:00Z"),
    ...extra,
  };
}

function datos(c: CorreoDeMensaje | null): MensajeCorreoParaSesion {
  return { mensajeId: "msg_1", mediaArchivoId: null, remitente: "CONTACTO", correo: c };
}

async function pedir(id = "msg_1") {
  const res = await GET(new NextRequest(`http://localhost:3000/api/correo/mensajes/${id}`), {
    params: Promise.resolve({ mensajeId: id }),
  });
  return { res, cuerpo: await res.json() };
}

describe("GET /api/correo/mensajes/[mensajeId]", () => {
  const original = process.env.CORREO_VISTA_SECRETO;
  beforeEach(() => {
    process.env.CORREO_VISTA_SECRETO = "secreto-de-prueba-de-al-menos-32-bytes!!";
    sesionMock.mockResolvedValue({ instanciaId: "inst_A" });
    datosMock.mockImplementation(async (_id: string, instanciaId: string) =>
      instanciaId === "inst_A" ? datos(correo()) : null,
    );
  });
  afterEach(() => {
    process.env.CORREO_VISTA_SECRETO = original;
    vi.clearAllMocks();
  });

  it("un usuario de otro comercio recibe 404", async () => {
    sesionMock.mockResolvedValue({ instanciaId: "inst_B" });
    const { res } = await pedir();
    expect(res.status).toBe(404);
    expect(datosMock).toHaveBeenCalledWith("msg_1", "inst_B");
  });

  it("sin sesión → 404", async () => {
    sesionMock.mockResolvedValue(null);
    expect((await pedir()).res.status).toBe(404);
  });

  it("mensaje inexistente → 404", async () => {
    datosMock.mockResolvedValue(null);
    expect((await pedir("no-existe")).res.status).toBe(404);
  });

  it("correo previo a 035: cabeceras null y sin HTML", async () => {
    datosMock.mockResolvedValue(datos(null));
    const { res, cuerpo } = await pedir();
    expect(res.status).toBe(200);
    expect(cuerpo.cabeceras).toBeNull();
    expect(cuerpo.html.estado).toBe("SIN_HTML");
    expect(cuerpo.html.urlVista).toBeNull();
  });

  it("HTML disponible: devuelve URLs firmadas verificables y del comercio de la sesión", async () => {
    const { res, cuerpo } = await pedir();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");

    const t = new URL(cuerpo.html.urlVista).searchParams.get("t");
    expect(verificarToken(t, "vista")).toMatchObject({ mensajeId: "msg_1", instanciaId: "inst_A", imagenes: false });
    const tImg = new URL(cuerpo.html.urlVistaConImagenes).searchParams.get("t");
    expect(verificarToken(tImg, "vista")).toMatchObject({ imagenes: true });
  });

  it("sin CORREO_VISTA_SECRETO la vista se ofrece como no disponible", async () => {
    delete process.env.CORREO_VISTA_SECRETO;
    const { cuerpo } = await pedir();
    expect(cuerpo.html).toMatchObject({ estado: "NO_DISPONIBLE", urlVista: null, urlVistaConImagenes: null });
  });

  it("nunca expone HTML, URLs externas, claves de storage ni configuración", async () => {
    const { cuerpo } = await pedir();
    const texto = JSON.stringify(cuerpo);
    expect(texto).not.toContain("<p>hola</p>");
    expect(texto).not.toContain("htmlLimpio");
    expect(texto).not.toContain("t.test");
    expect(texto).not.toContain("imagenesExternas");
    expect(texto).not.toMatch(/keyOptimizado|configuracion/);
  });

  it("lista solo los adjuntos que no van en línea, con URL de descarga", async () => {
    const { cuerpo } = await pedir();
    expect(cuerpo.adjuntos).toEqual([
      {
        id: "ma_1",
        nombre: "factura.pdf",
        mimeType: "application/pdf",
        bytes: 1200,
        urlDescarga: "/api/correo/mensajes/msg_1/adjuntos/ma_1",
      },
    ]);
  });
});

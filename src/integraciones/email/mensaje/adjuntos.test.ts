import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Attachment } from "mailparser";

const subirImagenConversacion = vi.fn();
const guardarArchivoRaw = vi.fn();

vi.mock("@/lib/media/services/media-conversacion.service", () => ({
  subirImagenConversacion: (...a: unknown[]) => subirImagenConversacion(...a),
}));
vi.mock("@/lib/media/services/media-raw.service", () => ({
  guardarArchivoRaw: (...a: unknown[]) => guardarArchivoRaw(...a),
}));

const { guardarAdjuntos, avisoAdjuntosDescartados, MAX_ADJUNTOS, MAX_BYTES_ADJUNTO } = await import(
  "./adjuntos"
);

function adjunto(nombre: string, mime: string, bytes = 1024): Attachment {
  return { filename: nombre, contentType: mime, content: Buffer.alloc(bytes, 1) } as Attachment;
}

const CTX = { instanciaId: "inst-1" };

beforeEach(() => {
  vi.clearAllMocks();
  subirImagenConversacion.mockResolvedValue({
    mediaArchivoId: "media-img",
    urlThumbnail: "http://x/t.webp",
    urlOptimizada: "http://x/o.webp",
  });
  guardarArchivoRaw.mockResolvedValue({ id: "media-doc", urlOptimizada: "http://x/d.pdf" });
});

describe("guardarAdjuntos — reutiliza los dos caminos que ya existen", () => {
  it("una imagen va por el servicio de imágenes de conversaciones", async () => {
    const r = await guardarAdjuntos([adjunto("foto.jpg", "image/jpeg")], CTX);

    expect(subirImagenConversacion).toHaveBeenCalledTimes(1);
    expect(guardarArchivoRaw).not.toHaveBeenCalled();
    expect(r.guardados[0]).toMatchObject({
      mediaArchivoId: "media-img",
      esImagen: true,
      nombre: "foto.jpg",
    });
  });

  it("un PDF va por el almacenamiento raw", async () => {
    const r = await guardarAdjuntos([adjunto("cotizacion.pdf", "application/pdf")], CTX);

    expect(guardarArchivoRaw).toHaveBeenCalledTimes(1);
    expect(subirImagenConversacion).not.toHaveBeenCalled();
    expect(r.guardados[0]).toMatchObject({ mediaArchivoId: "media-doc", esImagen: false });
  });

  it("marca el canal de origen como correo", async () => {
    await guardarAdjuntos([adjunto("doc.pdf", "application/pdf")], CTX);

    expect(guardarArchivoRaw.mock.calls[0][0]).toMatchObject({
      canalOrigen: "email",
      instanciaId: "inst-1",
    });
  });
});

describe("guardarAdjuntos — límites y fallos", () => {
  it("descarta el adjunto que supera el tope de tamaño", async () => {
    const r = await guardarAdjuntos(
      [adjunto("enorme.pdf", "application/pdf", MAX_BYTES_ADJUNTO + 1)],
      CTX,
    );

    expect(r.guardados).toHaveLength(0);
    expect(r.descartados[0].nombre).toBe("enorme.pdf");
    expect(r.descartados[0].motivo).toMatch(/MB/);
    expect(guardarArchivoRaw).not.toHaveBeenCalled();
  });

  it("descarta el adjunto vacío", async () => {
    const r = await guardarAdjuntos([adjunto("vacio.pdf", "application/pdf", 0)], CTX);

    expect(r.guardados).toHaveLength(0);
    expect(r.descartados[0].motivo).toMatch(/vac/i);
  });

  it("procesa hasta el tope por correo y anota el resto", async () => {
    const muchos = Array.from({ length: MAX_ADJUNTOS + 2 }, (_, i) =>
      adjunto(`doc-${i}.pdf`, "application/pdf"),
    );

    const r = await guardarAdjuntos(muchos, CTX);

    expect(r.guardados).toHaveLength(MAX_ADJUNTOS);
    expect(r.descartados).toHaveLength(2);
  });

  it("un formato no soportado no tumba el resto del correo", async () => {
    guardarArchivoRaw.mockRejectedValueOnce(new Error("Tipo de archivo no soportado"));

    const r = await guardarAdjuntos(
      [adjunto("raro.xyz", "application/x-raro"), adjunto("ok.pdf", "application/pdf")],
      CTX,
    );

    expect(r.descartados[0].nombre).toBe("raro.xyz");
    expect(r.guardados).toHaveLength(1);
  });

  it("un adjunto sin nombre recibe uno derivado de su posición", async () => {
    const sinNombre = { contentType: "application/pdf", content: Buffer.alloc(10, 1) } as Attachment;

    const r = await guardarAdjuntos([sinNombre], CTX);

    expect(r.guardados[0].nombre).toBe("adjunto-1");
  });

  it("sin adjuntos no hace nada", async () => {
    const r = await guardarAdjuntos([], CTX);

    expect(r).toEqual({ guardados: [], descartados: [] });
  });
});

describe("aviso de adjuntos descartados", () => {
  it("sin descartes no agrega nada al cuerpo", () => {
    expect(avisoAdjuntosDescartados([])).toBe("");
  });

  it("lista los nombres y el motivo", () => {
    const aviso = avisoAdjuntosDescartados([{ nombre: "enorme.pdf", motivo: "supera los 10 MB" }]);

    expect(aviso).toContain("enorme.pdf");
    expect(aviso).toContain("supera los 10 MB");
  });
});

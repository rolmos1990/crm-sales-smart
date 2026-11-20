import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// 048 — Test de integración del webhook (hallazgo C1 de /speckit-analyze): la
// garantía "nunca una URL de Meta" (FR-001) depende de que AMBAS publicaciones
// (PROCESAR_ENTRANTE y PROCESAR_MENSAJE_APP_NATIVA) usen el payload ya
// preparado. Prueba de punta a punta del handler con Prisma, RabbitMQ, la firma
// y el storage simulados; los providers de Instagram/Messenger son los reales.

const publicar = vi.fn();
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: (...a: unknown[]) => publicar(...a) } }));
vi.mock("@/shared/lib/verificar-firma-webhook-meta", () => ({ verificarFirmaWebhookMeta: () => true }));
vi.mock("@/shared/lib/cifrado-tokens", () => ({ descifrarToken: (t: string) => t }));
vi.mock("@/conversaciones/providers/registry", async () => {
  const { InstagramProvider } = await import("@/conversaciones/providers/instagram");
  const { FacebookMessengerProvider } = await import("@/conversaciones/providers/facebook-messenger");
  const providers: Record<string, unknown> = {
    instagram: new InstagramProvider(),
    facebook_messenger: new FacebookMessengerProvider(),
  };
  return { obtenerProvider: (canal: string) => providers[canal] };
});

const guardarArchivoRaw = vi.fn();
const subirImagenConversacion = vi.fn();
vi.mock("@/lib/media/services/media-raw.service", () => ({
  guardarArchivoRaw: (...a: unknown[]) => guardarArchivoRaw(...a),
}));
vi.mock("@/lib/media/services/media-conversacion.service", () => ({
  subirImagenConversacion: (...a: unknown[]) => subirImagenConversacion(...a),
}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    cuentaCanal: {
      findFirst: vi.fn(async ({ where }: { where: { canal: string } }) =>
        where.canal === "instagram"
          ? { id: "cc-ig", instanciaId: "inst1", configuracion: { accessToken: "tok" } }
          : null,
      ),
    },
    mensajeConversacion: { findFirst: vi.fn(async () => null) },
    contactoIdentificadorCanal: {
      findFirst: vi.fn(async () => null),
      // Contacto conocido con perfil completo: evita la llamada a Graph API.
      findUnique: vi.fn(async () => ({ contacto: { nombre: "Ana", avatarUrl: "/a.webp" } })),
    },
  },
}));

const { POST } = await import("./route");

const HOSTS_META = /fbsbx|fbcdn|cdninstagram|instagram\.com|facebook\.com/;
const URL_META = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=abc";

function webhook(messaging: unknown[]) {
  return new NextRequest("http://localhost/api/webhooks/instagram", {
    method: "POST",
    body: JSON.stringify({ object: "instagram", entry: [{ id: "igbiz1", messaging }] }),
  });
}

function evento(mid: string, message: Record<string, unknown>) {
  return { sender: { id: "igsid1" }, recipient: { id: "igbiz1" }, timestamp: 1, message: { mid, ...message } };
}

function publicados(comando: string) {
  return publicar.mock.calls.filter((c) => c[0] === comando).map((c) => c[2] as Record<string, unknown>);
}

describe("POST /api/webhooks/instagram — FR-001", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    publicar.mockReset();
    guardarArchivoRaw.mockReset();
    subirImagenConversacion.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("adjunto no reconocido → PROCESAR_ENTRANTE sin URL de Meta ni campos internos, sin descargar nada", async () => {
    const res = await POST(webhook([evento("m1", { attachments: [{ type: "template", payload: { url: URL_META } }] })]));
    expect(res.status).toBe(200);

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toBeDefined();
    expect(JSON.stringify(payload)).not.toMatch(HOSTS_META);
    expect(payload).not.toHaveProperty("familiaAdjunto");
    expect(payload.contenido).toBe("Envió un contenido que Instagram no permite mostrar");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("eco de la app nativa con adjunto no reconocido → PROCESAR_MENSAJE_APP_NATIVA también limpio", async () => {
    await POST(
      webhook([
        {
          sender: { id: "igbiz1" },
          recipient: { id: "igsid1" },
          timestamp: 1,
          message: { mid: "m2", is_echo: true, attachments: [{ type: "fallback", payload: { url: URL_META } }] },
        },
      ]),
    );

    const [payload] = publicados("PROCESAR_MENSAJE_APP_NATIVA");
    expect(payload).toBeDefined();
    expect(JSON.stringify(payload)).not.toMatch(HOSTS_META);
    expect(payload).not.toHaveProperty("familiaAdjunto");
    expect(publicados("PROCESAR_ENTRANTE")).toHaveLength(0);
  });

  it("video directo conservado → se publica la URL propia del storage", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4" } }),
    );
    guardarArchivoRaw.mockResolvedValue({ id: "ma1", urlOptimizada: "/cdn/inst1/conversaciones/originals/v.mp4" });

    await POST(webhook([evento("m3", { attachments: [{ type: "video", payload: { url: URL_META } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({
      tipo: "VIDEO",
      mediaUrl: "/cdn/inst1/conversaciones/originals/v.mp4",
      mediaMimeType: "video/mp4",
      mediaArchivoId: "ma1",
    });
    expect(JSON.stringify(payload)).not.toMatch(HOSTS_META);
  });

  it("regresión: video directo que no se pudo descargar → VIDEO sin media y sin URL de Meta", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await POST(webhook([evento("m4", { attachments: [{ type: "video", payload: { url: URL_META } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload.tipo).toBe("VIDEO");
    expect(payload.mediaUrl).toBeUndefined();
    expect(payload.contenido).toBeUndefined();
    expect(guardarArchivoRaw).not.toHaveBeenCalled();
  });

  it("FR-008: un adjunto que falla no impide procesar el resto del lote", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));

    await POST(
      webhook([
        evento("m5", { attachments: [{ type: "video", payload: { url: URL_META } }] }),
        evento("m6", { text: "¿precio?" }),
      ]),
    );

    const payloads = publicados("PROCESAR_ENTRANTE");
    expect(payloads.map((p) => p.idExterno)).toEqual(["m5", "m6"]);
    expect(JSON.stringify(payloads)).not.toMatch(HOSTS_META);
  });
});

describe("POST /api/webhooks/instagram — contenido compartido (US3)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    publicar.mockReset();
    guardarArchivoRaw.mockReset();
    subirImagenConversacion.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Reel → solo texto, sin descargar ni guardar nada (SC-005)", async () => {
    await POST(webhook([evento("r1", { attachments: [{ type: "ig_reel", payload: { url: URL_META, title: "Promo" } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({ tipo: "TEXTO", contenido: "Compartió un Reel: «Promo»" });
    expect(payload.mediaUrl).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(guardarArchivoRaw).not.toHaveBeenCalled();
    expect(subirImagenConversacion).not.toHaveBeenCalled();
  });

  it("publicación con imagen → IMAGEN guardada en el storage + texto", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } }),
    );
    subirImagenConversacion.mockResolvedValue({ rechazada: false, urlOptimizada: "/cdn/inst1/img.webp", mediaArchivoId: "ma9" });

    await POST(webhook([evento("p1", { attachments: [{ type: "ig_post", payload: { url: URL_META } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({
      tipo: "IMAGEN",
      contenido: "Compartió una publicación",
      mediaUrl: "/cdn/inst1/img.webp",
      mediaArchivoId: "ma9",
    });
    expect(subirImagenConversacion).toHaveBeenCalledWith(expect.objectContaining({ instanciaId: "inst1", canal: "instagram" }));
    expect(JSON.stringify(payload)).not.toMatch(HOSTS_META);
  });

  it("mención en historia de video → no se guarda, queda el texto sin aclaración de fallo", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4" } }),
    );

    await POST(webhook([evento("s1", { attachments: [{ type: "story_mention", payload: { url: URL_META } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({ tipo: "TEXTO", contenido: "Te mencionó en su historia" });
    expect(payload.mediaUrl).toBeUndefined();
    expect(subirImagenConversacion).not.toHaveBeenCalled();
    expect(guardarArchivoRaw).not.toHaveBeenCalled();
  });

  it("publicación cuya imagen no se puede descargar → texto con aclaración", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    await POST(webhook([evento("p2", { attachments: [{ type: "share", payload: { url: URL_META } }] })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({ tipo: "TEXTO", contenido: "Compartió una publicación (no se pudo guardar la imagen)" });
    expect(payload.mediaUrl).toBeUndefined();
  });

  it("respuesta a historia → conserva el texto del contacto y guarda la imagen de la historia", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/jpeg" } }),
    );
    subirImagenConversacion.mockResolvedValue({ rechazada: false, urlOptimizada: "/cdn/inst1/st.webp", mediaArchivoId: "ma10" });

    await POST(webhook([evento("s2", { text: "¿lo tienen en azul?", reply_to: { story: { url: URL_META, id: "st1" } } })]));

    const [payload] = publicados("PROCESAR_ENTRANTE");
    expect(payload).toMatchObject({
      tipo: "IMAGEN",
      contenido: "Respondió a tu historia: ¿lo tienen en azul?",
      mediaUrl: "/cdn/inst1/st.webp",
    });
  });
});

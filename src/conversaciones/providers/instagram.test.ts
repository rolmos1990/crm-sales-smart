import { describe, expect, it, vi, afterEach } from "vitest";
import { InstagramProvider, clasificarErrorInstagram } from "./instagram";
import { EnvioMensajeError } from "../errores";

describe("clasificarErrorInstagram", () => {
  it("Caso H — code 10 con subcode de ventana vencida (2534022) → FUERA_VENTANA_MENSAJERIA, no reintentable", () => {
    const err = clasificarErrorInstagram(400, { error: { code: 10, error_subcode: 2534022, message: "outside window" } }, false);
    expect(err).toBeInstanceOf(EnvioMensajeError);
    expect(err.codigo).toBe("FUERA_VENTANA_MENSAJERIA");
    expect(err.reintentable).toBe(false);
  });

  it("code 10 en una request que sí usó tag HUMAN_AGENT (sin el subcode de ventana) → HUMAN_AGENT_NO_APROBADO, no reintentable", () => {
    const err = clasificarErrorInstagram(
      400,
      { error: { code: 10, message: "To use 'Human Agent', your use of this endpoint must be reviewed and approved by Facebook." } },
      true
    );
    expect(err.codigo).toBe("HUMAN_AGENT_NO_APROBADO");
    expect(err.reintentable).toBe(false);
  });

  it("code 10 sin tag HUMAN_AGENT y sin subcode de ventana → PERMISO_DENEGADO_META, no reintentable", () => {
    const err = clasificarErrorInstagram(400, { error: { code: 10, message: "permission denied" } }, false);
    expect(err.codigo).toBe("PERMISO_DENEGADO_META");
    expect(err.reintentable).toBe(false);
  });

  it("code 190 (token inválido/vencido) → TOKEN_INVALIDO, no reintentable", () => {
    const err = clasificarErrorInstagram(401, { error: { code: 190, message: "invalid token" } }, false);
    expect(err.codigo).toBe("TOKEN_INVALIDO");
    expect(err.reintentable).toBe(false);
  });

  it("Caso F — HTTP 429 → RATE_LIMIT, reintentable", () => {
    const err = clasificarErrorInstagram(429, { error: { message: "too many requests" } }, false);
    expect(err.codigo).toBe("RATE_LIMIT");
    expect(err.reintentable).toBe(true);
  });

  it("Caso G — HTTP 500/502/503 → ERROR_TEMPORAL_META, reintentable", () => {
    for (const status of [500, 502, 503]) {
      const err = clasificarErrorInstagram(status, { error: { message: "server error" } }, false);
      expect(err.codigo).toBe("ERROR_TEMPORAL_META");
      expect(err.reintentable).toBe(true);
    }
  });

  it("error desconocido/sin clasificar → conservador, reintentable", () => {
    const err = clasificarErrorInstagram(400, { error: { code: 999, message: "algo nuevo" } }, false);
    expect(err.codigo).toBe("ERROR_DESCONOCIDO_META");
    expect(err.reintentable).toBe(true);
  });
});

describe("InstagramProvider.enviarMensaje", () => {
  const configuracion = { accessToken: "tok", instagramBusinessAccountId: "igid", proveedorAuth: "Instagram" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Caso A/B — sin tag: manda messaging_type RESPONSE, sin campo tag", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid_1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new InstagramProvider();
    const result = await provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion });

    expect(result.idExterno).toBe("mid_1");
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messaging_type).toBe("RESPONSE");
    expect(body.tag).toBeUndefined();
  });

  it("Caso C — con tag HUMAN_AGENT: manda messaging_type MESSAGE_TAG + tag", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid_2" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new InstagramProvider();
    await provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion, tag: "HUMAN_AGENT" });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messaging_type).toBe("MESSAGE_TAG");
    expect(body.tag).toBe("HUMAN_AGENT");
  });

  it("Caso H — Meta responde code 10 → tira EnvioMensajeError no reintentable, no un Error genérico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 10, error_subcode: 2534022, message: "outside window" } }),
    }));

    const provider = new InstagramProvider();
    await expect(
      provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion })
    ).rejects.toMatchObject({ codigo: "FUERA_VENTANA_MENSAJERIA", reintentable: false });
  });

  it("timeout / error de red (fetch tira antes de responder) → ERROR_RED, reintentable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));

    const provider = new InstagramProvider();
    await expect(
      provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion })
    ).rejects.toMatchObject({ codigo: "ERROR_RED", reintentable: true });
  });
});

describe("InstagramProvider.mapearEntrante", () => {
  const provider = new InstagramProvider();

  it("mensaje de texto normal: usa sender.id como identificadorContacto", () => {
    const normalizado = provider.mapearEntrante({
      sender: { id: "igsid1" },
      recipient: { id: "igbizid" },
      timestamp: 123,
      message: { mid: "mid1", text: "hola" },
      cuentaCanalId: "cc1",
    });
    expect(normalizado).toMatchObject({
      canal: "instagram",
      identificadorContacto: "igsid1",
      cuentaCanalId: "cc1",
      contenido: "hola",
      tipo: "TEXTO",
      idExterno: "mid1",
    });
  });

  it("evento de eco (is_echo): usa recipient.id como identificadorContacto, no sender.id (research.md R4)", () => {
    const normalizado = provider.mapearEntrante({
      sender: { id: "igbizid" }, // en un eco, sender es la propia cuenta de Instagram
      recipient: { id: "igsid1" }, // recipient es el contacto real
      timestamp: 123,
      message: { mid: "mid2", text: "hola desde la app nativa", is_echo: true },
      cuentaCanalId: "cc1",
    });
    expect(normalizado.identificadorContacto).toBe("igsid1");
  });
});

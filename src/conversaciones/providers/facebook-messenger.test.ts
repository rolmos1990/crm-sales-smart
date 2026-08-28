import { describe, expect, it, vi, afterEach } from "vitest";
import { FacebookMessengerProvider } from "./facebook-messenger";
import { EnvioMensajeError } from "../errores";

describe("FacebookMessengerProvider.enviarMensaje", () => {
  const configuracion = { accessToken: "tok", pageId: "page1" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin tag: manda messaging_type RESPONSE, sin campo tag", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid_1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    const result = await provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion });

    expect(result.idExterno).toBe("mid_1");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/page1/messages");
    const body = JSON.parse(opts.body);
    expect(body.messaging_type).toBe("RESPONSE");
    expect(body.tag).toBeUndefined();
  });

  it("con tag HUMAN_AGENT: manda messaging_type MESSAGE_TAG + tag (research.md R5 — misma ventana que Instagram)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid_2" }) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    await provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion, tag: "HUMAN_AGENT" });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messaging_type).toBe("MESSAGE_TAG");
    expect(body.tag).toBe("HUMAN_AGENT");
  });

  it("Meta responde code 10 fuera de ventana → tira EnvioMensajeError no reintentable, reutilizando el mismo clasificador que Instagram (research.md R4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 10, error_subcode: 2534022, message: "outside window" } }),
    }));

    const provider = new FacebookMessengerProvider();
    await expect(
      provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion })
    ).rejects.toMatchObject({ codigo: "FUERA_VENTANA_MENSAJERIA", reintentable: false });
  });

  it("timeout / error de red → ERROR_RED, reintentable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));

    const provider = new FacebookMessengerProvider();
    await expect(
      provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion })
    ).rejects.toMatchObject({ codigo: "ERROR_RED", reintentable: true });
  });

  it("sin accessToken/pageId en configuracion → error claro, sin llegar a llamar a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    await expect(
      provider.enviarMensaje({ destinatario: "u1", contenido: "hola", tipo: "TEXTO", configuracion: {} })
    ).rejects.toThrow(/accessToken y pageId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("FacebookMessengerProvider.enviarReaccion", () => {
  const configuracion = { accessToken: "tok", pageId: "page1" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaccionar: manda sender_action react + payload.reaction con el emoji", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    await provider.enviarReaccion({
      jid: "psid1",
      idExternoMensaje: "mid1",
      fromMe: true,
      emoji: "❤️",
      configuracion,
    });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/page1/messages");
    const body = JSON.parse(opts.body);
    expect(body.sender_action).toBe("react");
    expect(body.payload).toEqual({ message_id: "mid1", reaction: "❤️" });
  });

  it("quitar reacción (emoji vacío): manda sender_action unreact, sin campo reaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    await provider.enviarReaccion({
      jid: "psid1",
      idExternoMensaje: "mid1",
      fromMe: true,
      emoji: "",
      configuracion,
    });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.sender_action).toBe("unreact");
    expect(body.payload).toEqual({ message_id: "mid1" });
  });

  it("Meta rechaza el envío → tira error con el detalle de Meta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "invalid message id" } }),
    }));

    const provider = new FacebookMessengerProvider();
    await expect(
      provider.enviarReaccion({ jid: "psid1", idExternoMensaje: "mid1", fromMe: true, emoji: "❤️", configuracion })
    ).rejects.toThrow(/invalid message id/);
  });

  it("sin accessToken/pageId en configuracion → error claro, sin llegar a llamar a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FacebookMessengerProvider();
    await expect(
      provider.enviarReaccion({ jid: "psid1", idExternoMensaje: "mid1", fromMe: true, emoji: "❤️", configuracion: {} })
    ).rejects.toThrow(/accessToken y pageId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("FacebookMessengerProvider.mapearEntrante", () => {
  const provider = new FacebookMessengerProvider();

  it("mensaje de texto", () => {
    const normalizado = provider.mapearEntrante({
      sender: { id: "psid1" },
      recipient: { id: "page1" },
      timestamp: 123,
      message: { mid: "mid1", text: "hola" },
      cuentaCanalId: "cc1",
    });
    expect(normalizado).toMatchObject({
      canal: "facebook_messenger",
      identificadorContacto: "psid1",
      cuentaCanalId: "cc1",
      contenido: "hola",
      tipo: "TEXTO",
      idExterno: "mid1",
    });
  });

  it("adjunto de imagen", () => {
    const normalizado = provider.mapearEntrante({
      sender: { id: "psid1" },
      recipient: { id: "page1" },
      timestamp: 123,
      message: { mid: "mid2", attachments: [{ type: "image", payload: { url: "https://x/img.jpg" } }] },
      cuentaCanalId: "cc1",
    });
    expect(normalizado.tipo).toBe("IMAGEN");
    expect(normalizado.mediaUrl).toBe("https://x/img.jpg");
  });

  it("adjunto de video", () => {
    const normalizado = provider.mapearEntrante({
      sender: { id: "psid1" },
      recipient: { id: "page1" },
      timestamp: 123,
      message: { mid: "mid3", attachments: [{ type: "video", payload: { url: "https://x/v.mp4" } }] },
      cuentaCanalId: "cc1",
    });
    expect(normalizado.tipo).toBe("VIDEO");
  });
});

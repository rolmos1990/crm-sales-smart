import { downloadMediaMessage } from "@whiskeysockets/baileys";

export interface DescargaMediaWA {
  buffer: Buffer;
  mimeType: string;
  duracion?: number;
}

export async function descargarMediaWA(rawMessage: unknown): Promise<DescargaMediaWA | null> {
  try {
    const msg = rawMessage as Record<string, unknown>;
    const message = msg.message as Record<string, unknown> | null | undefined;

    const audioMsg =
      (message?.audioMessage as Record<string, unknown> | undefined) ??
      (message?.pttMessage as Record<string, unknown> | undefined);

    if (!audioMsg) {
      console.warn("[descargarMediaWA] El mensaje no contiene audioMessage ni pttMessage");
      return null;
    }

    const stream = await downloadMediaMessage(
      rawMessage as Parameters<typeof downloadMediaMessage>[0],
      "buffer",
      {}
    );

    const buffer = stream instanceof Buffer ? stream : Buffer.from(stream as Uint8Array);

    if (!buffer || buffer.length === 0) {
      console.warn("[descargarMediaWA] Buffer vacío después de la descarga");
      return null;
    }

    const mimeType =
      (audioMsg.mimetype as string | undefined) ?? "audio/ogg; codecs=opus";
    const duracion =
      typeof audioMsg.seconds === "number" ? audioMsg.seconds : undefined;

    return { buffer, mimeType, duracion };
  } catch (e) {
    console.error("[descargarMediaWA] Error descargando media de WhatsApp:", e);
    return null;
  }
}

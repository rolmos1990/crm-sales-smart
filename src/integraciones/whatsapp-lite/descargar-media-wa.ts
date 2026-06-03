import { downloadMediaMessage } from "@whiskeysockets/baileys";

export type TipoMediaWA = "AUDIO" | "IMAGEN" | "VIDEO" | "DOCUMENTO" | "STICKER";

export interface DescargaMediaWA {
  buffer: Buffer;
  mimeType: string;
  duracion?: number;
  tipoMedia: TipoMediaWA;
}

export async function descargarMediaWA(rawMessage: unknown): Promise<DescargaMediaWA | null> {
  try {
    const msg = rawMessage as Record<string, unknown>;
    const message = msg.message as Record<string, unknown> | null | undefined;

    // Detectar tipo de media
    const audioMsg   = (message?.audioMessage as Record<string, unknown> | undefined);
    const pttMsg     = (message?.pttMessage as Record<string, unknown> | undefined);
    const imageMsg   = (message?.imageMessage as Record<string, unknown> | undefined);
    const videoMsg   = (message?.videoMessage as Record<string, unknown> | undefined);
    const docMsg     = (message?.documentMessage as Record<string, unknown> | undefined);
    const stickerMsg = (message?.stickerMessage as Record<string, unknown> | undefined);

    const mediaMsg = audioMsg ?? pttMsg ?? imageMsg ?? videoMsg ?? docMsg ?? stickerMsg;

    if (!mediaMsg) {
      console.warn("[descargarMediaWA] El mensaje no contiene media conocida");
      return null;
    }

    // Determinar tipo para logging y retorno
    let tipoMedia: TipoMediaWA;
    if (audioMsg || pttMsg) tipoMedia = "AUDIO";
    else if (imageMsg)      tipoMedia = "IMAGEN";
    else if (videoMsg)      tipoMedia = "VIDEO";
    else if (stickerMsg)    tipoMedia = "STICKER";
    else                    tipoMedia = "DOCUMENTO";

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

    // MIME por defecto según tipo
    const defaultMimes: Record<TipoMediaWA, string> = {
      AUDIO:     "audio/ogg; codecs=opus",
      IMAGEN:    "image/jpeg",
      VIDEO:     "video/mp4",
      DOCUMENTO: "application/octet-stream",
      STICKER:   "image/webp",
    };

    const mimeType = (mediaMsg.mimetype as string | undefined) ?? defaultMimes[tipoMedia];
    const duracion = (audioMsg ?? pttMsg) && typeof mediaMsg.seconds === "number"
      ? mediaMsg.seconds
      : undefined;

    return { buffer, mimeType, duracion, tipoMedia };
  } catch (e) {
    console.error("[descargarMediaWA] Error descargando media de WhatsApp:", e);
    return null;
  }
}

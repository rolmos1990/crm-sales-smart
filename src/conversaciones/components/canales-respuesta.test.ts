import { describe, expect, it } from "vitest";
import { canalesDeRespuesta } from "./canales-respuesta";
import type { ConversacionResumen } from "../types";

function conv(id: string, contactoId: string, cuentaId: string | null, canal: string, actualizado: string, extra: Partial<ConversacionResumen> = {}) {
  return {
    id,
    contactoId,
    cuentaCanalId: cuentaId,
    cuentaCanal: cuentaId ? { id: cuentaId, canal, nombre: `Cuenta ${cuentaId}`, identificador: "x" } : null,
    actualizadoEn: new Date(actualizado),
    ...extra,
  } as unknown as ConversacionResumen;
}

describe("canalesDeRespuesta", () => {
  const actual = conv("c-mail", "ana", "cta-mail", "email", "2026-11-16T10:00:00Z", { identificadorCanal: "ana@x.test" });

  it("solo con su canal: devuelve solo la conversación actual", () => {
    expect(canalesDeRespuesta(actual, [actual]).map((c) => c.conversacionId)).toEqual(["c-mail"]);
  });

  it("incluye los otros canales del MISMO contacto, la actual primero", () => {
    const wa = conv("c-wa", "ana", "cta-wa", "whatsapp_lite", "2026-11-15T10:00:00Z", { identificadorCanal: "+50760000000" });
    const ig = conv("c-ig", "ana", "cta-ig", "instagram", "2026-11-14T10:00:00Z", { handleCanal: "ana.ig" });
    const deOtro = conv("c-otro", "beto", "cta-wa", "whatsapp_lite", "2026-11-16T11:00:00Z");
    const r = canalesDeRespuesta(actual, [deOtro, wa, actual, ig]);
    expect(r.map((c) => c.conversacionId)).toEqual(["c-mail", "c-wa", "c-ig"]);
    expect(r.find((c) => c.canal === "instagram")?.identificadorContacto).toBe("@ana.ig");
  });

  it("por cada cuenta usa la conversación más reciente y nunca duplica la cuenta actual", () => {
    const waVieja = conv("c-wa-1", "ana", "cta-wa", "whatsapp_lite", "2026-10-01T00:00:00Z");
    const waNueva = conv("c-wa-2", "ana", "cta-wa", "whatsapp_lite", "2026-11-01T00:00:00Z");
    const otroCorreo = conv("c-mail-2", "ana", "cta-mail", "email", "2026-11-17T00:00:00Z");
    const r = canalesDeRespuesta(actual, [waVieja, waNueva, otroCorreo, actual]);
    expect(r.map((c) => c.conversacionId)).toEqual(["c-mail", "c-wa-2"]);
  });

  it("ignora conversaciones sin cuenta de canal (app nativa)", () => {
    const sinCuenta = conv("c-x", "ana", null, "", "2026-11-16T12:00:00Z");
    expect(canalesDeRespuesta(actual, [actual, sinCuenta])).toHaveLength(1);
  });
});

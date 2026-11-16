import { describe, expect, it } from "vitest";
import { canalesDeRespuesta } from "./canales-respuesta";
import type { ContactoResumen, ConversacionResumen, CuentaCanalResumen } from "../types";

const cuenta = (id: string, canal: string, nombre = `Cuenta ${id}`): CuentaCanalResumen => ({
  id,
  canal,
  nombre,
  identificador: `id-${id}`,
});

const CTA_MAIL = cuenta("cta-mail", "email", "Ventas");
const CTA_WA = cuenta("cta-wa", "whatsapp_lite", "WhatsApp Principal");
const CTA_IG = cuenta("cta-ig", "instagram", "@mitienda");
const CTA_MSG = cuenta("cta-msg", "facebook_messenger", "Página");

function conv(
  id: string,
  contactoId: string,
  cta: CuentaCanalResumen | null,
  actualizado: string,
  extra: Partial<ConversacionResumen> = {},
  contacto: Partial<ContactoResumen> = {},
) {
  return {
    id,
    contactoId,
    cuentaCanalId: cta?.id ?? null,
    cuentaCanal: cta,
    actualizadoEn: new Date(actualizado),
    contacto: { id: contactoId, telefonoPrincipal: null, email: null, identificadoresCanal: [], ...contacto },
    ...extra,
  } as unknown as ConversacionResumen;
}

describe("canalesDeRespuesta", () => {
  it("la cuenta actual va primero, con nombre e identificador de la cuenta", () => {
    const actual = conv("c-ig", "ana", CTA_IG, "2026-11-16T10:00:00Z", { handleCanal: "ana.ig" });
    const [primero] = canalesDeRespuesta(actual, [actual], [CTA_IG]);
    expect(primero).toMatchObject({
      conversacionId: "c-ig",
      cuentaCanalId: "cta-ig",
      nombreCuenta: "@mitienda",
      identificadorCuenta: "id-cta-ig",
      identificadorContacto: "@ana.ig",
    });
  });

  it("solo con su canal y sin datos de otros: devuelve solo la actual", () => {
    const actual = conv("c-ig", "ana", CTA_IG, "2026-11-16T10:00:00Z");
    const r = canalesDeRespuesta(actual, [actual], [CTA_MAIL, CTA_WA, CTA_IG, CTA_MSG]);
    expect(r.map((c) => c.cuentaCanalId)).toEqual(["cta-ig"]);
  });

  it("ofrece WhatsApp y correo sin conversación previa si el contacto tiene teléfono y correo", () => {
    const actual = conv("c-ig", "ana", CTA_IG, "2026-11-16T10:00:00Z", {}, { telefonoPrincipal: "+50760000000", email: "ana@x.test" });
    const r = canalesDeRespuesta(actual, [actual], [CTA_MAIL, CTA_WA, CTA_IG]);
    expect(r.map((c) => [c.cuentaCanalId, c.conversacionId, c.identificadorContacto])).toEqual([
      ["cta-ig", "c-ig", null],
      ["cta-mail", null, "ana@x.test"],
      ["cta-wa", null, "+50760000000"],
    ]);
  });

  it("WhatsApp usa el identificador guardado (ej. @lid) aunque falte el teléfono, con canal completo o base", () => {
    const actual = conv("c-mail", "ana", CTA_MAIL, "2026-11-16T10:00:00Z", {}, {
      identificadoresCanal: [{ canal: "whatsapp", identificador: "123@lid", handle: null }],
    });
    const r = canalesDeRespuesta(actual, [actual], [CTA_MAIL, CTA_WA]);
    expect(r.find((c) => c.cuentaCanalId === "cta-wa")?.identificadorContacto).toBe("123@lid");
  });

  it("Instagram/Messenger solo si el contacto ya tiene identificador en ese canal", () => {
    const actual = conv("c-wa", "ana", CTA_WA, "2026-11-16T10:00:00Z", {}, {
      telefonoPrincipal: "+50760000000",
      identificadoresCanal: [{ canal: "instagram", identificador: "IGSID1", handle: "ana.ig" }],
    });
    const r = canalesDeRespuesta(actual, [actual], [CTA_WA, CTA_IG, CTA_MSG]);
    expect(r.map((c) => c.cuentaCanalId)).toEqual(["cta-wa", "cta-ig"]);
    expect(r[1].identificadorContacto).toBe("@ana.ig");
  });

  it("con varias cuentas de Instagram solo ofrece la que ya tiene conversación (el IGSID es por cuenta)", () => {
    const CTA_IG2 = cuenta("cta-ig2", "instagram", "@otra");
    const contacto = { identificadoresCanal: [{ canal: "instagram", identificador: "IGSID1", handle: null }] };
    const actual = conv("c-mail", "ana", CTA_MAIL, "2026-11-16T10:00:00Z", {}, contacto);
    const ig = conv("c-ig", "ana", CTA_IG, "2026-11-15T10:00:00Z", {}, contacto);
    const r = canalesDeRespuesta(actual, [actual, ig], [CTA_MAIL, CTA_IG, CTA_IG2]);
    expect(r.map((c) => c.cuentaCanalId)).toEqual(["cta-mail", "cta-ig"]);
  });

  it("por cada cuenta usa la conversación más reciente del MISMO contacto", () => {
    const actual = conv("c-mail", "ana", CTA_MAIL, "2026-11-16T10:00:00Z");
    const waVieja = conv("c-wa-1", "ana", CTA_WA, "2026-10-01T00:00:00Z");
    const waNueva = conv("c-wa-2", "ana", CTA_WA, "2026-11-01T00:00:00Z", { identificadorCanal: "+50760000000" });
    const deOtro = conv("c-otro", "beto", CTA_WA, "2026-11-16T11:00:00Z");
    const r = canalesDeRespuesta(actual, [deOtro, waVieja, waNueva, actual], [CTA_MAIL, CTA_WA]);
    expect(r.map((c) => c.conversacionId)).toEqual(["c-mail", "c-wa-2"]);
    expect(r[1].identificadorContacto).toBe("+50760000000");
  });

  it("no ofrece cuentas inactivas (fuera de `cuentas`) ni conversaciones sin cuenta", () => {
    const actual = conv("c-mail", "ana", CTA_MAIL, "2026-11-16T10:00:00Z");
    const wa = conv("c-wa", "ana", CTA_WA, "2026-11-15T10:00:00Z");
    const sinCuenta = conv("c-x", "ana", null, "2026-11-16T12:00:00Z");
    expect(canalesDeRespuesta(actual, [actual, wa, sinCuenta], [CTA_MAIL])).toHaveLength(1);
  });
});

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarFirmaWebhookMeta } from "./verificar-firma-webhook-meta";

const BODY = JSON.stringify({ object: "instagram", entry: [{ id: "123" }] });
const SECRET_A = "secret-app-facebook-login";
const SECRET_B = "secret-app-instagram-login";

function firmar(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verificarFirmaWebhookMeta", () => {
  it("firma correcta con el único secret configurado -> true", () => {
    expect(verificarFirmaWebhookMeta(BODY, firmar(BODY, SECRET_A), [SECRET_A])).toBe(true);
  });

  it("firma correcta con el segundo secret cuando hay dos configurados -> true", () => {
    expect(verificarFirmaWebhookMeta(BODY, firmar(BODY, SECRET_B), [SECRET_A, SECRET_B])).toBe(true);
  });

  it("firma calculada con un secret distinto -> false", () => {
    expect(verificarFirmaWebhookMeta(BODY, firmar(BODY, "otro-secret"), [SECRET_A, SECRET_B])).toBe(false);
  });

  it("cuerpo modificado después de firmar -> false", () => {
    const firma = firmar(BODY, SECRET_A);
    expect(verificarFirmaWebhookMeta(BODY + "x", firma, [SECRET_A])).toBe(false);
  });

  it("sin header de firma -> false", () => {
    expect(verificarFirmaWebhookMeta(BODY, null, [SECRET_A])).toBe(false);
  });

  it("header sin el prefijo sha256= -> false", () => {
    expect(verificarFirmaWebhookMeta(BODY, "abcdef", [SECRET_A])).toBe(false);
  });

  it("sin secrets configurados -> false", () => {
    expect(verificarFirmaWebhookMeta(BODY, firmar(BODY, SECRET_A), [undefined, undefined])).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { resolverCuentaParaEventoPage, type CuentaCanalWebhook } from "./resolver-canal-webhook-page";

// Cubre research.md R1 (005-facebook-messenger-integracion): desambiguar
// eventos object:"page" entre Instagram-vía-Página y Facebook Messenger.

const cuentaIG: CuentaCanalWebhook = { id: "ig-1", instanciaId: "inst-1", configuracion: {} };
const cuentaFB: CuentaCanalWebhook = { id: "fb-1", instanciaId: "inst-1", configuracion: {} };

describe("resolverCuentaParaEventoPage", () => {
  it("resuelve Instagram cuando solo hay candidato de Instagram (caso actual, sin Messenger conectado)", () => {
    const resultado = resolverCuentaParaEventoPage(cuentaIG, null, false);
    expect(resultado).toEqual({ cuentaCanal: cuentaIG, canal: "instagram" });
  });

  it("resuelve Messenger cuando solo hay candidato de Messenger (sin Instagram conectado a esa Página)", () => {
    const resultado = resolverCuentaParaEventoPage(null, cuentaFB, false);
    expect(resultado).toEqual({ cuentaCanal: cuentaFB, canal: "facebook_messenger" });
  });

  it("devuelve null cuando ningún canal tiene la Página conectada", () => {
    expect(resolverCuentaParaEventoPage(null, null, false)).toBeNull();
  });

  it("con ambos candidatos conectados, resuelve Instagram si el remitente ya es un contacto conocido de Instagram (FR-007: cero regresión)", () => {
    const resultado = resolverCuentaParaEventoPage(cuentaIG, cuentaFB, true);
    expect(resultado).toEqual({ cuentaCanal: cuentaIG, canal: "instagram" });
  });

  it("con ambos candidatos conectados, resuelve Messenger si el remitente NO es un contacto conocido de Instagram", () => {
    const resultado = resolverCuentaParaEventoPage(cuentaIG, cuentaFB, false);
    expect(resultado).toEqual({ cuentaCanal: cuentaFB, canal: "facebook_messenger" });
  });
});

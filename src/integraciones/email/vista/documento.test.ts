import { afterEach, describe, expect, it } from "vitest";
import {
  PERMISOS_SANDBOX,
  cabecerasImagen,
  cabecerasVista,
  construirDocumentoVista,
  origenPublico,
} from "./documento";

const CSP_ESPERADA =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; " +
  "img-src data: https://app.karia.test/api/correo-aislado/; font-src 'none'; connect-src 'none'; " +
  "media-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; " +
  "manifest-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; " +
  "sandbox allow-popups allow-popups-to-escape-sandbox";

describe("cabeceras de la vista aislada", () => {
  const c = cabecerasVista("https://app.karia.test");

  it("CSP exacta (research.md R7)", () => {
    expect(c["Content-Security-Policy"]).toBe(CSP_ESPERADA);
  });

  it("la CSP nunca habilita scripts, mismo origen, formularios ni navegación de la ventana principal", () => {
    const csp = c["Content-Security-Policy"];
    for (const prohibido of ["allow-scripts", "allow-same-origin", "allow-forms", "allow-top-navigation", "allow-modals", "allow-downloads", "'unsafe-eval'"]) {
      expect(csp).not.toContain(prohibido);
    }
    expect(PERMISOS_SANDBOX).toBe("allow-popups allow-popups-to-escape-sandbox");
  });

  it("resto de cabeceras de seguridad", () => {
    expect(c).toMatchObject({
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    expect(c["Permissions-Policy"]).toContain("camera=()");
  });

  it("las imágenes salen como webp, sin sniffing y sin caché compartida", () => {
    expect(cabecerasImagen()).toMatchObject({
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });
  });
});

describe("origenPublico", () => {
  const original = process.env.APP_URL;
  afterEach(() => {
    process.env.APP_URL = original;
  });

  it("usa APP_URL sin barra final cuando existe", () => {
    process.env.APP_URL = "https://app.karia.test/";
    expect(origenPublico("http://interno:3000")).toBe("https://app.karia.test");
  });

  it("sin APP_URL usa el origen del request", () => {
    delete process.env.APP_URL;
    expect(origenPublico("http://localhost:3000")).toBe("http://localhost:3000");
  });
});

describe("construirDocumentoVista", () => {
  const doc = construirDocumentoVista("<p>Hola</p>");

  it("es un documento completo con el correo solo dentro de body", () => {
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toMatch(/<body><p>Hola<\/p><\/body><\/html>$/);
  });

  it("oculta la barra de desplazamiento sin quitar el desplazamiento", () => {
    expect(doc).toContain("scrollbar-width:none");
    expect(doc).toContain("::-webkit-scrollbar");
    expect(doc).not.toMatch(/overflow:\s*hidden/);
  });
});

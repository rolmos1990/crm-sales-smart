import { describe, expect, it } from "vitest";
import { ocultarCodigo, resolverCodigoEfectivo } from "./codigo-sensible";

describe("resolverCodigoEfectivo", () => {
  it("REEMPLAZAR con valor no vacío -> usa el valor nuevo (recortado)", () => {
    expect(resolverCodigoEfectivo({ codigoAccion: "REEMPLAZAR", codigoNuevo: "  ABC-123  " }, "VIEJO")).toBe("ABC-123");
  });

  it("REEMPLAZAR con valor vacío o solo espacios -> limpia el código (null)", () => {
    expect(resolverCodigoEfectivo({ codigoAccion: "REEMPLAZAR", codigoNuevo: "" }, "VIEJO")).toBeNull();
    expect(resolverCodigoEfectivo({ codigoAccion: "REEMPLAZAR", codigoNuevo: "   " }, "VIEJO")).toBeNull();
    expect(resolverCodigoEfectivo({ codigoAccion: "REEMPLAZAR" }, "VIEJO")).toBeNull();
  });

  it("CONSERVAR ignora codigoNuevo y devuelve el valor existente tal cual", () => {
    expect(resolverCodigoEfectivo({ codigoAccion: "CONSERVAR", codigoNuevo: "IGNORADO" }, "VIEJO")).toBe("VIEJO");
    expect(resolverCodigoEfectivo({ codigoAccion: "CONSERVAR" }, null)).toBeNull();
  });

  it("sin codigoAccion (nada configurado todavía) -> devuelve el valor existente tal cual", () => {
    expect(resolverCodigoEfectivo({}, null)).toBeNull();
    expect(resolverCodigoEfectivo({ codigoNuevo: "IGNORADO" }, "VIEJO")).toBe("VIEJO");
  });
});

describe("ocultarCodigo", () => {
  it("registro con código -> tieneCodigoConfigurado true, sin la clave codigo", () => {
    const resultado = ocultarCodigo({ codigo: "SECRETO-123", otraCosa: "x" });
    expect(resultado).toEqual({ otraCosa: "x", tieneCodigoConfigurado: true });
    expect(resultado).not.toHaveProperty("codigo");
  });

  it("registro con código null -> tieneCodigoConfigurado false", () => {
    const resultado = ocultarCodigo({ codigo: null, otraCosa: "x" });
    expect(resultado).toEqual({ otraCosa: "x", tieneCodigoConfigurado: false });
  });

  it("registro con código vacío ('') -> tieneCodigoConfigurado false", () => {
    const resultado = ocultarCodigo({ codigo: "", otraCosa: "x" });
    expect(resultado?.tieneCodigoConfigurado).toBe(false);
  });

  it("registro null o undefined -> null", () => {
    expect(ocultarCodigo(null)).toBeNull();
    expect(ocultarCodigo(undefined)).toBeNull();
  });
});

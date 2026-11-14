import { describe, expect, it } from "vitest";
import { normalizarTexto, extraerTexto } from "./extraccion";
import { MIN_CARACTERES_EXTRAIDOS } from "./tipos";

const bytes = (t: string) => new TextEncoder().encode(t);

describe("normalizarTexto — limpieza del texto crudo del PDF", () => {
  it("unifica saltos de línea de Windows", () => {
    expect(normalizarTexto("a\r\nb")).toBe("a\nb");
  });

  it("colapsa espacios repetidos, incluidos los no separables", () => {
    expect(normalizarTexto("hola    mundo  otra")).toBe("hola mundo otra");
  });

  it("reduce a dos los saltos de página múltiples", () => {
    expect(normalizarTexto("uno\n\n\n\n\ndos")).toBe("uno\n\ndos");
  });

  it("quita guiones de corte de línea que los PDFs insertan", () => {
    expect(normalizarTexto("trans­porte")).toBe("transporte");
  });

  it("normaliza comillas tipográficas", () => {
    expect(normalizarTexto("“hallo” y ‘chau’")).toBe('"hallo" y \'chau\'');
  });

  it("recorta cada línea y el texto completo", () => {
    expect(normalizarTexto("  \n   hola   \n  chau  \n ")).toBe("hola\nchau");
  });
});

describe("extraerTexto — TXT", () => {
  it("acepta un documento con texto suficiente", async () => {
    const contenido = "Politica de envios: llegamos a todo el pais en 2 a 5 dias habiles segun destino.";
    const r = await extraerTexto(bytes(contenido), "text/plain");

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toContain("2 a 5 dias habiles");
  });

  it("rechaza un archivo vacío con el motivo correcto", async () => {
    const r = await extraerTexto(bytes(""), "text/plain");

    expect(r).toEqual({ ok: false, motivo: "SIN_TEXTO" });
  });

  it("rechaza texto demasiado corto para ser un documento útil", async () => {
    const r = await extraerTexto(bytes("hola"), "text/plain");

    expect(r).toEqual({ ok: false, motivo: "SIN_TEXTO" });
  });

  it("el umbral es el documentado, no un número suelto", async () => {
    const justo = "a".repeat(MIN_CARACTERES_EXTRAIDOS);
    await expect(extraerTexto(bytes(justo), "text/plain")).resolves.toMatchObject({ ok: true });

    const corto = "a".repeat(MIN_CARACTERES_EXTRAIDOS - 1);
    await expect(extraerTexto(bytes(corto), "text/plain")).resolves.toMatchObject({ ok: false });
  });
});

describe("extraerTexto — PDF", () => {
  it("un PDF corrupto se rechaza como ilegible, sin lanzar", async () => {
    const r = await extraerTexto(bytes("esto no es un PDF"), "application/pdf");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(["ILEGIBLE", "SIN_TEXTO"]).toContain(r.motivo);
  });
});

import { describe, expect, it } from "vitest";
import { parsearRange } from "./range";

describe("parsearRange", () => {
  const total = 1000;

  it("sin header, otra unidad o multi-rango → null (archivo completo)", () => {
    expect(parsearRange(null, total)).toBeNull();
    expect(parsearRange("items=0-5", total)).toBeNull();
    expect(parsearRange("bytes=0-10, 20-30", total)).toBeNull();
  });

  it("bytes=a-b", () => {
    expect(parsearRange("bytes=0-499", total)).toEqual({ inicio: 0, fin: 499 });
  });

  it("bytes=0-0 es un solo byte", () => {
    expect(parsearRange("bytes=0-0", total)).toEqual({ inicio: 0, fin: 0 });
  });

  it("bytes=a- llega hasta el final", () => {
    expect(parsearRange("bytes=500-", total)).toEqual({ inicio: 500, fin: 999 });
  });

  it("el fin se acota al último byte", () => {
    expect(parsearRange("bytes=900-5000", total)).toEqual({ inicio: 900, fin: 999 });
  });

  it("sufijo bytes=-n son los últimos n bytes", () => {
    expect(parsearRange("bytes=-100", total)).toEqual({ inicio: 900, fin: 999 });
  });

  it("sufijo mayor que el archivo arranca en 0", () => {
    expect(parsearRange("bytes=-5000", total)).toEqual({ inicio: 0, fin: 999 });
  });

  it.each(["bytes=1000-", "bytes=1500-2000", "bytes=50-10", "bytes=-0", "bytes=-", "bytes=abc-def"])(
    "%s → INVALIDO",
    (header) => {
      expect(parsearRange(header, total)).toBe("INVALIDO");
    },
  );

  it("archivo vacío no admite rangos", () => {
    expect(parsearRange("bytes=0-", 0)).toBe("INVALIDO");
  });
});

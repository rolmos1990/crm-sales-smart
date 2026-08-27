import { describe, it, expect, beforeAll } from "vitest";
import { cifrarToken, descifrarToken } from "./cifrado-tokens";
import { randomBytes } from "node:crypto";

describe("cifrado-tokens", () => {
  beforeAll(() => {
    process.env.TOKENS_CIFRADO_KEY = randomBytes(32).toString("base64");
  });

  it("cifra y descifra el mismo valor original", () => {
    const original = "IGAAxxxxxxTokenDeInstagram12345";
    const cifrado = cifrarToken(original);
    expect(cifrado).not.toBe(original);
    expect(cifrado.startsWith("enc:v1:")).toBe(true);
    expect(descifrarToken(cifrado)).toBe(original);
  });

  it("produce un ciphertext distinto en cada cifrado (IV aleatorio)", () => {
    const original = "mismo-token";
    const a = cifrarToken(original);
    const b = cifrarToken(original);
    expect(a).not.toBe(b);
    expect(descifrarToken(a)).toBe(original);
    expect(descifrarToken(b)).toBe(original);
  });

  it("devuelve tal cual un valor legacy en texto plano (sin prefijo enc:v1:)", () => {
    const legacy = "token-guardado-antes-del-cifrado";
    expect(descifrarToken(legacy)).toBe(legacy);
  });

  it("lanza error si el valor cifrado fue manipulado (auth tag no calza)", () => {
    const cifrado = cifrarToken("token-valido");
    const manipulado = cifrado.slice(0, -4) + "AAAA";
    expect(() => descifrarToken(manipulado)).toThrow();
  });

  it("lanza error claro si falta TOKENS_CIFRADO_KEY", () => {
    const original = process.env.TOKENS_CIFRADO_KEY;
    delete process.env.TOKENS_CIFRADO_KEY;
    expect(() => cifrarToken("x")).toThrow(/TOKENS_CIFRADO_KEY/);
    process.env.TOKENS_CIFRADO_KEY = original;
  });
});

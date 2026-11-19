import { describe, expect, it } from "vitest";

import { codigoDeError, configAplicadaSegura, estadoPorConteos, sanitizarErrorMensaje } from "./auditoria";

describe("sanitizarErrorMensaje", () => {
  it.each([
    ["clave de OpenAI", "Incorrect API key provided: sk-proj-abcdefghijklmnop1234"],
    ["clave de DeepSeek", "Authentication failed for sk-1234567890abcdef"],
    ["clave de Anthropic", "invalid x-api-key sk-ant-api03-ABCDEFGHIJKLMNOP"],
    ["Bearer", "Request failed: Authorization Bearer eyJhbGciOiJIUzI1NiJ9.abc.def"],
    ["api_key=", "upstream said api_key=supersecreto123 invalid"],
  ])("oculta %s", (_n, texto) => {
    const limpio = sanitizarErrorMensaje(new Error(texto));
    expect(limpio).toContain("[oculto]");
    expect(limpio).not.toMatch(/sk-[A-Za-z0-9]{6,}/);
    expect(limpio).not.toContain("supersecreto123");
  });

  it("corta a 300 caracteres", () => {
    expect(sanitizarErrorMensaje("x ".repeat(500)).length).toBeLessThanOrEqual(300);
  });

  it("acepta errores que no son Error", () => {
    expect(sanitizarErrorMensaje({ status: 500 })).toBe('{"status":500}');
  });
});

describe("configAplicadaSegura", () => {
  it("nunca deja pasar claves ni campos no previstos", () => {
    const r = configAplicadaSegura({
      tamanoLote: 20,
      promptVersion: "v1",
      apiKeyEncriptada: "enc:v1:xxxx",
      apiKey: "sk-123",
      mensajes: [{ contenido: "hola" }],
    }) as Record<string, unknown>;
    expect(r).toEqual({ tamanoLote: 20, promptVersion: "v1" });
  });
});

describe("codigoDeError", () => {
  it("clasifica errores del proveedor", () => {
    expect(codigoDeError(Object.assign(new Error("Request timed out"), {}))).toBe("PROVEEDOR_TIMEOUT");
    expect(codigoDeError({ status: 429, message: "Too many" })).toBe("PROVEEDOR_LIMITE");
    expect(codigoDeError({ status: 500, message: "boom" })).toBe("PROVEEDOR_ERROR");
    expect(codigoDeError(new Error("algo"))).toBe("ERROR_INTERNO");
  });
});

describe("estadoPorConteos", () => {
  it.each([
    [20, 20, "COMPLETADA"],
    [17, 20, "PARCIAL"],
    [0, 20, "FALLIDA"],
  ] as const)("%i de %i → %s", (ok, total, esperado) => {
    expect(estadoPorConteos(ok, total)).toBe(esperado);
  });
});

import { describe, expect, it } from "vitest";

import { contieneDatosPrivados, normalizar, validarSalidaLote } from "./salida";

const refs = new Map([
  ["c1", "id-1"],
  ["c2", "id-2"],
  ["c3", "id-3"],
]);
const sinFuentes = new Map<string, string[]>();

const entrada = (ref: string, extra: Record<string, unknown> = {}) => ({
  ref,
  intencion: "ALTA",
  intencionComercial: "LISTO_PARA_COMPRAR",
  urgencia: "ALTA",
  recuperacion: "NO_APLICA",
  ajustePuntaje: 20,
  senales: ["Consultó precio y fecha de entrega"],
  objeciones: [],
  motivos: ["Pidió entrega para esta semana"],
  accionSugerida: "ENVIAR_COTIZACION",
  sugerirNoContactar: false,
  motivoNoContactar: null,
  ...extra,
});

const respuesta = (...evaluaciones: unknown[]) => JSON.stringify({ evaluaciones });

describe("validarSalidaLote", () => {
  it("traduce referencias a contactos y acepta lo válido", () => {
    const r = validarSalidaLote(respuesta(entrada("c1"), entrada("c2"), entrada("c3")), refs, sinFuentes);
    expect([...r.validos.keys()].sort()).toEqual(["id-1", "id-2", "id-3"]);
    expect(r.loteInvalido).toBe(false);
  });

  it("JSON ininteligible → lote inválido", () => {
    expect(validarSalidaLote("Claro, acá va el análisis:", refs, sinFuentes).loteInvalido).toBe(true);
    expect(validarSalidaLote(JSON.stringify({ otra: 1 }), refs, sinFuentes).loteInvalido).toBe(true);
  });

  it("acepta el JSON envuelto en un bloque de código", () => {
    const r = validarSalidaLote("```json\n" + respuesta(entrada("c1")) + "\n```", refs, sinFuentes);
    expect(r.validos.has("id-1")).toBe(true);
  });

  it("una referencia ajena o inventada se descarta y no toca a nadie", () => {
    const r = validarSalidaLote(respuesta(entrada("c1"), entrada("c99"), entrada("id-2")), refs, sinFuentes);
    expect([...r.validos.keys()]).toEqual(["id-1"]);
    expect(r.omitidos.sort()).toEqual(["id-2", "id-3"]);
  });

  it("una referencia repetida invalida todas sus entradas", () => {
    const r = validarSalidaLote(respuesta(entrada("c1"), entrada("c1", { intencion: "BAJA" }), entrada("c2")), refs, sinFuentes);
    expect(r.invalidos).toEqual(["id-1"]);
    expect(r.validos.has("id-2")).toBe(true);
  });

  it("los que faltan quedan omitidos, nunca como exitosos (FR-017)", () => {
    const r = validarSalidaLote(respuesta(entrada("c1")), refs, sinFuentes);
    expect(r.omitidos.sort()).toEqual(["id-2", "id-3"]);
  });

  it.each([
    ["ajuste fuera de rango", { ajustePuntaje: 41 }],
    ["ajuste decimal", { ajustePuntaje: 10.5 }],
    ["intención inexistente", { intencion: "ALTISIMA" }],
    ["acción de hechos (RESPONDER)", { accionSugerida: "RESPONDER" }],
    ["acción de hechos (NO_CONTACTAR)", { accionSugerida: "NO_CONTACTAR" }],
    ["más de 5 señales", { senales: ["a1a", "a2a", "a3a", "a4a", "a5a", "a6a"] }],
    ["señal de más de 120 caracteres", { senales: ["x".repeat(121)] }],
  ])("%s → inválido", (_n, extra) => {
    const r = validarSalidaLote(respuesta(entrada("c1", extra)), refs, sinFuentes);
    expect(r.invalidos).toEqual(["id-1"]);
  });
});

describe("privacidad (FR-017a, SC-018)", () => {
  it.each([
    ["teléfono con espacios", "Dejó su número +51 987 654 321"],
    ["teléfono con guiones", "Escribir al 987-654-321"],
    ["email", "Su correo es ana@example.com"],
    ["URL", "Mandó www.mitienda.pe"],
    ["DNI de 8 dígitos", "Documento 45678912"],
    ["dirección con avenida", "Entrega en Av. Arequipa 1520"],
    ["dirección con jirón", "Vive en Jr. Lampa 45"],
    ["manzana y lote", "Mz. B lote 12"],
  ])("rechaza %s", (_n, texto) => {
    expect(contieneDatosPrivados(texto, [])).toBe(true);
  });

  it.each([
    ["paráfrasis", "Consultó precio y fecha de entrega"],
    ["formas de pago (señal legítima)", "Pregunta por formas de pago"],
    ["avenida sin número", "Vive en la avenida principal"],
    ["lote de productos", "Pidió un lote de 20 unidades"],
    ["número corto", "Quiere 3 unidades"],
  ])("acepta %s", (_n, texto) => {
    expect(contieneDatosPrivados(texto, [])).toBe(false);
  });

  it("rechaza una cita copiada de la conversación aunque cambien mayúsculas y acentos", () => {
    const fuente = normalizar("Hola, necesito que me lo entreguen el VIERNES sin falta por favor");
    expect(contieneDatosPrivados("Necesito que me lo entreguen el viernes sin falta", [fuente])).toBe(true);
  });

  it("un contacto con texto privado queda inválido; el resto del lote sigue", () => {
    const fuentes = new Map([["c1", ["mi celular es 987654321"]]]);
    const r = validarSalidaLote(
      respuesta(entrada("c1", { motivos: ["Dejó su celular 987654321"] }), entrada("c2")),
      refs,
      fuentes,
    );
    expect(r.invalidos).toEqual(["id-1"]);
    expect(r.validos.has("id-2")).toBe(true);
  });
});

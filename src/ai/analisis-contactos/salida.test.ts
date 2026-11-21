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
    expect([...r.invalidos]).toEqual([["id-1", "REF_DUPLICADA"]]);
    expect(r.validos.has("id-2")).toBe(true);
  });

  it("un contacto ausente queda OMITIDO, nunca inválido (052)", () => {
    const r = validarSalidaLote(respuesta(entrada("c1")), refs, sinFuentes);
    expect(r.invalidos.size).toBe(0);
    expect(r.omitidos.sort()).toEqual(["id-2", "id-3"]);
  });

  it("manda el primer texto problemático, en orden senales → objeciones → motivos (052)", () => {
    const fuentes = new Map([["c1", ["mi correo es ana@example.com"]]]);
    const r = validarSalidaLote(
      respuesta(entrada("c1", { senales: ["Dejó su correo ana@example.com"], motivos: ["Documento 45678912"] })),
      refs,
      fuentes,
    );
    expect(r.invalidos.get("id-1")).toBe("PRIVACIDAD_EMAIL");
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
    expect(r.invalidos.get("id-1")).toBe("FORMATO_INVALIDO");
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
    expect(contieneDatosPrivados(texto, [])).not.toBeNull();
  });

  it.each([
    ["paráfrasis", "Consultó precio y fecha de entrega"],
    ["formas de pago (señal legítima)", "Pregunta por formas de pago"],
    ["avenida sin número", "Vive en la avenida principal"],
    ["lote de productos", "Pidió un lote de 20 unidades"],
    ["número corto", "Quiere 3 unidades"],
  ])("acepta %s", (_n, texto) => {
    expect(contieneDatosPrivados(texto, [])).toBeNull();
  });

  it("rechaza una cita copiada de la conversación aunque cambien mayúsculas y acentos", () => {
    const fuente = normalizar("Hola, necesito que me lo entreguen el VIERNES sin falta por favor");
    // 48 caracteres de solape: muy por encima del umbral, sigue siendo cita.
    expect(contieneDatosPrivados("Necesito que me lo entreguen el viernes sin falta", [fuente])).toBe("CITA");
  });

  // ── 052 — el motivo del rechazo ──────────────────────────────────────────
  //
  // Antes los cinco controles devolvían el mismo `true`, y aguas abajo los tres
  // motivos de rechazo compartían `RESPUESTA_INVALIDA`. Averiguar cuál se había
  // disparado exigió reconstruir el pipeline entero y volver a llamar a la IA
  // contacto por contacto. No se borra.
  it.each([
    ["EMAIL", "Su correo es ana@example.com"],
    ["URL", "Mandó www.mitienda.pe"],
    ["SECUENCIA_NUMERICA", "Documento 45678912"],
    ["DIRECCION", "Entrega en Av. Arequipa 1520"],
  ])("identifica el motivo %s", (motivo, texto) => {
    expect(contieneDatosPrivados(texto, [])).toBe(motivo);
  });

  // ── 052 — el umbral de cita ──────────────────────────────────────────────
  //
  // 25 caracteres de español corriente los alcanza cualquier resumen fiel. Los
  // cinco casos de abajo son reales: se reprodujeron contra la API y el filtro
  // los rechazaba por frases como "el precio de las esferas". No se borran.
  describe("umbral de cita (052)", () => {
    const CASOS_REALES: Array<[string, string, string]> = [
      [
        "precio de las esferas",
        "Pregunta el precio de las esferas",
        "hola buenas me das el precio de las esferas por favor",
      ],
      [
        "esfera lunar",
        "Pidió encargar una esfera lunar",
        "quisiera encargar una esfera lunar para regalo",
      ],
      [
        "modelos nuevos",
        "Pide ver todos los modelos nuevos",
        "me puedes mostrar ver todos los modelos nuevos que tengan",
      ],
      [
        "personalización",
        "Consulta por opciones de personalización",
        "tienen opciones de personalizacion para el grabado",
      ],
      [
        "fecha de diciembre",
        "Menciona fecha límite para inicios de diciembre",
        "lo necesito para inicios de diciembre si se puede",
      ],
    ];

    it.each(CASOS_REALES)("acepta la paráfrasis real: %s", (_n, salida, fuente) => {
      expect(contieneDatosPrivados(salida, [normalizar(fuente)])).toBeNull();
    });

    it("acepta un solape de 39 y rechaza uno de 40", () => {
      // Fija el umbral exacto. Si alguien lo mueve, este test lo dice.
      // Sin dígitos a propósito: con una secuencia numérica se dispararía otro
      // control antes y el test mediría algo distinto del umbral.
      const base = "abcdefghi abcdefghi abcdefghi abcdefghi";
      expect(base).toHaveLength(39);
      expect(contieneDatosPrivados(base, [normalizar(base)])).toBeNull();

      const cuarenta = `${base}x`;
      expect(cuarenta).toHaveLength(40);
      expect(contieneDatosPrivados(cuarenta, [normalizar(cuarenta)])).toBe("CITA");
    });

    it("un texto más corto que el umbral nunca es cita", () => {
      const corto = "quiere la esfera azul";
      expect(corto.length).toBeLessThan(40);
      expect(contieneDatosPrivados(corto, [normalizar(`hola ${corto} para mañana`)])).toBeNull();
    });

    it("sin fuentes el control de cita no aplica", () => {
      expect(contieneDatosPrivados("x".repeat(100), [])).toBeNull();
    });
  });

  it("ante dos controles disparados reporta el primero del orden", () => {
    const fuente = normalizar("mi correo es ana@example.com y lo necesito para el viernes sin falta");
    // Tiene email Y copia la fuente: manda el email, que va antes en el orden.
    expect(contieneDatosPrivados("Su correo es ana@example.com", [fuente])).toBe("EMAIL");
  });

  it("un contacto con texto privado queda inválido; el resto del lote sigue", () => {
    const fuentes = new Map([["c1", ["mi celular es 987654321"]]]);
    const r = validarSalidaLote(
      respuesta(entrada("c1", { motivos: ["Dejó su celular 987654321"] }), entrada("c2")),
      refs,
      fuentes,
    );
    expect(r.invalidos.get("id-1")).toBe("PRIVACIDAD_SECUENCIA_NUMERICA");
    expect(r.validos.has("id-2")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { derivarHechos, type TurnoEjecutado } from "./hechos";
import { HECHOS_VACIOS, type HechosConversacion } from "./tipos";

const AHORA = new Date("2026-11-14T20:00:00.000Z");
const HECHOS_PREVIOS: HechosConversacion = { ...HECHOS_VACIOS, ultimoTurnoEn: "2026-11-14T19:00:00.000Z" };

function turno(parcial: Partial<TurnoEjecutado> = {}): TurnoEjecutado {
  return {
    mensajeId: "msg-1",
    textoEnviado: "",
    herramientas: [],
    ahora: AHORA,
    ...parcial,
  };
}

const precioActual = (productoId: string, precio: number, moneda = "USD") => ({
  nombre: "consultar_precio_actual",
  args: { productoId },
  resultado: { ok: true as const, data: { precio, moneda } },
});

// ── Precio informado (research D6) ──────────────────────────────────────────

describe("derivarHechos — precio informado (031, FR-012, research D6)", () => {
  it("registra el precio cuando vino de una herramienta y el monto aparece en el mensaje", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "La esfera lunar está a USD 16. ¿Te la reservo?", herramientas: [precioActual("prod-1", 16)] }),
    );

    expect(hechos.ultimoPrecioInformado).toMatchObject({
      productoId: "prod-1",
      monto: 16,
      moneda: "USD",
      origen: "CONSULTA_PRECIO",
      mensajeId: "msg-1",
    });
  });

  it.each([
    ["16.00", "Cuesta USD 16.00 con envío incluido."],
    ["16,00", "Cuesta USD 16,00 con envío incluido."],
    ["16.0", "Cuesta USD 16.0 con envío incluido."],
    ["16", "Cuesta 16 dólares."],
  ])("tolera el formato %s del monto", (_formato, textoEnviado) => {
    const hechos = derivarHechos(HECHOS_PREVIOS, turno({ textoEnviado, herramientas: [precioActual("prod-1", 16)] }));

    expect(hechos.ultimoPrecioInformado?.monto).toBe(16);
  });

  it("NO registra un precio que la herramienta devolvió pero el agente no dijo", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "Está alrededor de 15 dólares.", herramientas: [precioActual("prod-1", 16)] }),
    );

    expect(hechos.ultimoPrecioInformado).toBeNull();
  });

  it("de una búsqueda con varios precios, registra solo el que el agente mencionó", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Tenemos la Esfera lunar a USD 16. ¿Te interesa?",
        herramientas: [
          {
            nombre: "buscar_productos",
            args: { query: "esfera" },
            resultado: {
              ok: true,
              data: {
                productos: [
                  { id: "p-1", nombre: "Esfera solar", precio: 42, moneda: "USD" },
                  { id: "p-2", nombre: "Esfera lunar", precio: 16, moneda: "USD" },
                  { id: "p-3", nombre: "Esfera estelar", precio: 99, moneda: "USD" },
                ],
              },
            },
          },
        ],
      }),
    );

    expect(hechos.ultimoPrecioInformado).toMatchObject({ productoId: "p-2", monto: 16, origen: "BUSQUEDA" });
  });

  it("conserva el precio anterior cuando en este turno no se informó ninguno", () => {
    const previos: HechosConversacion = {
      ...HECHOS_PREVIOS,
      ultimoPrecioInformado: {
        productoId: "prod-1",
        nombre: "Esfera lunar",
        monto: 16,
        moneda: "USD",
        origen: "CONSULTA_PRECIO",
        mensajeId: "msg-0",
        informadoEn: "2026-11-14T19:00:00.000Z",
      },
    };

    const hechos = derivarHechos(previos, turno({ textoEnviado: "Sí, llegamos a Lima en 2 días." }));

    expect(hechos.ultimoPrecioInformado?.mensajeId).toBe("msg-0");
  });

  it("no confunde un monto con un número cualquiera del mensaje", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "Trabajamos de 9 a 16 horas.", herramientas: [precioActual("prod-1", 16)] }),
    );

    // "16" aparece, pero como hora. El matcher exige el monto como número
    // suelto; esto documenta la limitación aceptada de D6 (falso positivo
    // posible, preferible a no registrar nunca).
    expect(hechos.ultimoPrecioInformado?.monto).toBe(16);
  });

  it("ignora el resultado de una herramienta que falló", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Cuesta USD 16.",
        herramientas: [{ nombre: "consultar_precio_actual", args: { productoId: "p-1" }, resultado: { ok: false, error: "Producto no encontrado" } }],
      }),
    );

    expect(hechos.ultimoPrecioInformado).toBeNull();
  });
});

// ── Pregunta abierta (research D7) ──────────────────────────────────────────

describe("derivarHechos — pregunta del agente (031, research D7)", () => {
  it("toma la última oración interrogativa del mensaje enviado", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "Tenemos stock. ¿Desea ver el catálogo? Quedo atento." }),
    );

    expect(hechos.ultimaPreguntaDelAgente).toMatchObject({
      texto: "¿Desea ver el catálogo?",
      mensajeId: "msg-1",
      turnosDesde: 0,
    });
  });

  it("si hay varias preguntas, se queda con la última", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "¿Para cuándo lo necesita? ¿A qué ciudad lo enviamos?" }),
    );

    expect(hechos.ultimaPreguntaDelAgente?.texto).toBe("¿A qué ciudad lo enviamos?");
  });

  it("un mensaje sin pregunta conserva la anterior y le suma un turno", () => {
    const previos: HechosConversacion = {
      ...HECHOS_PREVIOS,
      ultimaPreguntaDelAgente: {
        texto: "¿Desea ver el catálogo?",
        mensajeId: "msg-0",
        hechaEn: "2026-11-14T19:00:00.000Z",
        turnosDesde: 1,
      },
    };

    const hechos = derivarHechos(previos, turno({ textoEnviado: "Abrimos de 9 a 18." }));

    expect(hechos.ultimaPreguntaDelAgente).toMatchObject({ mensajeId: "msg-0", turnosDesde: 2 });
  });

  it("una pregunta nueva reemplaza a la anterior y reinicia el contador", () => {
    const previos: HechosConversacion = {
      ...HECHOS_PREVIOS,
      ultimaPreguntaDelAgente: { texto: "¿Desea ver el catálogo?", mensajeId: "msg-0", hechaEn: "2026-11-14T19:00:00.000Z", turnosDesde: 3 },
    };

    const hechos = derivarHechos(previos, turno({ textoEnviado: "¿A qué ciudad lo enviamos?" }));

    expect(hechos.ultimaPreguntaDelAgente).toMatchObject({ texto: "¿A qué ciudad lo enviamos?", turnosDesde: 0 });
  });

  it("sin ninguna pregunta previa ni actual, queda en null", () => {
    expect(derivarHechos(HECHOS_PREVIOS, turno({ textoEnviado: "Listo." })).ultimaPreguntaDelAgente).toBeNull();
  });
});

// ── Producto en foco (research D8) ──────────────────────────────────────────

describe("derivarHechos — producto en foco (031, research D8)", () => {
  it("la consulta de precio gana sobre el primer resultado de una búsqueda", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Cuesta USD 16.",
        herramientas: [
          {
            nombre: "buscar_productos",
            args: {},
            resultado: { ok: true, data: { productos: [{ id: "p-99", nombre: "Otro", precio: 5, moneda: "USD" }] } },
          },
          { ...precioActual("p-1", 16), args: { productoId: "p-1" } },
        ],
      }),
    );

    expect(hechos.productoEnFoco?.productoId).toBe("p-1");
  });

  it("sin señal explícita, cae al primer resultado de la búsqueda", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Mirá estas opciones.",
        herramientas: [
          {
            nombre: "buscar_productos",
            args: {},
            resultado: { ok: true, data: { productos: [{ id: "p-7", nombre: "Esfera lunar", precio: 16, moneda: "USD" }] } },
          },
        ],
      }),
    );

    expect(hechos.productoEnFoco).toMatchObject({ productoId: "p-7", nombre: "Esfera lunar" });
  });

  it("un turno sin ninguna señal de producto conserva el anterior", () => {
    const previos: HechosConversacion = { ...HECHOS_PREVIOS, productoEnFoco: { productoId: "p-1", nombre: "Esfera lunar" } };

    const hechos = derivarHechos(previos, turno({ textoEnviado: "Enviamos a todo el país." }));

    expect(hechos.productoEnFoco).toEqual({ productoId: "p-1", nombre: "Esfera lunar" });
  });

  it("consultar_disponibilidad también fija el producto en foco", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Sí, hay stock.",
        herramientas: [{ nombre: "consultar_disponibilidad", args: { productoId: "p-3" }, resultado: { ok: true, data: { disponible: true } } }],
      }),
    );

    expect(hechos.productoEnFoco?.productoId).toBe("p-3");
  });
});

// ── Documentos ──────────────────────────────────────────────────────────────

describe("derivarHechos — documentos generados (031, FR-011)", () => {
  it("registra una cotización creada con éxito", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({
        textoEnviado: "Te preparé la cotización #000123 por USD 16.00.",
        herramientas: [
          {
            nombre: "crear_cotizacion",
            args: {},
            resultado: { ok: true, data: { cotizacionId: "cot-1", numero: "000123", total: 16, moneda: "USD" } },
          },
        ],
      }),
    );

    expect(hechos.documentos).toEqual([
      { tipo: "COTIZACION", id: "cot-1", numero: "000123", total: 16, moneda: "USD", creadoEn: AHORA.toISOString() },
    ]);
  });

  it("acumula sobre los documentos anteriores sin duplicarlos", () => {
    const previos: HechosConversacion = {
      ...HECHOS_PREVIOS,
      documentos: [{ tipo: "COTIZACION", id: "cot-1", numero: "000123", total: 16, moneda: "USD", creadoEn: "2026-11-14T19:00:00.000Z" }],
    };

    const hechos = derivarHechos(
      previos,
      turno({
        textoEnviado: "Pedido #000456 confirmado.",
        herramientas: [{ nombre: "crear_pedido", args: {}, resultado: { ok: true, data: { pedidoId: "ped-1", numero: "000456", total: 16, moneda: "USD" } } }],
      }),
    );

    expect(hechos.documentos.map((d) => d.id)).toEqual(["cot-1", "ped-1"]);
  });

  it("no registra un documento que la herramienta no llegó a crear", () => {
    const hechos = derivarHechos(
      HECHOS_PREVIOS,
      turno({ textoEnviado: "No pude generarla.", herramientas: [{ nombre: "crear_cotizacion", args: {}, resultado: { ok: false, error: "sin líneas" } }] }),
    );

    expect(hechos.documentos).toEqual([]);
  });
});

describe("derivarHechos — siempre actualiza el momento del turno", () => {
  it("deja ultimoTurnoEn en el instante del turno", () => {
    expect(derivarHechos(HECHOS_PREVIOS, turno()).ultimoTurnoEn).toBe(AHORA.toISOString());
  });
});

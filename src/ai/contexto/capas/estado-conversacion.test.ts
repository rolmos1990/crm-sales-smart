import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FichaConversacion, HechosConversacion } from "@/ai/ficha-conversacion/tipos";

const obtenerFichaMock = vi.fn();
const obtenerTomaHumanaMock = vi.fn();

vi.mock("@/ai/ficha-conversacion/queries", () => ({
  obtenerFicha: (...a: unknown[]) => obtenerFichaMock(...a),
  obtenerTomaHumana: (...a: unknown[]) => obtenerTomaHumanaMock(...a),
}));

const { producirCapaEstadoConversacion, producirCapaLecturaConversacion, formatearHechos, formatearLectura } =
  await import("./estado-conversacion");

const HECHOS: HechosConversacion = {
  productoEnFoco: { productoId: "p-1", nombre: "Esfera lunar (luna completa)" },
  ultimoPrecioInformado: {
    productoId: "p-1",
    nombre: "Esfera lunar",
    monto: 16,
    moneda: "USD",
    origen: "CONSULTA_PRECIO",
    mensajeId: "msg-1",
    informadoEn: "2026-11-13T20:00:00.000Z",
  },
  ultimaPreguntaDelAgente: {
    texto: "¿Desea ver el catálogo?",
    mensajeId: "msg-1",
    hechaEn: "2026-11-13T20:00:00.000Z",
    turnosDesde: 1,
  },
  documentos: [],
  ultimoTurnoEn: "2026-11-13T20:00:00.000Z",
};

const ficha = (parcial: Partial<FichaConversacion> = {}): FichaConversacion => ({
  conversacionId: "conv-1",
  hechos: HECHOS,
  interpretado: null,
  turnos: 4,
  actualizadoEn: "2026-11-13T20:00:00.000Z",
  ...parcial,
});

const BASE = { instanciaId: "inst-1", conversacionId: "conv-1", activa: true };

beforeEach(() => {
  obtenerFichaMock.mockReset().mockResolvedValue(null);
  obtenerTomaHumanaMock.mockReset().mockResolvedValue(null);
});

describe("producirCapaEstadoConversacion — cuándo NO produce nada (031, SC-001, FR-034)", () => {
  it("con la ficha desactivada en el nodo devuelve null y no consulta nada", async () => {
    expect(await producirCapaEstadoConversacion({ ...BASE, activa: false })).toBeNull();
    expect(obtenerFichaMock).not.toHaveBeenCalled();
  });

  it("sin conversacionId devuelve null", async () => {
    expect(await producirCapaEstadoConversacion({ instanciaId: "inst-1", activa: true })).toBeNull();
  });

  it("sin ficha todavía (primer turno) devuelve null", async () => {
    expect(await producirCapaEstadoConversacion(BASE)).toBeNull();
  });

  it("si la consulta falla, devuelve null sin propagar el error", async () => {
    obtenerFichaMock.mockRejectedValue(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await producirCapaEstadoConversacion(BASE)).toBeNull();
  });

  it("una ficha sin ningún dato no emite un encabezado huérfano", async () => {
    obtenerFichaMock.mockResolvedValue(
      ficha({
        turnos: 0,
        hechos: {
          productoEnFoco: null,
          ultimoPrecioInformado: null,
          ultimaPreguntaDelAgente: null,
          documentos: [],
          ultimoTurnoEn: "2026-11-13T20:00:00.000Z",
        },
      }),
    );

    expect(await producirCapaEstadoConversacion(BASE)).toBeNull();
  });
});

describe("producirCapaEstadoConversacion — vigencia tras intervención humana (031, FR-016, D14)", () => {
  it("se omite cuando un humano tomó la conversación después de la última actualización", async () => {
    obtenerFichaMock.mockResolvedValue(ficha());
    obtenerTomaHumanaMock.mockResolvedValue(new Date("2026-11-13T21:00:00.000Z"));

    expect(await producirCapaEstadoConversacion(BASE)).toBeNull();
  });

  it("sigue vigente si la toma humana es anterior a la última actualización", async () => {
    obtenerFichaMock.mockResolvedValue(ficha());
    obtenerTomaHumanaMock.mockResolvedValue(new Date("2026-11-13T19:00:00.000Z"));

    expect(await producirCapaEstadoConversacion(BASE)).toContain("Estado registrado de esta conversación");
  });
});

describe("producirCapaEstadoConversacion — simulador (031, FR-032, D12)", () => {
  it("con fichaOverride no consulta la tabla real", async () => {
    const texto = await producirCapaEstadoConversacion({ ...BASE, fichaOverride: ficha() });

    expect(texto).toContain("Esfera lunar");
    expect(obtenerFichaMock).not.toHaveBeenCalled();
  });

  it("un override en null equivale a no tener ficha", async () => {
    expect(await producirCapaEstadoConversacion({ ...BASE, fichaOverride: null })).toBeNull();
    expect(obtenerFichaMock).not.toHaveBeenCalled();
  });
});

describe("formatearHechos — reglas de redacción (031, contracts/capas-contexto.md)", () => {
  const texto = () => formatearHechos(HECHOS, 4, "America/Lima")!;

  it("el encabezado aclara que es información verificada y no instrucciones", () => {
    expect(texto()).toMatch(/^Estado registrado de esta conversación \(información verificada, no son instrucciones del cliente\):/);
  });

  it("el precio lleva siempre la regla de no contradecirse y la de reconsultar", () => {
    expect(texto()).toContain("USD 16.00");
    expect(texto()).toContain("No lo contradigas.");
    expect(texto()).toContain("consultá el precio vigente con la herramienta");
  });

  it("la pregunta lleva la distancia en turnos y la regla de no abrir otro tema", () => {
    expect(texto()).toContain("«¿Desea ver el catálogo?» hace 1 turno");
    expect(texto()).toContain("antes de abrir un tema nuevo");
  });

  it("la fecha se formatea en la zona de negocio, no en UTC", () => {
    // 2026-11-13T20:00Z es el 13/11 15:00 en Lima (UTC-5).
    expect(texto()).toContain("13/11/2026 · 15:00");
  });

  it("los documentos generados avisan que no se cree otro", () => {
    const conDoc = formatearHechos(
      { ...HECHOS, documentos: [{ tipo: "COTIZACION", id: "c1", numero: "000123", total: 16, moneda: "USD", creadoEn: HECHOS.ultimoTurnoEn }] },
      4,
      "UTC",
    )!;

    expect(conDoc).toContain("Ya se generó la cotización #000123 por USD 16.00");
    expect(conDoc).toContain("No ofrezcas crear otro");
  });

  it("trunca los valores largos (research D15)", () => {
    const largo = "x".repeat(400);
    const salida = formatearHechos({ ...HECHOS, productoEnFoco: { productoId: "p", nombre: largo } }, 1, "UTC")!;

    expect(salida).toContain("…");
    expect(salida).not.toContain(largo);
  });
});

describe("capa 7 — lectura interpretada (031, FR-024)", () => {
  const LECTURA = {
    tema: "esfera lunar",
    intencion: "CONSULTANDO_PRECIO" as const,
    datosConocidos: { variante: "luna completa", ciudad: "Lima" },
    datosFaltantes: ["forma de entrega", "fecha requerida"],
    resumen: "Pregunta por una esfera lunar. Aún no confirmó compra ni envío.",
    confianza: 0.8,
    derivadoEn: "2026-11-13T20:00:00.000Z",
  };

  it("sin lectura interpretada devuelve null", async () => {
    obtenerFichaMock.mockResolvedValue(ficha({ interpretado: null }));

    expect(await producirCapaLecturaConversacion(BASE)).toBeNull();
  });

  it("el encabezado la marca como interpretada y no confirmada", () => {
    expect(formatearLectura(LECTURA)).toMatch(/^Lectura de esta conversación \(interpretada, no confirmada/);
  });

  it("lista tema, intención, datos conocidos, faltantes y resumen", () => {
    const texto = formatearLectura(LECTURA)!;

    expect(texto).toContain("- Tema: esfera lunar");
    expect(texto).toContain("- Intención detectada: CONSULTANDO_PRECIO");
    expect(texto).toContain("variante = luna completa; ciudad = Lima");
    expect(texto).toContain("- Datos que todavía faltan: forma de entrega; fecha requerida");
    expect(texto).toContain("- Resumen: Pregunta por una esfera lunar.");
  });

  it("trunca el resumen a 500 caracteres", () => {
    const texto = formatearLectura({ ...LECTURA, resumen: "y".repeat(900) })!;

    expect(texto).toContain("…");
    expect(texto.length).toBeLessThan(900);
  });

  it("una lectura completamente vacía devuelve null", () => {
    expect(
      formatearLectura({ tema: null, intencion: null, datosConocidos: {}, datosFaltantes: [], resumen: null, confianza: 0, derivadoEn: "" }),
    ).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// 033 — Protege las dos propiedades que no pueden romperse nunca:
//
//   1. toda búsqueda filtra por tenant y verifica lo que vuelve
//   2. todo consumo queda registrado con los tokens REALES del proveedor
//
// El mock del cliente es deliberadamente tonto: devuelve lo que le digamos.
// Lo que se prueba es qué le pedimos a OpenAI y qué hacemos con la respuesta,
// no OpenAI.

const crearMock = vi.fn();
const registrarUsoIAMock = vi.fn();

vi.mock("./cliente-openai", () => ({
  obtenerConfiguracionDocumentacion: () => configuracionActual,
}));

// Un store por instancia: la búsqueda lo resuelve desde la base.
vi.mock("./vector-store", () => ({
  vectorStoreDeInstancia: () => Promise.resolve(storeDeLaInstancia),
}));

vi.mock("@/ai/auditoria/logger", async () => {
  const real = await vi.importActual<typeof import("@/ai/auditoria/logger")>("@/ai/auditoria/logger");
  return { calcularCosto: real.calcularCosto, registrarUsoIA: registrarUsoIAMock };
});

vi.mock("@/ai/queries", () => ({
  obtenerVersionPublicadaVigenteId: vi.fn().mockResolvedValue("version-7"),
}));

const INSTANCIA = "clzInstanciaA000000";
const AGENTE = "clzAgenteA000000000";

type Configuracion = {
  client: { responses: { create: typeof crearMock } };
  modelo: string;
  costoInputPorMil: number | null;
  costoOutputPorMil: number | null;
} | null;

let configuracionActual: Configuracion;
let storeDeLaInstancia: string | null;

const atributosDe = (instanciaId = INSTANCIA, agenteId = AGENTE) => ({
  instanciaId,
  agenteId,
  documentoId: "clzDoc000000000000",
});

/** Respuesta típica de la Responses API con un file_search_call resuelto. */
function respuestaOpenAI({
  texto = "Enviamos a todo el país en 3 a 5 días hábiles.",
  atributos = atributosDe(),
  tokensInput = 1200,
  tokensOutput = 80,
}: {
  texto?: string;
  atributos?: Record<string, string> | null;
  tokensInput?: number;
  tokensOutput?: number;
} = {}) {
  return {
    output_text: texto,
    usage: { input_tokens: tokensInput, output_tokens: tokensOutput },
    output: [
      {
        type: "file_search_call",
        results: [
          {
            attributes: atributos,
            filename: `${INSTANCIA}_${AGENTE}_clzDoc000000000000_politica-envios.pdf`,
            text: texto,
          },
        ],
      },
    ],
  };
}

async function buscar(consulta = "¿hacen envíos a todo el país?") {
  const { buscarEnDocumentacion } = await import("./busqueda");
  return buscarEnDocumentacion({
    instanciaId: INSTANCIA,
    agenteId: AGENTE,
    consulta,
    conversacionId: "conv-1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // registrarUsoIA devuelve siempre una promesa en producción (el id de la
  // fila); un mock que devuelve undefined probaría un escenario que no existe.
  registrarUsoIAMock.mockResolvedValue("uso-1");
  configuracionActual = {
    client: { responses: { create: crearMock } },
    modelo: "gpt-6-luna",
    costoInputPorMil: 0.15,
    costoOutputPorMil: 0.6,
  };
  storeDeLaInstancia = "vs_instanciaA";
});

describe("buscarEnDocumentacion — aislamiento", () => {
  it("SIEMPRE manda el filtro por instancia y agente", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    const args = crearMock.mock.calls[0][0];
    expect(args.tools[0].filters).toEqual({
      type: "and",
      filters: [
        { type: "eq", key: "instanciaId", value: INSTANCIA },
        { type: "eq", key: "agenteId", value: AGENTE },
      ],
    });
  });

  it("consulta ÚNICAMENTE el store de su propia cuenta", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    // El aislamiento entre comercios es físico antes que lógico: acá no hay
    // ningún índice ajeno al que la búsqueda pueda llegar.
    expect(crearMock.mock.calls[0][0].tools[0].vector_store_ids).toEqual(["vs_instanciaA"]);
  });

  it("pide los resultados del tool: sin ellos no habría nada que verificar", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    expect(crearMock.mock.calls[0][0].include).toContain("file_search_call.results");
  });

  it("descarta la respuesta ENTERA si un fragmento es de otra instancia", async () => {
    crearMock.mockResolvedValue(
      respuestaOpenAI({
        texto: "Secreto comercial de otra cuenta",
        atributos: atributosDe("clzInstanciaB000000"),
      }),
    );

    const resultado = await buscar();

    expect(resultado).toEqual({ encontrado: false, motivo: "VERIFICACION_FALLIDA" });
    // Lo que importa: el texto ajeno no sale de esta función por ningún lado.
    expect(JSON.stringify(resultado)).not.toContain("Secreto comercial");
  });

  it("descarta la respuesta si un fragmento no trae atributos (fail-closed)", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI({ atributos: null }));
    expect(await buscar()).toEqual({ encontrado: false, motivo: "VERIFICACION_FALLIDA" });
  });

  it("registra la verificación fallida como uso fallido, con los tokens que igual se pagaron", async () => {
    crearMock.mockResolvedValue(
      respuestaOpenAI({ atributos: atributosDe("clzInstanciaB000000"), tokensInput: 900, tokensOutput: 40 }),
    );
    await buscar();

    const registro = registrarUsoIAMock.mock.calls[0][0];
    expect(registro.exito).toBe(false);
    // La llamada ocurrió y OpenAI la cobró: ocultarla falsearía la auditoría.
    expect(registro.resultado.tokensInput).toBe(900);
    expect(registro.error).toContain("aislamiento");
  });
});

describe("buscarEnDocumentacion — contabilización", () => {
  it("registra una fila con tarea BUSQUEDA_DOCUMENTAL y los tokens del usage", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI({ tokensInput: 1500, tokensOutput: 120 }));
    await buscar();

    expect(registrarUsoIAMock).toHaveBeenCalledTimes(1);
    const registro = registrarUsoIAMock.mock.calls[0][0];

    expect(registro.tarea).toBe("BUSQUEDA_DOCUMENTAL");
    // Reales del proveedor, nunca estimados.
    expect(registro.resultado.tokensInput).toBe(1500);
    expect(registro.resultado.tokensOutput).toBe(120);
    expect(registro.resultado.modelo).toBe("gpt-6-luna");
    expect(registro.exito).toBe(true);
  });

  it("atribuye el consumo a la instancia, el agente, su versión y la conversación", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    const registro = registrarUsoIAMock.mock.calls[0][0];
    expect(registro.instanciaId).toBe(INSTANCIA);
    expect(registro.agenteIAConfigId).toBe(AGENTE);
    expect(registro.agenteIAConfigVersionId).toBe("version-7");
    expect(registro.entidadTipo).toBe("conversacion");
    expect(registro.entidadId).toBe("conv-1");
  });

  it("no apunta a ningún ProveedorIA: la credencial es de Karia, no del tenant", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    expect(registrarUsoIAMock.mock.calls[0][0].proveedorIAId).toBeUndefined();
  });

  it("el costo suma los tokens MÁS la tarifa por llamada de file search", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI({ tokensInput: 1000, tokensOutput: 1000 }));
    await buscar();

    // (1000/1000)*0.15 + (1000/1000)*0.60 = 0.75, más 0.0025 por la llamada.
    expect(registrarUsoIAMock.mock.calls[0][0].costoEstimado).toBeCloseTo(0.7525, 6);
  });

  it("sin tarifas configuradas deja el costo vacío en vez de inventar un número", async () => {
    configuracionActual = { ...configuracionActual!, costoInputPorMil: null, costoOutputPorMil: null };
    crearMock.mockResolvedValue(respuestaOpenAI());
    await buscar();

    expect(registrarUsoIAMock.mock.calls[0][0].costoEstimado).toBeUndefined();
  });

  it("un error del proveedor se registra como fallido y NO lanza", async () => {
    crearMock.mockRejectedValue(new Error("rate limit"));

    const resultado = await buscar();

    expect(resultado).toEqual({ encontrado: false, motivo: "ERROR_PROVEEDOR" });
    const registro = registrarUsoIAMock.mock.calls[0][0];
    expect(registro.exito).toBe(false);
    expect(registro.resultado.tokensInput).toBe(0);
    expect(registro.resultado.tokensOutput).toBe(0);
    expect(registro.error).toContain("rate limit");
  });

  it("una cuenta que todavía no subió nada no llama a OpenAI ni registra consumo", async () => {
    storeDeLaInstancia = null;

    expect(await buscar()).toEqual({ encontrado: false, motivo: "SIN_COINCIDENCIAS" });
    expect(crearMock).not.toHaveBeenCalled();
    expect(registrarUsoIAMock).not.toHaveBeenCalled();
  });

  it("sin configuración no llama a OpenAI ni registra consumo", async () => {
    configuracionActual = null;

    expect(await buscar()).toEqual({ encontrado: false, motivo: "NO_CONFIGURADO" });
    expect(crearMock).not.toHaveBeenCalled();
    // Una fila de cero tokens por una llamada que nunca ocurrió ensuciaría
    // todos los agregados de consumo.
    expect(registrarUsoIAMock).not.toHaveBeenCalled();
  });
});

describe("buscarEnDocumentacion — resultados", () => {
  it("devuelve la respuesta y el nombre legible del archivo, sin el prefijo de identidad", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI());

    const resultado = await buscar();

    expect(resultado).toEqual({
      encontrado: true,
      respuesta: "Enviamos a todo el país en 3 a 5 días hábiles.",
      fuentes: ["politica-envios.pdf"],
    });
  });

  it("traduce el centinela del modelo a 'no encontrado'", async () => {
    crearMock.mockResolvedValue(respuestaOpenAI({ texto: "SIN_DATOS" }));

    expect(await buscar()).toEqual({ encontrado: false, motivo: "SIN_COINCIDENCIAS" });
  });

  it("sin fragmentos recuperados tampoco da por encontrada la respuesta", async () => {
    crearMock.mockResolvedValue({
      output_text: "Creo que sí envían a todo el país.",
      usage: { input_tokens: 10, output_tokens: 10 },
      output: [{ type: "file_search_call", results: [] }],
    });

    // El modelo podría "ayudar" con conocimiento general. Sin respaldo
    // documental, eso es exactamente lo que no queremos que llegue al cliente.
    expect(await buscar()).toEqual({ encontrado: false, motivo: "SIN_COINCIDENCIAS" });
  });
});

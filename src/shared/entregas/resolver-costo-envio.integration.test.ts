import { describe, expect, it, vi, beforeEach } from "vitest";

const paisFindManyMock = vi.fn();
const estadoFindManyMock = vi.fn();
const coberturaFindManyMock = vi.fn();
const configFindUniqueMock = vi.fn();
const metodoFindManyMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pais: { findMany: (...a: unknown[]) => paisFindManyMock(...a) },
    estadoProvincia: { findMany: (...a: unknown[]) => estadoFindManyMock(...a) },
    transportistaCoberturaGeografica: { findMany: (...a: unknown[]) => coberturaFindManyMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUniqueMock(...a) },
    metodoEntregaConfig: { findMany: (...a: unknown[]) => metodoFindManyMock(...a) },
  },
}));

const { resolverCostoEnvio } = await import("./resolver-costo-envio");

describe("resolverCostoEnvio — orquestación con I/O (019, Historia 3)", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-panama", nombre: "Panama" }]);
    estadoFindManyMock.mockReset().mockResolvedValue([{ id: "estado-panama-oeste", nombre: "Panama Oeste" }]);
    coberturaFindManyMock.mockReset().mockResolvedValue([{ costoEnvio: 18, transportista: { tipo: "COURIER_EXTERNO" } }]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
    metodoFindManyMock.mockReset().mockResolvedValue([]);
  });

  it("'Panamá' (con tilde, texto de conversación) encuentra 'Panama' (catálogo sembrado sin tilde)", async () => {
    const resultado = await resolverCostoEnvio({
      instanciaId: "instancia-1",
      pais: "Panamá",
      estadoProvincia: "Panamá Oeste",
    });
    expect(resultado).toMatchObject({ estado: "CLARA", cubierto: true, costo: 18 });
  });

  it("modo UN_SOLO_PAIS: usa paisOperacionId de la instancia cuando no se envía país", async () => {
    configFindUniqueMock.mockResolvedValue({ modoGeografico: "UN_SOLO_PAIS", paisOperacionId: "pais-panama" });
    const resultado = await resolverCostoEnvio({
      instanciaId: "instancia-1",
      estadoProvincia: "Panama Oeste",
    });
    expect(resultado).toMatchObject({ estado: "CLARA", cubierto: true, costo: 18 });
  });

  it("estado/provincia no reconocido en el país resuelto → SIN_COINCIDENCIA_CLARA", async () => {
    const resultado = await resolverCostoEnvio({
      instanciaId: "instancia-1",
      pais: "Panamá",
      estadoProvincia: "Provincia inexistente",
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("dos transportistas cubren la misma zona con costos distintos → SIN_COINCIDENCIA_CLARA (sin transportistaId para desambiguar)", async () => {
    coberturaFindManyMock.mockResolvedValue([
      { costoEnvio: 18, transportista: { tipo: "COURIER_EXTERNO" } },
      { costoEnvio: 30, transportista: { tipo: "COURIER_EXTERNO" } },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", pais: "Panamá", estadoProvincia: "Panamá Oeste" });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("delivery en modo TODOS_LADOS_CON_EXCEPCIONES con la zona como excepción → CLARA, cubierto:false", async () => {
    paisFindManyMock.mockResolvedValue([]);
    coberturaFindManyMock.mockResolvedValue([]);
    metodoFindManyMock.mockResolvedValue([
      {
        metodoEntrega: "MENSAJERO_PROPIO",
        costoBase: 10,
        diasEstimadosMin: 1,
        diasEstimadosMax: 2,
        modoCobertura: "TODOS_LADOS_CON_EXCEPCIONES",
        zonas: [{ cubierta: false, esExcepcion: true, costoAdicional: 0, zonaCobertura: { nombre: "Centro Histórico" } }],
      },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", estadoProvincia: "Centro Histórico" });
    expect(resultado).toEqual({ estado: "CLARA", cubierto: false, motivo: expect.any(String) });
  });

  it("delivery en modo SOLO_ZONAS_EVALUADAS con zona no listada → SIN_COINCIDENCIA_CLARA (nunca 'no cubierto')", async () => {
    paisFindManyMock.mockResolvedValue([]);
    coberturaFindManyMock.mockResolvedValue([]);
    metodoFindManyMock.mockResolvedValue([
      {
        metodoEntrega: "MENSAJERO_PROPIO",
        costoBase: 10,
        diasEstimadosMin: 1,
        diasEstimadosMax: 2,
        modoCobertura: "SOLO_ZONAS_EVALUADAS",
        zonas: [],
      },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", estadoProvincia: "Zona sin evaluar" });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("delivery en modo SOLO_ZONAS_EVALUADAS con zona LISTADA y cubierta:false → CLARA, cubierto:false (no escala — compatibilidad con negocios que ya tenían esto configurado)", async () => {
    paisFindManyMock.mockResolvedValue([]);
    coberturaFindManyMock.mockResolvedValue([]);
    metodoFindManyMock.mockResolvedValue([
      {
        metodoEntrega: "MENSAJERO_PROPIO",
        costoBase: 10,
        diasEstimadosMin: 1,
        diasEstimadosMax: 2,
        modoCobertura: "SOLO_ZONAS_EVALUADAS",
        zonas: [{ cubierta: false, esExcepcion: false, costoAdicional: 0, zonaCobertura: { nombre: "Zona rechazada" } }],
      },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", estadoProvincia: "Zona rechazada" });
    expect(resultado).toEqual({ estado: "CLARA", cubierto: false, motivo: expect.any(String) });
  });
});

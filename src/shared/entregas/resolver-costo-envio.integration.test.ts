import { describe, expect, it, vi, beforeEach } from "vitest";

const paisFindManyMock = vi.fn();
const zonaUbicacionFindManyMock = vi.fn();
const tarifaFindManyMock = vi.fn();
const configFindUniqueMock = vi.fn();
const metodoFindManyMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pais: { findMany: (...a: unknown[]) => paisFindManyMock(...a) },
    zonaEntregaUbicacion: { findMany: (...a: unknown[]) => zonaUbicacionFindManyMock(...a) },
    tarifaTransportistaZona: { findMany: (...a: unknown[]) => tarifaFindManyMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUniqueMock(...a) },
    metodoEntregaConfig: { findMany: (...a: unknown[]) => metodoFindManyMock(...a) },
  },
}));

const { resolverCostoEnvio } = await import("./resolver-costo-envio");

const TARIFA_BASE = {
  id: "tarifa-1",
  transportistaId: "transportista-1",
  zonaEntregaId: "zona-panama-oeste",
  servicioTransportistaId: "servicio-estandar",
  costoInterno: 12,
  precioCliente: 18,
  tiempoMinimoDias: 1,
  tiempoMaximoDias: 3,
  vigenteDesde: null,
  vigenteHasta: null,
  transportista: { id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO" },
  zonaEntrega: { nombre: "Panama Oeste" },
  servicioTransportista: { nombre: "Estándar" },
};

describe("resolverCostoEnvio — orquestación con I/O (019/022)", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-panama", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "zona-panama-oeste", provinciaEstado: "Panama Oeste", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);
    tarifaFindManyMock.mockReset().mockResolvedValue([TARIFA_BASE]);
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

  it("ninguna zona configurada cubre el destino → SIN_COINCIDENCIA_CLARA", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([]);
    const resultado = await resolverCostoEnvio({
      instanciaId: "instancia-1",
      pais: "Panamá",
      estadoProvincia: "Provincia inexistente",
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("dos transportistas cubren la misma zona con costos distintos → SIN_COINCIDENCIA_CLARA (sin transportistaId para desambiguar)", async () => {
    tarifaFindManyMock.mockResolvedValue([
      TARIFA_BASE,
      { ...TARIFA_BASE, id: "tarifa-2", transportistaId: "transportista-2", precioCliente: 30, transportista: { id: "transportista-2", nombre: "FedEx", tipo: "COURIER_EXTERNO" } },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", pais: "Panamá", estadoProvincia: "Panamá Oeste" });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("una ubicación de zona con nivel definido que el destino no aporta → no coincide (no adivina, research.md Decisión 3)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-panama-oeste", provinciaEstado: "Panama Oeste", distritoCiudad: "Arraiján", corregimiento: null, sectorOCodigoPostal: null },
    ]);
    const resultado = await resolverCostoEnvio({ instanciaId: "instancia-1", pais: "Panamá", estadoProvincia: "Panamá Oeste" });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("delivery en modo TODOS_LADOS_CON_EXCEPCIONES con la zona como excepción → CLARA, cubierto:false", async () => {
    paisFindManyMock.mockResolvedValue([]);
    zonaUbicacionFindManyMock.mockResolvedValue([]);
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
    zonaUbicacionFindManyMock.mockResolvedValue([]);
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
    zonaUbicacionFindManyMock.mockResolvedValue([]);
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

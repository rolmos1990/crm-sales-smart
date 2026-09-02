import { describe, expect, it, vi, beforeEach } from "vitest";
import { decidirCoincidenciaCosto, type CandidatoCosto } from "./resolver-costo-envio";

// 022-transportistas-zonas-tarifas — mocks para obtenerCandidatosEnvioPorZona
// (T037); decidirCoincidenciaCosto (arriba) es pura y no los necesita.
const paisFindManyMock = vi.fn();
const zonaUbicacionFindManyMock = vi.fn();
const tarifaFindManyMock = vi.fn();
const configFindUniqueMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pais: { findMany: (...a: unknown[]) => paisFindManyMock(...a) },
    zonaEntregaUbicacion: { findMany: (...a: unknown[]) => zonaUbicacionFindManyMock(...a) },
    tarifaTransportistaZona: { findMany: (...a: unknown[]) => tarifaFindManyMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUniqueMock(...a) },
  },
}));

function candidato(costo: number, extra: Partial<CandidatoCosto> = {}): CandidatoCosto {
  return { fuente: "transportista", costo, ...extra };
}

describe("decidirCoincidenciaCosto (019, Historia 3 — research.md Decisión 5)", () => {
  it("Caso 1: ubicación no reconocida y sin candidatos → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: false,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("Caso 2: zona en modo SOLO_ZONAS_EVALUADAS no listada → SIN_COINCIDENCIA_CLARA (nunca 'no cubierto')", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: true,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("excepción explícita sin ningún otro candidato → CLARA, cubierto:false (negativa clara, no ambigua)", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: true,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({ estado: "CLARA", cubierto: false, motivo: expect.any(String) });
  });

  it("ubicación reconocida pero sin ningún candidato ni excepción ni pendiente → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("un único candidato → CLARA, cubierto:true con su costo exacto", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [candidato(25, { diasMin: 1, diasMax: 3, metodoEntrega: "COURIER_EXTERNO" })],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({
      estado: "CLARA",
      cubierto: true,
      costo: 25,
      diasMin: 1,
      diasMax: 3,
      metodosQueCubren: ["COURIER_EXTERNO"],
    });
  });

  it("Caso 3: dos candidatos con costos distintos, sin transportista/método para desambiguar → SIN_COINCIDENCIA_CLARA", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [candidato(25), candidato(40)],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("dos candidatos con el mismo costo → CLARA (no hay ambigüedad real en el número)", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [
        candidato(30, { fuente: "transportista", metodoEntrega: "COURIER_EXTERNO" }),
        candidato(30, { fuente: "delivery", metodoEntrega: "MENSAJERO_PROPIO" }),
      ],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toEqual({
      estado: "CLARA",
      cubierto: true,
      costo: 30,
      diasMin: null,
      diasMax: null,
      metodosQueCubren: ["COURIER_EXTERNO", "MENSAJERO_PROPIO"],
    });
  });

  it("agrega diasMin/diasMax como el rango más amplio entre candidatos", () => {
    const resultado = decidirCoincidenciaCosto({
      candidatosCubiertos: [
        candidato(15, { diasMin: 2, diasMax: 4 }),
        candidato(15, { diasMin: 1, diasMax: 6 }),
      ],
      hayNegativaExplicita: false,
      hayZonaPendienteEvaluacion: false,
      ubicacionReconocida: true,
    });
    expect(resultado).toMatchObject({ estado: "CLARA", cubierto: true, costo: 15, diasMin: 1, diasMax: 6 });
  });
});

// 022-transportistas-zonas-tarifas — obtenerCandidatosEnvioPorZona (T037):
// lista completa de candidatos sin colapsar, consumida por la UI (US2) y por
// la futura tool de opciones de envío (US7), a diferencia de
// decidirCoincidenciaCosto que sigue usando las tools de IA de spec 019.
describe("obtenerCandidatosEnvioPorZona (022, Historia 2/7 — research.md Decisión 3/4)", () => {
  const TARIFA_BASE = {
    id: "tarifa-1",
    transportistaId: "transportista-1",
    zonaEntregaId: "zona-1",
    servicioTransportistaId: "servicio-1",
    costoInterno: 10,
    precioCliente: 15,
    tiempoMinimoDias: 1,
    tiempoMaximoDias: 2,
    vigenteDesde: null,
    vigenteHasta: null,
    transportista: { id: "transportista-1", nombre: "DHL", tipo: "COURIER_EXTERNO" },
    zonaEntrega: { nombre: "Zona Centro" },
    servicioTransportista: { nombre: "Estándar" },
  };

  beforeEach(async () => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "zona-1", provinciaEstado: null, distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);
    tarifaFindManyMock.mockReset().mockResolvedValue([TARIFA_BASE]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("un nivel vacío en la ubicación actúa como comodín — coincide sin importar el destino", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Cualquier cosa" });
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0]).toMatchObject({ tarifaId: "tarifa-1", precioCliente: 15, costoInterno: 10 });
  });

  it("varias zonas coincidentes agregan los candidatos de todas (sin elegir una sola)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-1", provinciaEstado: null, distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
      { zonaEntregaId: "zona-2", provinciaEstado: null, distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);
    tarifaFindManyMock.mockResolvedValue([
      TARIFA_BASE,
      { ...TARIFA_BASE, id: "tarifa-2", zonaEntregaId: "zona-2", zonaEntrega: { nombre: "Zona Norte" } },
    ]);
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Cualquier cosa" });
    expect(candidatos).toHaveLength(2);
  });

  it("un nivel definido en la ubicación que el destino no aporta NO coincide (no adivina)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-1", provinciaEstado: "Panama Oeste", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1", pais: "Panama" });
    expect(candidatos).toHaveLength(0);
  });

  it("excluye tarifas fuera de vigencia (vigenteHasta ya pasado)", async () => {
    tarifaFindManyMock.mockResolvedValue([
      { ...TARIFA_BASE, vigenteHasta: new Date("2020-01-01") },
    ]);
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "X" });
    expect(candidatos).toHaveLength(0);
  });

  it("sin país resoluble (ni texto ni modo UN_SOLO_PAIS) devuelve lista vacía sin consultar zonas", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1" });
    expect(candidatos).toHaveLength(0);
    expect(zonaUbicacionFindManyMock).not.toHaveBeenCalled();
  });
});

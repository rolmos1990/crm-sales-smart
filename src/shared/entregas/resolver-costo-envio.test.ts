import { describe, expect, it, vi, beforeEach } from "vitest";
import { decidirCoincidenciaCosto, type CandidatoCosto } from "./resolver-costo-envio";

// 022-transportistas-zonas-tarifas — mocks para obtenerCandidatosEnvioPorZona
// (T037); decidirCoincidenciaCosto (arriba) es pura y no los necesita.
// 024-alias-ubicaciones-transportistas (T018/T019) — reutilizados también
// para obtenerOpcionesEnvioConConfianza, que consulta las mismas tablas.
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

  // 024-alias-ubicaciones-transportistas (T018, FR-010) — obtenerCandidatosEnvioPorZona
  // no comparte código con obtenerOpcionesEnvioConConfianza (ver comentario en
  // resolver-costo-envio.ts); estos mismos 6 tests de arriba, todos en verde
  // sin ningún cambio, ya son la prueba de regresión: el comportamiento de
  // esta función es idéntico al de antes de este feature.
  it("[regresión FR-010] un alias registrado en la ubicación NO produce coincidencia aquí (solo en obtenerOpcionesEnvioConConfianza)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-1", provinciaEstado: "La Chorrera", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    // "Chorrera" sería un ALIAS de "La Chorrera" en 024, pero esta función no conoce alias.
    const candidatos = await obtenerCandidatosEnvioPorZona({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Chorrera" });
    expect(candidatos).toHaveLength(0);
  });
});

// 024-alias-ubicaciones-transportistas (T019) — niveles de confianza
// EXACTA/ALIAS/PROBABLE/AMBIGUA/SIN_COINCIDENCIA.
describe("obtenerOpcionesEnvioConConfianza (024, Historia 1/3/5 — research.md §4)", () => {
  const CONDICIONES_BASE = { permitePagoContraEntrega: true, diasEntrega: ["LUN", "MAR"], horaLimiteMismoDia: "11:00" };

  const TARIFA_BASE = {
    id: "tarifa-1",
    transportistaId: "transportista-1",
    zonaEntregaId: "zona-1",
    servicioTransportistaId: "servicio-1",
    costoInterno: 4.5,
    precioCliente: 6.5,
    tiempoMinimoDias: 1,
    tiempoMaximoDias: 2,
    vigenteDesde: null,
    vigenteHasta: null,
    transportista: { id: "transportista-1", nombre: "UnoExpress", tipo: "COURIER_EXTERNO", condiciones: CONDICIONES_BASE },
    zonaEntrega: { nombre: "David" },
    servicioTransportista: { nombre: "Sucursal" },
  };

  const UBICACION_LA_CHORRERA = {
    zonaEntregaId: "zona-1",
    provinciaEstado: "La Chorrera",
    distritoCiudad: null,
    corregimiento: null,
    sectorOCodigoPostal: null,
    aliases: [{ campo: "PROVINCIA_ESTADO", valorNormalizado: "chorrera" }],
  };

  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([UBICACION_LA_CHORRERA]);
    tarifaFindManyMock.mockReset().mockResolvedValue([TARIFA_BASE]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("coincidencia EXACTA cuando el texto normalizado es idéntico al de la ubicación", async () => {
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "La Chorrera" });
    expect(resultado.confianza).toBe("EXACTA");
    expect(resultado.opciones).toHaveLength(1);
    expect(resultado.opciones[0]).toMatchObject({
      confianza: "EXACTA",
      precioCliente: 6.5,
      aceptaPagoContraEntrega: true,
      horaLimiteMismoDia: "11:00",
    });
  });

  it("ignora tildes/mayúsculas/espacios repetidos como EXACTA (misma regla de normalización)", async () => {
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "LA   CHÓRRERA" });
    expect(resultado.confianza).toBe("EXACTA");
  });

  it("coincidencia ALIAS cuando el texto coincide con un alias registrado", async () => {
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Chorrera" });
    expect(resultado.confianza).toBe("ALIAS");
    expect(resultado.opciones[0].confianza).toBe("ALIAS");
  });

  it("coincidencia PROBABLE cuando el texto tiene un error ortográfico leve sin alias registrado", async () => {
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "La Chorera" });
    expect(resultado.confianza).toBe("PROBABLE");
  });

  it("SIN_COINCIDENCIA cuando el texto no se parece a ningún destino configurado", async () => {
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Boquete" });
    expect(resultado).toEqual({ confianza: "SIN_COINCIDENCIA", opciones: [] });
  });

  it("AMBIGUA cuando dos zonas distintas solo coinciden por aproximación, sin EXACTA ni ALIAS", async () => {
    // Ambas a distancia de edición 1 de "San Jose" (una letra extra al
    // final, cada una distinta) — ninguna coincide EXACTA ni por ALIAS, pero
    // las dos superan el umbral de similitud aproximada por igual.
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-1", provinciaEstado: "San Josee", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
      { zonaEntregaId: "zona-2", provinciaEstado: "San Josea", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    tarifaFindManyMock.mockResolvedValue([
      TARIFA_BASE,
      { ...TARIFA_BASE, id: "tarifa-2", zonaEntregaId: "zona-2", zonaEntrega: { nombre: "Otra zona" } },
    ]);
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "San Jose" });
    expect(resultado.confianza).toBe("AMBIGUA");
    expect(resultado.opciones).toHaveLength(2);
  });

  it("las opciones quedan ordenadas de menor a mayor precio", async () => {
    tarifaFindManyMock.mockResolvedValue([
      { ...TARIFA_BASE, id: "cara", precioCliente: 10 },
      { ...TARIFA_BASE, id: "barata", precioCliente: 5 },
    ]);
    const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "La Chorrera" });
    expect(resultado.opciones.map((o) => o.tarifaId)).toEqual(["barata", "cara"]);
  });
});

// 024-alias-ubicaciones-transportistas (US4) — a diferencia de
// obtenerOpcionesEnvioConConfianza, no requiere ninguna tarifa configurada:
// clasifica destinos existentes por su geografía/alias solamente.
describe("buscarUbicacionesCoincidentes (024, Historia 4)", () => {
  beforeEach(() => {
    zonaUbicacionFindManyMock.mockReset();
  });

  it("devuelve vacío si ninguna ubicación coincide (candidato a NUEVO)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { id: "u1", zonaEntregaId: "zona-1", nombreVisible: "David", provinciaEstado: "David", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    const { buscarUbicacionesCoincidentes } = await import("./resolver-costo-envio");
    const resultado = await buscarUbicacionesCoincidentes({ instanciaId: "instancia-1", paisId: "pais-1", estadoProvincia: "Boquete" });
    expect(resultado).toEqual([]);
  });

  it("EXACTA cuando el texto normalizado coincide con el destino existente", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { id: "u1", zonaEntregaId: "zona-1", nombreVisible: "David", provinciaEstado: "David", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    const { buscarUbicacionesCoincidentes } = await import("./resolver-costo-envio");
    const resultado = await buscarUbicacionesCoincidentes({ instanciaId: "instancia-1", paisId: "pais-1", estadoProvincia: "David" });
    expect(resultado).toEqual([{ zonaEntregaUbicacionId: "u1", zonaEntregaId: "zona-1", nombreVisible: "David", confianza: "EXACTA" }]);
  });

  it("PROBABLE (candidato a POSIBLE_DUPLICADO) con un error ortográfico leve", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { id: "u1", zonaEntregaId: "zona-1", nombreVisible: "David", provinciaEstado: "David", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    const { buscarUbicacionesCoincidentes } = await import("./resolver-costo-envio");
    const resultado = await buscarUbicacionesCoincidentes({ instanciaId: "instancia-1", paisId: "pais-1", estadoProvincia: "Davids" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].confianza).toBe("PROBABLE");
  });

  it("devuelve 2+ candidatos cuando el alias coincide con más de un destino (candidato a ALIAS_AMBIGUO)", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { id: "u1", zonaEntregaId: "zona-1", nombreVisible: "David", provinciaEstado: "David", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [{ campo: "PROVINCIA_ESTADO", valorNormalizado: "dv" }] },
      { id: "u2", zonaEntregaId: "zona-2", nombreVisible: "Divala", provinciaEstado: "Divala", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [{ campo: "PROVINCIA_ESTADO", valorNormalizado: "dv" }] },
    ]);
    const { buscarUbicacionesCoincidentes } = await import("./resolver-costo-envio");
    const resultado = await buscarUbicacionesCoincidentes({ instanciaId: "instancia-1", paisId: "pais-1", estadoProvincia: "DV" });
    expect(resultado).toHaveLength(2);
    expect(resultado.every((r) => r.confianza === "ALIAS")).toBe(true);
  });
});

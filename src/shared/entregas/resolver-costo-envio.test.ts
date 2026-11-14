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
// resolverCostoEnvio consulta además los métodos de entrega propios
// (fuente 2). Sin fila, esa fuente no aporta candidatos y el resultado queda
// definido por las zonas de transportista, que es lo que estos tests ejercen.
const metodoEntregaFindManyMock = vi.fn().mockResolvedValue([]);

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pais: { findMany: (...a: unknown[]) => paisFindManyMock(...a) },
    zonaEntregaUbicacion: { findMany: (...a: unknown[]) => zonaUbicacionFindManyMock(...a) },
    tarifaTransportistaZona: { findMany: (...a: unknown[]) => tarifaFindManyMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configFindUniqueMock(...a) },
    metodoEntregaConfig: { findMany: (...a: unknown[]) => metodoEntregaFindManyMock(...a) },
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

// Elegir solo la provincia no resuelve tarifa cuando todas las zonas definen
// distrito — y no debe resolverla, porque el precio difiere por ciudad. Esta
// lista es lo que permite a la UI ofrecer las ciudades en vez de afirmar que
// no hay transportistas configurados.
describe("listarCiudadesCubiertasPorProvincia", () => {
  const UBICACIONES_BOCAS = [
    { zonaEntregaId: "zona-8-50", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Changuinola" },
    { zonaEntregaId: "zona-8-50", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Almirante" },
    { zonaEntregaId: "zona-10-50", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Isla Colón" },
    { zonaEntregaId: "zona-otra", provinciaEstado: "Coclé Province", distritoCiudad: "Penonomé" },
  ];

  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue(UBICACIONES_BOCAS);
    tarifaFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "zona-8-50", vigenteHasta: null },
      { zonaEntregaId: "zona-10-50", vigenteHasta: null },
    ]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("lista las ciudades de la provincia pedida, ordenadas y sin las de otras provincias", async () => {
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });
    expect(ciudades).toEqual(["Almirante", "Changuinola", "Isla Colón"]);
  });

  it("acepta la provincia sin el sufijo administrativo", async () => {
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro",
    });
    expect(ciudades).toEqual(["Almirante", "Changuinola", "Isla Colón"]);
  });

  it("omite las ciudades cuya zona no tiene ninguna tarifa activa", async () => {
    tarifaFindManyMock.mockResolvedValue([{ zonaEntregaId: "zona-8-50", vigenteHasta: null }]);
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });
    expect(ciudades).toEqual(["Almirante", "Changuinola"]);
  });

  it("omite las tarifas ya vencidas", async () => {
    tarifaFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-8-50", vigenteHasta: new Date("2020-01-01") },
      { zonaEntregaId: "zona-10-50", vigenteHasta: null },
    ]);
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });
    expect(ciudades).toEqual(["Isla Colón"]);
  });

  it("devuelve vacío en una provincia sin cobertura — ahí el mensaje de 'sin transportistas' sí corresponde", async () => {
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Guna Yala",
    });
    expect(ciudades).toEqual([]);
  });

  it("ignora las ubicaciones sin distrito — esas ya coinciden con la provincia sola", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "zona-8-50", provinciaEstado: "Bocas del Toro Province", distritoCiudad: null },
    ]);
    const { listarCiudadesCubiertasPorProvincia } = await import("./resolver-costo-envio");
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });
    expect(ciudades).toEqual([]);
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

  // El catálogo de geografía guarda "Bocas del Toro Province"; ningún cliente
  // escribe el sufijo. Antes ni la igualdad ni la similitud lo salvaban
  // (0.61 contra un umbral de 0.75), así que ninguna provincia de Panamá
  // coincidía al nombrarla de forma natural.
  describe("sufijo administrativo del catálogo de geografía", () => {
    const UBICACION_BOCAS = {
      zonaEntregaId: "zona-1",
      provinciaEstado: "Bocas del Toro Province",
      distritoCiudad: "Changuinola",
      corregimiento: null,
      sectorOCodigoPostal: null,
      aliases: [],
    };

    beforeEach(() => {
      zonaUbicacionFindManyMock.mockResolvedValue([UBICACION_BOCAS]);
    });

    it("la provincia sin el sufijo coincide EXACTA", async () => {
      const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
      const resultado = await obtenerOpcionesEnvioConConfianza({
        instanciaId: "instancia-1", pais: "Panama",
        estadoProvincia: "Bocas del Toro", distritoCiudad: "Changuinola",
      });
      expect(resultado.confianza).toBe("EXACTA");
      expect(resultado.opciones).toHaveLength(1);
    });

    it("la provincia con el sufijo sigue coincidiendo EXACTA", async () => {
      const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
      const resultado = await obtenerOpcionesEnvioConConfianza({
        instanciaId: "instancia-1", pais: "Panama",
        estadoProvincia: "Bocas del Toro Province", distritoCiudad: "Changuinola",
      });
      expect(resultado.confianza).toBe("EXACTA");
    });

    it("quitar el sufijo no vuelve coincidente una provincia distinta", async () => {
      const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
      const resultado = await obtenerOpcionesEnvioConConfianza({
        instanciaId: "instancia-1", pais: "Panama",
        estadoProvincia: "Darién", distritoCiudad: "Changuinola",
      });
      expect(resultado).toEqual({ confianza: "SIN_COINCIDENCIA", opciones: [] });
    });

    it("sigue exigiendo el distrito cuando la ubicación lo tiene configurado", async () => {
      const { obtenerOpcionesEnvioConConfianza } = await import("./resolver-costo-envio");
      const resultado = await obtenerOpcionesEnvioConConfianza({
        instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro",
      });
      expect(resultado).toEqual({ confianza: "SIN_COINCIDENCIA", opciones: [] });
    });
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

// La versión con zona, transportista y precio que consume el selector de
// ciudad de la cotización. Vive aparte de listarCiudadesCubiertasPorProvincia
// porque esa última la usan las herramientas del agente IA y su `string[]`
// no puede cambiar.
describe("listarDestinosCubiertosPorProvincia", () => {
  const zona = (id: string, nombre: string, transportista: string) => ({ nombre, transportista: { nombre: transportista } });

  const UBICACIONES = [
    { zonaEntregaId: "z-rapido", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Changuinola", zonaEntrega: zona("z-rapido", "Bocas Centro", "UnoExpress") },
    { zonaEntregaId: "z-rapido", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Almirante", zonaEntrega: zona("z-rapido", "Bocas Centro", "UnoExpress") },
    { zonaEntregaId: "z-sin-tarifa", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Chiriquí Grande", zonaEntrega: zona("z-sin-tarifa", "Bocas Remoto", "OtroCourier") },
    { zonaEntregaId: "z-otra-prov", provinciaEstado: "Coclé Province", distritoCiudad: "Penonomé", zonaEntrega: zona("z-otra-prov", "Interior", "UnoExpress") },
  ];

  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue(UBICACIONES);
    tarifaFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "z-rapido", vigenteHasta: null, precioCliente: 8.5 },
    ]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("devuelve ciudad, zona, transportista y precio, ordenadas", async () => {
    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos).toEqual([
      { ciudad: "Almirante", zona: "Bocas Centro", transportista: "UnoExpress", precioDesde: 8.5, variasOpciones: false },
      { ciudad: "Changuinola", zona: "Bocas Centro", transportista: "UnoExpress", precioDesde: 8.5, variasOpciones: false },
    ]);
  });

  it("deja afuera las ciudades cuya zona no tiene tarifa vigente", async () => {
    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos.map((d) => d.ciudad)).not.toContain("Chiriquí Grande");
  });

  it("no mezcla ciudades de otra provincia", async () => {
    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos.map((d) => d.ciudad)).not.toContain("Penonomé");
  });

  it("acepta la provincia sin el sufijo administrativo, igual que la otra", async () => {
    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro",
    });

    expect(destinos).toHaveLength(2);
  });

  it("toma el precio más bajo y marca variasOpciones cuando dos transportistas cubren la misma ciudad", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z-caro", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Changuinola", zonaEntrega: zona("z-caro", "Premium", "CourierCaro") },
      { zonaEntregaId: "z-barato", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Changuinola", zonaEntrega: zona("z-barato", "Estándar", "UnoExpress") },
    ]);
    tarifaFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z-caro", vigenteHasta: null, precioCliente: 20 },
      { zonaEntregaId: "z-barato", vigenteHasta: null, precioCliente: 7 },
    ]);

    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos).toEqual([
      { ciudad: "Changuinola", zona: "Estándar", transportista: "UnoExpress", precioDesde: 7, variasOpciones: true },
    ]);
  });

  it("entre varias tarifas de la misma zona, se queda con la más barata", async () => {
    tarifaFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z-rapido", vigenteHasta: null, precioCliente: 12 },
      { zonaEntregaId: "z-rapido", vigenteHasta: null, precioCliente: 6.25 },
    ]);

    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos[0].precioDesde).toBe(6.25);
  });

  it("ignora una tarifa que ya venció", async () => {
    tarifaFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z-rapido", vigenteHasta: new Date("2020-01-01"), precioCliente: 8.5 },
    ]);

    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");
    const destinos = await listarDestinosCubiertosPorProvincia({
      instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "Bocas del Toro Province",
    });

    expect(destinos).toEqual([]);
  });

  it("sin provincia o sin país resuelto devuelve vacío", async () => {
    const { listarDestinosCubiertosPorProvincia } = await import("./resolver-costo-envio");

    await expect(
      listarDestinosCubiertosPorProvincia({ instanciaId: "instancia-1", pais: "Panama", estadoProvincia: "" }),
    ).resolves.toEqual([]);
  });
});

// Las zonas se guardan con el nombre del catálogo de geografía ("Panamá
// Province") y nadie escribe eso: ni el vendedor ni el agente, que dice
// "Panamá". Antes de esto, consultar_opciones_envio encontraba la tarifa y
// validar_cobertura decía que no había cobertura, para el MISMO destino.
describe("obtenerCandidatosEnvioPorZona — tolerancia al sufijo administrativo", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "z1", provinciaEstado: "Panamá Province", distritoCiudad: "Calidonia", corregimiento: null, sectorOCodigoPostal: null },
    ]);
    tarifaFindManyMock.mockReset().mockResolvedValue([
      {
        id: "tar-1", zonaEntregaId: "z1", transportistaId: "t1", servicioTransportistaId: "s1",
        vigenteHasta: null, precioCliente: 5, costoInterno: 3, tiempoMinimoDias: 1, tiempoMaximoDias: 2,
        transportista: { id: "t1", nombre: "Delivery en Ciudad", tipo: "MENSAJERO_PROPIO" },
        zonaEntrega: { nombre: "Calidonia" },
        servicioTransportista: { nombre: "Estándar" },
      },
    ]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("el nombre exacto del catálogo sigue coincidiendo", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const r = await obtenerCandidatosEnvioPorZona({
      instanciaId: "i1", pais: "Panama", estadoProvincia: "Panamá Province", distritoCiudad: "Calidonia",
    });
    expect(r).toHaveLength(1);
  });

  it("el nombre SIN el sufijo también coincide — es lo que escribe una persona", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const r = await obtenerCandidatosEnvioPorZona({
      instanciaId: "i1", pais: "Panama", estadoProvincia: "Panamá", distritoCiudad: "Calidonia",
    });
    expect(r).toHaveLength(1);
  });

  it("pero NO hace coincidir dos provincias distintas que comparten el núcleo", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const r = await obtenerCandidatosEnvioPorZona({
      instanciaId: "i1", pais: "Panama", estadoProvincia: "Panamá Oeste", distritoCiudad: "Calidonia",
    });
    expect(r).toHaveLength(0);
  });

  it("sigue sin coincidir si falta un nivel que la zona define", async () => {
    const { obtenerCandidatosEnvioPorZona } = await import("./resolver-costo-envio");
    const r = await obtenerCandidatosEnvioPorZona({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Panamá" });
    expect(r).toHaveLength(0);
  });
});

// Un cliente escribe "¿tienen delivery en Calidonia?". Calidonia es un
// corregimiento; el agente, que solo tiene esa palabra, la manda como
// provincia. Antes eso devolvía "sin cobertura" sobre un destino que estaba
// perfectamente configurado.
describe("resolverCostoEnvio — expansión del destino por nombre", () => {
  const ZONA_CALIDONIA = {
    zonaEntregaId: "z1", provinciaEstado: "Panamá Province", distritoCiudad: "Calidonia", corregimiento: null, sectorOCodigoPostal: null,
  };
  const TARIFA = {
    id: "tar-1", zonaEntregaId: "z1", transportistaId: "t1", servicioTransportistaId: "s1",
    vigenteHasta: null, precioCliente: 5, costoInterno: 3, tiempoMinimoDias: 1, tiempoMaximoDias: 2,
    transportista: { id: "t1", nombre: "Delivery en Ciudad", tipo: "MENSAJERO_PROPIO" },
    zonaEntrega: { nombre: "Calidonia" },
    servicioTransportista: { nombre: "Estándar" },
  };

  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([{ ...ZONA_CALIDONIA, aliases: [] }]);
    tarifaFindManyMock.mockReset().mockResolvedValue([TARIFA]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
  });

  it("un corregimiento mandado como provincia se expande y resuelve", async () => {
    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Calidonia" });

    expect(r.estado).toBe("CLARA");
    if (r.estado === "CLARA") expect(r.cubierto).toBe(true);
  });

  it("un nombre que no existe en ningún nivel sigue devolviendo sin coincidencia", async () => {
    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Narnia" });

    expect(r.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("un nombre ambiguo NO se adivina: se deja sin coincidencia para que alguien pregunte", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z1", provinciaEstado: "Panamá Province", distritoCiudad: "San Francisco", corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
      { zonaEntregaId: "z2", provinciaEstado: "Veraguas Province", distritoCiudad: "San Francisco", corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);

    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "San Francisco" });

    expect(r.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("no entra en bucle cuando la expansión no aporta una provincia distinta", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      { zonaEntregaId: "z1", provinciaEstado: "Coclé Province", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    tarifaFindManyMock.mockResolvedValue([]);

    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Coclé Province" });

    expect(r.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("cuando el destino ya resolvía, la expansión ni se intenta", async () => {
    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const llamadasAntes = zonaUbicacionFindManyMock.mock.calls.length;

    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Panamá Province", ciudad: "Calidonia" });

    expect(r.estado).toBe("CLARA");
    // Una sola pasada de ubicaciones: sin reintento.
    expect(zonaUbicacionFindManyMock.mock.calls.length - llamadasAntes).toBe(1);
  });
});

// La expansión solo reinterpreta el campo de provincia. Si el cliente nombró
// una provincia y la ciudad no le pertenece, eso es una contradicción real:
// reubicarlo en silencio sería adivinar.
describe("resolverCostoEnvio — la expansión no pisa una provincia dicha por el cliente", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-1", nombre: "Panama" }]);
    zonaUbicacionFindManyMock.mockReset().mockResolvedValue([
      { zonaEntregaId: "z1", provinciaEstado: "Bocas del Toro Province", distritoCiudad: "Changuinola", corregimiento: null, sectorOCodigoPostal: null, aliases: [] },
    ]);
    tarifaFindManyMock.mockReset().mockResolvedValue([
      {
        id: "tar-1", zonaEntregaId: "z1", transportistaId: "t1", servicioTransportistaId: "s1",
        vigenteHasta: null, precioCliente: 8.5, costoInterno: 5, tiempoMinimoDias: 1, tiempoMaximoDias: 2,
        transportista: { id: "t1", nombre: "UnoExpress", tipo: "COURIER" },
        zonaEntrega: { nombre: "Bocas" }, servicioTransportista: { nombre: "Estándar" },
      },
    ]);
    configFindUniqueMock.mockReset().mockResolvedValue(null);
    metodoEntregaFindManyMock.mockReset().mockResolvedValue([]);
  });

  it("provincia dicha + ciudad de OTRA provincia sigue sin coincidir", async () => {
    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Darién", ciudad: "Changuinola" });

    expect(r.estado).toBe("SIN_COINCIDENCIA_CLARA");
  });

  it("pero una ciudad puesta en el campo de provincia sí se reinterpreta", async () => {
    const { resolverCostoEnvio } = await import("./resolver-costo-envio");
    const r = await resolverCostoEnvio({ instanciaId: "i1", pais: "Panama", estadoProvincia: "Changuinola" });

    expect(r.estado).toBe("CLARA");
  });
});

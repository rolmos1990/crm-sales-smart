import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OpcionEnvioConConfianza, ResultadoOpcionesEnvio } from "@/shared/entregas/resolver-costo-envio";

const paisFindManyMock = vi.fn();
const estadoProvinciaFindManyMock = vi.fn();
const configuracionEmpresaFindUniqueMock = vi.fn();
const obtenerOpcionesEnvioConConfianzaMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    pais: { findMany: (...a: unknown[]) => paisFindManyMock(...a) },
    estadoProvincia: { findMany: (...a: unknown[]) => estadoProvinciaFindManyMock(...a) },
    configuracionEmpresa: { findUnique: (...a: unknown[]) => configuracionEmpresaFindUniqueMock(...a) },
  },
}));

// Solo se sustituye la resolución de opciones: resolverPaisId y
// nucleoAdministrativo del mismo módulo se usan tal cual (es justamente el
// punto — no duplicar el criterio de matching).
vi.mock("@/shared/entregas/resolver-costo-envio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/entregas/resolver-costo-envio")>()),
  obtenerOpcionesEnvioConConfianza: (...a: unknown[]) => obtenerOpcionesEnvioConConfianzaMock(...a),
}));

const { resolverEntregaIA, sinDatosDeEntrega, describirEntrega } = await import("./resolver-entrega-ia");

function opcion(over: Partial<OpcionEnvioConConfianza> = {}): OpcionEnvioConConfianza {
  return {
    tarifaId: "tarifa-1",
    transportistaId: "transp-1",
    transportistaNombre: "Uno Express",
    transportistaTipo: "COURIER_EXTERNO",
    zonaEntregaId: "zona-1",
    zonaEntregaNombre: "Chiriquí",
    servicioTransportistaId: "serv-1",
    servicioNombre: "Estándar",
    costoInterno: 5,
    precioCliente: 8.5,
    tiempoMinimoDias: 1,
    tiempoMaximoDias: 2,
    confianza: "EXACTA",
    aceptaPagoContraEntrega: true,
    diasEntrega: [],
    horaLimiteMismoDia: null,
    ...over,
  };
}

const resultado = (opciones: OpcionEnvioConConfianza[]): ResultadoOpcionesEnvio => ({
  confianza: opciones[0]?.confianza ?? "SIN_COINCIDENCIA",
  opciones,
});

const destinoBase = { estadoProvincia: "Chiriquí", distritoCiudad: "David" };

describe("resolverEntregaIA", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-pa", nombre: "Panama" }]);
    estadoProvinciaFindManyMock.mockReset().mockResolvedValue([{ id: "ep-chiriqui", nombre: "Chiriquí Province" }]);
    configuracionEmpresaFindUniqueMock
      .mockReset()
      .mockResolvedValue({ modoGeografico: "UN_SOLO_PAIS", paisOperacionId: "pais-pa" });
    obtenerOpcionesEnvioConConfianzaMock.mockReset();
  });

  it("una sola opción de alta confianza: persiste el snapshot completo y el precio al cliente", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([opcion()]));

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.confirmado).toBe(true);
    expect(r.costoEnvio).toBe(8.5);
    expect(r.datos).toMatchObject({
      metodoEntrega: "COURIER_EXTERNO",
      transportistaId: "transp-1",
      servicioTransportistaId: "serv-1",
      tarifaTransportistaZonaId: "tarifa-1",
      zonaEntregaId: "zona-1",
      costoInternoEnvio: 5,
      costoEnvioConfirmado: true,
      zonaAsignadaManualmente: false,
      estadoEntrega: "PENDIENTE",
    });
  });

  it("resuelve los FK de geografía tolerando el sufijo administrativo del catálogo", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([opcion()]));

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.datos.paisId).toBe("pais-pa");
    expect(r.datos.estadoProvinciaId).toBe("ep-chiriqui");
    expect(r.datos.ciudad).toBe("David");
  });

  it("el método de entrega sale del transportista elegido, no de lo que supuso el modelo", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(
      resultado([opcion({ transportistaTipo: "MENSAJERO_PROPIO" })]),
    );

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.datos.metodoEntrega).toBe("MENSAJERO_PROPIO");
  });

  it("el nombre del transportista desambigua cuando más de uno cubre el destino", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(
      resultado([opcion(), opcion({ tarifaId: "tarifa-2", transportistaId: "transp-2", transportistaNombre: "Dos Cargo" })]),
    );

    const r = await resolverEntregaIA("instancia-1", { ...destinoBase, transportista: "dos cargo" });

    expect(r.confirmado).toBe(true);
    expect(r.datos.transportistaId).toBe("transp-2");
  });

  it("sin nombre y con varios transportistas: queda por confirmar, nunca elige uno", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(
      resultado([opcion(), opcion({ tarifaId: "tarifa-2", transportistaId: "transp-2", transportistaNombre: "Dos Cargo" })]),
    );

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.confirmado).toBe(false);
    expect(r.costoEnvio).toBe(0);
    expect(r.datos.transportistaId).toBeNull();
    expect(r.datos.tarifaTransportistaZonaId).toBeNull();
    expect(r.datos.costoEnvioConfirmado).toBe(false);
    // El destino sí se conserva — es lo que el humano necesita para completarla.
    expect(r.datos.estadoProvinciaId).toBe("ep-chiriqui");
  });

  it("confianza PROBABLE no alcanza para fijar tarifa", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([opcion({ confianza: "PROBABLE" })]));

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.confirmado).toBe(false);
    expect(r.datos.tarifaTransportistaZonaId).toBeNull();
  });

  it("confianza ALIAS sí alcanza", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([opcion({ confianza: "ALIAS" })]));

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.confirmado).toBe(true);
    expect(r.datos.tarifaTransportistaZonaId).toBe("tarifa-1");
  });

  it("sin transportistas para el destino: entrega por confirmar, no error", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([]));

    const r = await resolverEntregaIA("instancia-1", destinoBase);

    expect(r.confirmado).toBe(false);
    expect(r.motivoSinConfirmar).toContain("No hay transportistas configurados");
  });

  it("RETIRO_TIENDA no consulta transportistas y queda confirmado con costo 0", async () => {
    const r = await resolverEntregaIA("instancia-1", { metodoEntrega: "RETIRO_TIENDA" });

    expect(obtenerOpcionesEnvioConConfianzaMock).not.toHaveBeenCalled();
    expect(r.confirmado).toBe(true);
    expect(r.costoEnvio).toBe(0);
    expect(r.datos.metodoEntrega).toBe("RETIRO_TIENDA");
    expect(r.datos.costoEnvioConfirmado).toBe(true);
  });
});

describe("sinDatosDeEntrega", () => {
  it("sin bloque entrega o con un bloque vacío no se crea ninguna fila", () => {
    expect(sinDatosDeEntrega(undefined)).toBe(true);
    expect(sinDatosDeEntrega({})).toBe(true);
    expect(sinDatosDeEntrega({ observaciones: "dejar en portería" })).toBe(true);
  });

  it("alcanza con destino, método o transportista para que haya entrega", () => {
    expect(sinDatosDeEntrega({ estadoProvincia: "Chiriquí" })).toBe(false);
    expect(sinDatosDeEntrega({ metodoEntrega: "RETIRO_TIENDA" })).toBe(false);
    expect(sinDatosDeEntrega({ transportista: "Uno Express" })).toBe(false);
  });
});

describe("describirEntrega", () => {
  beforeEach(() => {
    paisFindManyMock.mockReset().mockResolvedValue([{ id: "pais-pa", nombre: "Panama" }]);
    estadoProvinciaFindManyMock.mockReset().mockResolvedValue([]);
    configuracionEmpresaFindUniqueMock
      .mockReset()
      .mockResolvedValue({ modoGeografico: "UN_SOLO_PAIS", paisOperacionId: "pais-pa" });
    obtenerOpcionesEnvioConConfianzaMock.mockReset();
  });

  it("nunca expone costo interno ni IDs internos al modelo", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([opcion()]));
    const r = await resolverEntregaIA("instancia-1", destinoBase);

    const descripcion = JSON.stringify(describirEntrega(r, "PAB"));

    expect(descripcion).toContain("Uno Express");
    expect(descripcion).not.toContain("transp-1");
    expect(descripcion).not.toContain("tarifa-1");
    expect(descripcion).not.toContain("costoInterno");
  });

  it("cuando queda por confirmar, instruye explícitamente a no dar un costo al cliente", async () => {
    obtenerOpcionesEnvioConConfianzaMock.mockResolvedValue(resultado([]));
    const r = await resolverEntregaIA("instancia-1", destinoBase);

    const { avisoEntrega } = describirEntrega(r, "PAB") as { avisoEntrega: string };

    expect(avisoEntrega).toContain("no informes un costo de envío al cliente");
  });
});

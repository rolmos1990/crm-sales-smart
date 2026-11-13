import { describe, expect, it, vi, beforeEach } from "vitest";
import type { EntregaResueltaIA } from "@/ai/tools/shared/resolver-entrega-ia";

// El criterio de resolución (qué transportista, con qué confianza) ya está
// cubierto en resolver-entrega-ia.test.ts. Acá se verifica el otro lado: que
// crear_cotizacion y crear_pedido persistan esa resolución y sumen el envío
// al total — y que sin bloque `entrega` nada cambie respecto del
// comportamiento que tenían antes.

const cotizacionFindFirstMock = vi.fn();
const cotizacionCreateMock = vi.fn();
const pedidoFindFirstMock = vi.fn();
const pedidoCreateMock = vi.fn();
const agenteIAConfigFindUniqueMock = vi.fn();
const resolverEntregaIAMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    cotizacion: {
      findFirst: (...a: unknown[]) => cotizacionFindFirstMock(...a),
      create: (...a: unknown[]) => cotizacionCreateMock(...a),
    },
    pedido: {
      findFirst: (...a: unknown[]) => pedidoFindFirstMock(...a),
      create: (...a: unknown[]) => pedidoCreateMock(...a),
    },
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
  },
}));
vi.mock("@/configuracion/empresa/queries", () => ({
  obtenerMonedaPrincipal: vi.fn().mockResolvedValue("PEN"),
}));
vi.mock("@/ai/tools/shared/resolver-entrega-ia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/tools/shared/resolver-entrega-ia")>()),
  resolverEntregaIA: (...a: unknown[]) => resolverEntregaIAMock(...a),
}));

await import("./crear-cotizacion.tool");
await import("./crear-pedido.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const lineas = [{ descripcion: "Producto X", cantidad: 1, precioUnitario: 100 }];
const ctxBase = { instanciaId: "instancia-1", conversacionId: "c1", contactoId: "contacto-1", herramientasPermitidas: [] };
const entregaArgs = { estadoProvincia: "Chiriquí", distritoCiudad: "David", transportista: "Uno Express" };

const ENTREGA_RESUELTA: EntregaResueltaIA = {
  datos: {
    metodoEntrega: "COURIER_EXTERNO",
    estadoEntrega: "PENDIENTE",
    transportistaId: "transp-1",
    nombreDestinatario: null,
    observaciones: null,
    paisId: "pais-pa",
    estadoProvinciaId: "ep-chiriqui",
    ciudad: "David",
    corregimiento: null,
    sectorOCodigoPostal: null,
    zonaEntregaId: "zona-1",
    zonaAsignadaManualmente: false,
    servicioTransportistaId: "serv-1",
    tarifaTransportistaZonaId: "tarifa-1",
    costoInternoEnvio: 5,
    costoEnvioConfirmado: true,
  },
  costoEnvio: 8.5,
  confirmado: true,
  transportistaNombre: "Uno Express",
  servicioNombre: "Estándar",
  motivoSinConfirmar: null,
};

beforeEach(() => {
  cotizacionFindFirstMock.mockReset().mockResolvedValue(null);
  cotizacionCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "cot-1", numero: "00001", ...data }),
  );
  pedidoFindFirstMock.mockReset().mockResolvedValue(null);
  pedidoCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "ped-1", numero: "00001", ...data }),
  );
  agenteIAConfigFindUniqueMock.mockReset();
  resolverEntregaIAMock.mockReset().mockResolvedValue(ENTREGA_RESUELTA);
});

describe.each([
  { tool: "crear_cotizacion", createMock: () => cotizacionCreateMock },
  { tool: "crear_pedido", createMock: () => pedidoCreateMock },
])("$tool — bloque de entrega", ({ tool, createMock }) => {
  it("persiste la entrega resuelta y suma el envío al total", async () => {
    const resultado = await registroHerramientas.get(tool)!.execute({ lineas, entrega: entregaArgs }, ctxBase);

    const data = createMock().mock.calls[0][0].data;
    expect(data.entrega).toEqual({ create: ENTREGA_RESUELTA.datos });
    expect(data.costoEnvio).toBe(8.5);
    // 100 + 18% + 8.50
    expect(data.total).toBeCloseTo(126.5, 2);
    expect((resultado.data as { entrega: { transportista: string } }).entrega.transportista).toBe("Uno Express");
  });

  it("sin bloque entrega: ninguna fila de entrega y costo de envío 0 (comportamiento previo)", async () => {
    await registroHerramientas.get(tool)!.execute({ lineas }, ctxBase);

    const data = createMock().mock.calls[0][0].data;
    expect(resolverEntregaIAMock).not.toHaveBeenCalled();
    expect(data.entrega).toBeUndefined();
    expect(data.costoEnvio).toBe(0);
    expect(data.total).toBeCloseTo(118, 2);
  });

  it("entrega sin resolver: se guarda el destino con el costo por confirmar y se avisa al agente", async () => {
    resolverEntregaIAMock.mockResolvedValue({
      ...ENTREGA_RESUELTA,
      datos: { ...ENTREGA_RESUELTA.datos, transportistaId: null, tarifaTransportistaZonaId: null, costoEnvioConfirmado: false },
      costoEnvio: 0,
      confirmado: false,
      transportistaNombre: null,
      servicioNombre: null,
      motivoSinConfirmar: "No hay transportistas configurados para ese destino",
    } satisfies EntregaResueltaIA);

    const resultado = await registroHerramientas.get(tool)!.execute({ lineas, entrega: entregaArgs }, ctxBase);

    const data = createMock().mock.calls[0][0].data;
    expect(data.entrega.create.estadoProvinciaId).toBe("ep-chiriqui");
    expect(data.entrega.create.costoEnvioConfirmado).toBe(false);
    expect(data.costoEnvio).toBe(0);
    expect((resultado.data as { avisoEntrega: string }).avisoEntrega).toContain("por confirmar");
  });

  it("en modo simulación calcula el envío sin tocar Prisma (018)", async () => {
    const resultado = await registroHerramientas
      .get(tool)!
      .execute({ lineas, entrega: entregaArgs }, { ...ctxBase, modoSimulacion: true });

    expect(createMock()).not.toHaveBeenCalled();
    const data = resultado.data as { costoEnvio: number; total: number; previsualizado: boolean };
    expect(data.previsualizado).toBe(true);
    expect(data.costoEnvio).toBe(8.5);
    expect(data.total).toBeCloseTo(126.5, 2);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const agenteIAConfigFindUniqueMock = vi.fn();
const cotizacionFindFirstMock = vi.fn();
const cotizacionCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
    cotizacion: {
      findFirst: (...a: unknown[]) => cotizacionFindFirstMock(...a),
      create: (...a: unknown[]) => cotizacionCreateMock(...a),
    },
  },
}));
vi.mock("@/configuracion/empresa/queries", () => ({
  obtenerMonedaPrincipal: vi.fn().mockResolvedValue("PEN"),
}));

await import("./crear-cotizacion.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const argsBase = { lineas: [{ descripcion: "Producto X", cantidad: 1, precioUnitario: 100 }] };
const ctxBase = { instanciaId: "instancia-1", conversacionId: "c1", contactoId: "contacto-1", herramientasPermitidas: ["crear_cotizacion"] };

describe("crear_cotizacion — queda siempre pendiente de confirmación humana", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset();
    cotizacionFindFirstMock.mockReset().mockResolvedValue(null);
    cotizacionCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "cot-1", numero: "00001", ...data }),
    );
  });

  it("sin agenteId: confirmadoPorHumano=false y mensaje de pendiente", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const resultado = await tool.execute(argsBase, ctxBase);
    expect(cotizacionCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: false });
    expect((resultado.data as { pendienteConfirmacion: boolean }).pendienteConfirmacion).toBe(true);
    expect((resultado.data as { mensaje: string }).mensaje).toContain("sujeta a confirmación");
  });

  it("con agenteId: no consulta accionesComercialesModoBorrador — el modo ya no distingue cotizaciones", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;
    await tool.execute(argsBase, { ...ctxBase, agenteId: "agente-1" });
    expect(agenteIAConfigFindUniqueMock).not.toHaveBeenCalled();
    expect(cotizacionCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: false });
  });

  it("el mensaje usa la moneda de la empresa, no un símbolo fijo", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const resultado = await tool.execute(argsBase, ctxBase);
    const mensaje = (resultado.data as { mensaje: string }).mensaje;
    expect(mensaje).toContain("PEN 118.00");
    expect(mensaje).not.toContain("S/");
  });
});

// Antes la tool numeraba por su cuenta y, peor, filtraba
// `NOT: { numero: { contains: "-" } }`: eso arrancaba una serie paralela
// ("00001") separada de las COT-<anio>-<consecutivo> que crea un usuario.
describe("crear_cotizacion — numeracion", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset();
    cotizacionFindFirstMock.mockReset().mockResolvedValue(null);
    cotizacionCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "cot-1", ...data }),
    );
  });

  it("usa el mismo formato COT-<anio>-<consecutivo> que crearCotizacion", async () => {
    cotizacionFindFirstMock.mockResolvedValue({ numero: `COT-${new Date().getFullYear()}-0166` });
    const tool = registroHerramientas.get("crear_cotizacion")!;

    const resultado = await tool.execute(argsBase, ctxBase);

    const numero = cotizacionCreateMock.mock.calls[0][0].data.numero as string;
    expect(numero).toBe(`COT-${new Date().getFullYear()}-0167`);
    expect((resultado.data as { numero: string }).numero).toBe(numero);
  });

  it("continua la serie compartida: no excluye los numeros con guion", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;

    await tool.execute(argsBase, ctxBase);

    expect(cotizacionFindFirstMock.mock.calls[0][0].where).toEqual({ instanciaId: "instancia-1" });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

const agenteIAConfigFindUniqueMock = vi.fn();
const cotizacionCountMock = vi.fn();
const cotizacionCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
    cotizacion: {
      count: (...a: unknown[]) => cotizacionCountMock(...a),
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

describe("crear_cotizacion — modo de confirmación (015, Historia 3, SC-003)", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset();
    cotizacionCountMock.mockReset().mockResolvedValue(0);
    cotizacionCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "cot-1", numero: "00001", ...data }),
    );
  });

  it("sin agenteId (comportamiento actual, sin modo configurado): confirmadoPorHumano=true, sin mensaje de pendiente", async () => {
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const resultado = await tool.execute(argsBase, ctxBase);
    expect(agenteIAConfigFindUniqueMock).not.toHaveBeenCalled();
    expect(cotizacionCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: true });
    expect((resultado.data as { pendienteConfirmacion: boolean }).pendienteConfirmacion).toBe(false);
  });

  it("con accionesComercialesModoBorrador=false (default explícito): idéntico al comportamiento actual", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue({ accionesComercialesModoBorrador: false });
    const tool = registroHerramientas.get("crear_cotizacion")!;
    await tool.execute(argsBase, { ...ctxBase, agenteId: "agente-1" });
    expect(cotizacionCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: true });
  });

  it("con accionesComercialesModoBorrador=true: confirmadoPorHumano=false, mensaje de pendiente", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue({ accionesComercialesModoBorrador: true });
    const tool = registroHerramientas.get("crear_cotizacion")!;
    const resultado = await tool.execute(argsBase, { ...ctxBase, agenteId: "agente-1" });
    expect(cotizacionCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: false });
    expect((resultado.data as { pendienteConfirmacion: boolean }).pendienteConfirmacion).toBe(true);
    expect((resultado.data as { mensaje: string }).mensaje).toContain("sujeta a confirmación");
  });
});

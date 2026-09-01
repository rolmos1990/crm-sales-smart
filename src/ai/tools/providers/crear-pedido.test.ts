import { describe, expect, it, vi, beforeEach } from "vitest";

const agenteIAConfigFindUniqueMock = vi.fn();
const pedidoCountMock = vi.fn();
const pedidoCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
    pedido: {
      count: (...a: unknown[]) => pedidoCountMock(...a),
      create: (...a: unknown[]) => pedidoCreateMock(...a),
    },
  },
}));
vi.mock("@/configuracion/empresa/queries", () => ({
  obtenerMonedaPrincipal: vi.fn().mockResolvedValue("PEN"),
}));

await import("./crear-pedido.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const argsBase = { lineas: [{ descripcion: "Producto X", cantidad: 1, precioUnitario: 100 }] };
const ctxBase = { instanciaId: "instancia-1", conversacionId: "c1", contactoId: "contacto-1", herramientasPermitidas: ["crear_pedido"] };

describe("crear_pedido — modo de confirmación (015, Historia 3, SC-003)", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset();
    pedidoCountMock.mockReset().mockResolvedValue(0);
    pedidoCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "ped-1", numero: "00001", ...data }),
    );
  });

  it("sin modo configurado: comportamiento idéntico al actual", async () => {
    const tool = registroHerramientas.get("crear_pedido")!;
    const resultado = await tool.execute(argsBase, ctxBase);
    expect(pedidoCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: true });
    expect((resultado.data as { pendienteConfirmacion: boolean }).pendienteConfirmacion).toBe(false);
  });

  it("con accionesComercialesModoBorrador=true: pendiente de confirmación", async () => {
    agenteIAConfigFindUniqueMock.mockResolvedValue({ accionesComercialesModoBorrador: true });
    const tool = registroHerramientas.get("crear_pedido")!;
    const resultado = await tool.execute(argsBase, { ...ctxBase, agenteId: "agente-1" });
    expect(pedidoCreateMock.mock.calls[0][0].data).toMatchObject({ generadoPorIA: true, confirmadoPorHumano: false });
    expect((resultado.data as { pendienteConfirmacion: boolean }).pendienteConfirmacion).toBe(true);
  });
});

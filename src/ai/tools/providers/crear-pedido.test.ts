import { describe, expect, it, vi, beforeEach } from "vitest";

const agenteIAConfigFindUniqueMock = vi.fn();
const pedidoFindFirstMock = vi.fn();
const pedidoCreateMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    agenteIAConfig: { findUnique: (...a: unknown[]) => agenteIAConfigFindUniqueMock(...a) },
    pedido: {
      findFirst: (...a: unknown[]) => pedidoFindFirstMock(...a),
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
    pedidoFindFirstMock.mockReset().mockResolvedValue(null);
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

// Antes cada tool numeraba por su cuenta (`count + 1`, sin prefijo ni anio), asi
// que un pedido del agente salia "00244" en vez de PED-<anio>-0244: otra serie,
// y con `count` un numero ya emitido se podia reutilizar al borrar.
describe("crear_pedido — numeracion", () => {
  beforeEach(() => {
    agenteIAConfigFindUniqueMock.mockReset();
    pedidoFindFirstMock.mockReset().mockResolvedValue(null);
    pedidoCreateMock.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "ped-1", ...data }),
    );
  });

  it("usa el mismo formato PED-<anio>-<consecutivo> que crearPedido", async () => {
    pedidoFindFirstMock.mockResolvedValue({ numero: `PED-${new Date().getFullYear()}-0243` });
    const tool = registroHerramientas.get("crear_pedido")!;

    const resultado = await tool.execute(argsBase, ctxBase);

    const numero = pedidoCreateMock.mock.calls[0][0].data.numero as string;
    expect(numero).toBe(`PED-${new Date().getFullYear()}-0244`);
    expect((resultado.data as { numero: string }).numero).toBe(numero);
  });

  it("continua la serie compartida, no una propia: lee el ultimo numero sin filtrar por formato", async () => {
    const tool = registroHerramientas.get("crear_pedido")!;

    await tool.execute(argsBase, ctxBase);

    // El filtro `NOT: { numero: { contains: "-" } }` que tenia la tool vieja
    // arrancaba una serie paralela desde cero.
    expect(pedidoFindFirstMock.mock.calls[0][0].where).toEqual({ instanciaId: "instancia-1" });
  });

  it("el primer pedido de la instancia arranca en 0001, no en 00001", async () => {
    const tool = registroHerramientas.get("crear_pedido")!;

    await tool.execute(argsBase, ctxBase);

    expect(pedidoCreateMock.mock.calls[0][0].data.numero).toBe(`PED-${new Date().getFullYear()}-0001`);
  });
});

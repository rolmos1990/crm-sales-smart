import { describe, expect, it, vi, beforeEach } from "vitest";

const metodoFindFirstMock = vi.fn();
const zonaMetodoFindFirstMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    metodoEntregaConfig: { findFirst: (...a: unknown[]) => metodoFindFirstMock(...a) },
    zonaCoberturaMetodo: { findFirst: (...a: unknown[]) => zonaMetodoFindFirstMock(...a) },
  },
}));

await import("./calcular-costo-envio.tool");
const { registroHerramientas } = await import("@/ai/tools/registry");

const ctx = { instanciaId: "instancia-1", conversacionId: "c1", herramientasPermitidas: ["calcular_costo_envio"] };

describe("calcular_costo_envio (015, Historia 2)", () => {
  beforeEach(() => {
    metodoFindFirstMock.mockReset();
    zonaMetodoFindFirstMock.mockReset();
  });

  it("zona cubierta: suma costoBase + costoAdicional", async () => {
    metodoFindFirstMock.mockResolvedValue({ id: "m1", costoBase: 10 });
    zonaMetodoFindFirstMock.mockResolvedValue({ cubierta: true, costoAdicional: 5 });
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ metodoEntrega: "COURIER_EXTERNO", zona: "Lima" }, ctx);
    expect(resultado.data).toEqual({ costo: 15, cubierto: true });
  });

  it("zona no configurada para ese método: cubierto=false", async () => {
    metodoFindFirstMock.mockResolvedValue({ id: "m1", costoBase: 10 });
    zonaMetodoFindFirstMock.mockResolvedValue(null);
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ metodoEntrega: "COURIER_EXTERNO", zona: "Provincia" }, ctx);
    expect((resultado.data as { cubierto: boolean }).cubierto).toBe(false);
  });

  it("método de entrega no configurado en absoluto: cubierto=false, sin error", async () => {
    metodoFindFirstMock.mockResolvedValue(null);
    const tool = registroHerramientas.get("calcular_costo_envio")!;
    const resultado = await tool.execute({ metodoEntrega: "DIGITAL", zona: "Lima" }, ctx);
    expect(resultado.ok).toBe(true);
    expect((resultado.data as { cubierto: boolean }).cubierto).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { registroHerramientas } from "@/ai/tools/registry";
import type { ContextoTool } from "@/ai/tools/types";

const buscarMock = vi.fn();

vi.mock("@/ai/documentacion/busqueda", () => ({
  buscarEnDocumentacion: (...args: unknown[]) => buscarMock(...args),
}));

// Importar el provider lo registra como efecto lateral.
import "./buscar-en-documentacion.tool";

const tool = registroHerramientas.get("buscar_en_documentacion")!;

const ctx: ContextoTool = {
  instanciaId: "clzInstanciaReal000",
  agenteId: "clzAgenteReal000000",
  conversacionId: "conv-1",
  herramientasPermitidas: ["buscar_en_documentacion"],
};

beforeEach(() => {
  vi.clearAllMocks();
  buscarMock.mockResolvedValue({ encontrado: true, respuesta: "3 a 5 días", fuentes: ["envios.pdf"] });
});

describe("buscar_en_documentacion", () => {
  it("usa el instanciaId del contexto y NO el que inyecte el modelo", async () => {
    await tool.execute(
      { consulta: "envíos", instanciaId: "clzInstanciaAjena00", agenteId: "clzAgenteAjeno0000" },
      ctx,
    );

    expect(buscarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanciaId: "clzInstanciaReal000",
        agenteId: "clzAgenteReal000000",
        consulta: "envíos",
      }),
    );
  });

  it("pasa la conversación para que el consumo quede trazable", async () => {
    await tool.execute({ consulta: "envíos" }, ctx);
    expect(buscarMock.mock.calls[0][0].conversacionId).toBe("conv-1");
  });

  it("rechaza argumentos inválidos sin llamar a la búsqueda", async () => {
    expect(await tool.execute({ consulta: "" }, ctx)).toEqual({
      ok: false,
      error: "Argumentos inválidos para buscar_en_documentacion",
    });
    expect(await tool.execute({}, ctx)).toMatchObject({ ok: false });
    expect(buscarMock).not.toHaveBeenCalled();
  });

  it("sin agente en el contexto no busca: en un índice compartido no hay 'buscar en todo'", async () => {
    const resultado = await tool.execute({ consulta: "envíos" }, { ...ctx, agenteId: undefined });

    expect(resultado.ok).toBe(false);
    expect(buscarMock).not.toHaveBeenCalled();
  });

  it("devuelve la respuesta y las fuentes cuando encuentra", async () => {
    expect(await tool.execute({ consulta: "envíos" }, ctx)).toEqual({
      ok: true,
      data: { encontrado: true, respuesta: "3 a 5 días", fuentes: ["envios.pdf"] },
    });
  });

  it("un 'no encontré' es ok:true con encontrado:false, no un error", async () => {
    // Devolverlo como error haría que el modelo reintente o se disculpe por
    // una falla que no existió. "No hay nada sobre eso" es una respuesta útil.
    buscarMock.mockResolvedValue({ encontrado: false, motivo: "SIN_COINCIDENCIAS" });

    const resultado = await tool.execute({ consulta: "sucursal en Japón" }, ctx);

    expect(resultado.ok).toBe(true);
    expect(resultado.data).toMatchObject({ encontrado: false });
  });

  it("un fallo del proveedor también llega como 'no encontré', sin romper el turno", async () => {
    buscarMock.mockResolvedValue({ encontrado: false, motivo: "ERROR_PROVEEDOR" });

    const resultado = await tool.execute({ consulta: "envíos" }, ctx);

    expect(resultado.ok).toBe(true);
    expect(resultado.data).toMatchObject({ encontrado: false });
  });

  it("la descripción le dice al modelo para qué NO sirve", async () => {
    // Sin esto el modelo la usaría para precios y stock, gastando una llamada
    // por mensaje y respondiendo con un PDF en vez del dato vivo de Karia.
    expect(tool.definition.description).toMatch(/precios/i);
    expect(tool.definition.description).toMatch(/stock/i);
  });
});

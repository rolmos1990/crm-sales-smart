import { describe, expect, it, vi } from "vitest";
import { ejecutarBackfill } from "./backfill-instrucciones-agente";

function prismaFalso(pendientes: Record<string, unknown>[]) {
  const updates: { id: string; instruccionesAgente: string }[] = [];
  return {
    updates,
    cliente: {
      agenteIAConfig: {
        findMany: vi.fn().mockResolvedValue(pendientes),
        update: vi.fn().mockImplementation(({ where, data }) => {
          updates.push({ id: where.id, instruccionesAgente: data.instruccionesAgente });
          return Promise.resolve({});
        }),
      },
    },
  };
}

describe("backfill de instrucciones del agente", () => {
  it("migra lo que el agente ya tenía configurado", async () => {
    const { cliente, updates } = prismaFalso([
      {
        id: "a1",
        objetivo: "la venta de hosting",
        intensidadComercial: "SUAVE",
        frasesProhibidas: ["no es mi problema"],
        condicionesTransferenciaHumano: ["el cliente pide una persona"],
        usuario: { nombre: "Sofía" },
      },
    ]);

    const r = await ejecutarBackfill(cliente);

    expect(r).toEqual({ migrados: 1, sinContenido: 0, total: 1 });
    expect(updates).toHaveLength(1);
    const texto = updates[0].instruccionesAgente;
    expect(texto).toContain("la venta de hosting");
    expect(texto).toContain("intensidad comercial suave");
    expect(texto).toContain("no es mi problema");
    expect(texto).toContain("el cliente pide una persona");
  });

  it("solo busca agentes sin instrucciones", async () => {
    const { cliente } = prismaFalso([]);
    await ejecutarBackfill(cliente);
    expect(cliente.agenteIAConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instruccionesAgente: null } }),
    );
  });

  it("un agente sin nada configurado igual recibe su rol por defecto", async () => {
    const { cliente, updates } = prismaFalso([{ id: "a2", usuario: { nombre: "Bot" } }]);

    const r = await ejecutarBackfill(cliente);

    expect(r.migrados).toBe(1);
    expect(updates[0].instruccionesAgente).toContain("Eres un asistente comercial");
  });
});

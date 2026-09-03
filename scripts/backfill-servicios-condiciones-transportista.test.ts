import { describe, expect, it, vi, beforeEach } from "vitest";
import { ejecutarBackfill } from "./backfill-servicios-condiciones-transportista";

describe("ejecutarBackfill (backfill servicios/condiciones legacy)", () => {
  const transportistaFindManyMock = vi.fn();
  const servicioCreateManyMock = vi.fn();
  const condicionesCreateMock = vi.fn();

  const prismaMock = {
    transportista: { findMany: (...a: unknown[]) => transportistaFindManyMock(...a) },
    servicioTransportista: { createMany: (...a: unknown[]) => servicioCreateManyMock(...a) },
    condicionesTransportista: { create: (...a: unknown[]) => condicionesCreateMock(...a) },
  };

  beforeEach(() => {
    transportistaFindManyMock.mockReset();
    servicioCreateManyMock.mockReset();
    condicionesCreateMock.mockReset();
  });

  it("siembra servicios y condiciones para un transportista sin ninguno de los dos", async () => {
    transportistaFindManyMock.mockResolvedValue([
      { id: "t1", nombre: "Legacy Courier", _count: { servicios: 0 }, condiciones: null },
    ]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(servicioCreateManyMock).toHaveBeenCalledWith({
      data: [
        { transportistaId: "t1", nombre: "Estándar" },
        { transportistaId: "t1", nombre: "Express" },
        { transportistaId: "t1", nombre: "Personalizado" },
      ],
    });
    expect(condicionesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transportistaId: "t1", diasEntrega: expect.any(Array) }) }),
    );
    expect(resultado).toEqual({ serviciosSembrados: 1, condicionesSembradas: 1 });
  });

  it("no toca un transportista que ya tiene servicios y condiciones (idempotente)", async () => {
    transportistaFindManyMock.mockResolvedValue([
      { id: "t2", nombre: "Ya completo", _count: { servicios: 3 }, condiciones: { id: "c1" } },
    ]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(servicioCreateManyMock).not.toHaveBeenCalled();
    expect(condicionesCreateMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ serviciosSembrados: 0, condicionesSembradas: 0 });
  });

  it("siembra solo lo que falta cuando un transportista tiene servicios pero no condiciones", async () => {
    transportistaFindManyMock.mockResolvedValue([
      { id: "t3", nombre: "Parcial", _count: { servicios: 3 }, condiciones: null },
    ]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(servicioCreateManyMock).not.toHaveBeenCalled();
    expect(condicionesCreateMock).toHaveBeenCalled();
    expect(resultado).toEqual({ serviciosSembrados: 0, condicionesSembradas: 1 });
  });
});

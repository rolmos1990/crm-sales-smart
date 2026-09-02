import { describe, expect, it, vi, beforeEach } from "vitest";
import { calcularPaisInferido, ejecutarBackfill, listarPaisesDeZonasUsadas } from "./backfill-pais-transportista";

describe("calcularPaisInferido (023 — backfill)", () => {
  it("infiere el único país cuando hay exactamente uno", () => {
    expect(calcularPaisInferido(["pais-pa"])).toBe("pais-pa");
  });

  it("no infiere nada cuando hay más de un país distinto", () => {
    expect(calcularPaisInferido(["pais-pa", "pais-co"])).toBeNull();
  });

  it("no infiere nada cuando no hay ningún país (sin tarifas configuradas)", () => {
    expect(calcularPaisInferido([])).toBeNull();
  });
});

describe("ejecutarBackfill (023 — backfill)", () => {
  const transportistaFindManyMock = vi.fn();
  const transportistaUpdateMock = vi.fn();
  const ubicacionFindManyMock = vi.fn();

  const prismaMock = {
    transportista: {
      findMany: (...a: unknown[]) => transportistaFindManyMock(...a),
      update: (...a: unknown[]) => transportistaUpdateMock(...a),
    },
    zonaEntregaUbicacion: {
      findMany: (...a: unknown[]) => ubicacionFindManyMock(...a),
    },
  };

  beforeEach(() => {
    transportistaFindManyMock.mockReset();
    transportistaUpdateMock.mockReset();
    ubicacionFindManyMock.mockReset();
  });

  it("solo consulta transportistas con paisId null", async () => {
    transportistaFindManyMock.mockResolvedValue([]);
    await ejecutarBackfill(prismaMock);
    expect(transportistaFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paisId: null } })
    );
  });

  it("asigna el país cuando todas sus tarifas usan zonas del mismo país", async () => {
    transportistaFindManyMock.mockResolvedValue([{ id: "t1", nombre: "UnoExpress" }]);
    ubicacionFindManyMock.mockResolvedValue([{ paisId: "pais-pa" }]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(transportistaUpdateMock).toHaveBeenCalledWith({ where: { id: "t1" }, data: { paisId: "pais-pa" } });
    expect(resultado).toEqual({ asignados: 1, pendientes: 0 });
  });

  it("deja pendiente (sin update) cuando hay tarifas de países distintos", async () => {
    transportistaFindManyMock.mockResolvedValue([{ id: "t2", nombre: "Mixto Courier" }]);
    ubicacionFindManyMock.mockResolvedValue([{ paisId: "pais-pa" }, { paisId: "pais-co" }]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(transportistaUpdateMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ asignados: 0, pendientes: 1 });
  });

  it("deja pendiente cuando el transportista no tiene ninguna tarifa configurada", async () => {
    transportistaFindManyMock.mockResolvedValue([{ id: "t3", nombre: "Sin uso" }]);
    ubicacionFindManyMock.mockResolvedValue([]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(transportistaUpdateMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ asignados: 0, pendientes: 1 });
  });

  it("es idempotente: un transportista ya asignado no vuelve a consultarse (paisId no es null)", async () => {
    // ejecutarBackfill ya filtra por paisId: null en la query — este test
    // confirma que un transportista sin filas devueltas (ya asignado) no
    // dispara ningún update.
    transportistaFindManyMock.mockResolvedValue([]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(listarPaisesDeZonasUsadas).toBeDefined();
    expect(transportistaUpdateMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ asignados: 0, pendientes: 0 });
  });
});

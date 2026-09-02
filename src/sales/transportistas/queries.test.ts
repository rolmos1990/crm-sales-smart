import { describe, expect, it, vi, beforeEach } from "vitest";

const transportistaFindManyMock = vi.fn();
const transportistaFindFirstMock = vi.fn();
const tarifaCountMock = vi.fn();
const tarifaGroupByMock = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    transportista: {
      findMany: (...a: unknown[]) => transportistaFindManyMock(...a),
      findFirst: (...a: unknown[]) => transportistaFindFirstMock(...a),
    },
    tarifaTransportistaZona: {
      count: (...a: unknown[]) => tarifaCountMock(...a),
      groupBy: (...a: unknown[]) => tarifaGroupByMock(...a),
    },
  },
}));

const { obtenerTransportista, obtenerTransportistas } = await import("./queries");

const PANAMA = { id: "pais-pa", codigo: "PA", nombre: "Panama", banderaEmoji: "🇵🇦" };

describe("transportistas/queries (023 — país)", () => {
  beforeEach(() => {
    transportistaFindManyMock.mockReset();
    transportistaFindFirstMock.mockReset();
    tarifaCountMock.mockReset().mockResolvedValue(0);
    tarifaGroupByMock.mockReset().mockResolvedValue([]);
  });

  describe("obtenerTransportistas", () => {
    it("incluye el país y lo devuelve null cuando el transportista no tiene uno asignado", async () => {
      transportistaFindManyMock.mockResolvedValue([
        { id: "t1", nombre: "UnoExpress", paisId: null, pais: null, _count: { tarifas: 0 } },
      ]);

      const [resultado] = await obtenerTransportistas("instancia-1");

      expect(transportistaFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ pais: true }) })
      );
      expect(resultado.pais).toBeNull();
    });

    it("marca tienePaisBloqueado = true cuando el transportista tiene al menos una tarifa (activa o no)", async () => {
      transportistaFindManyMock.mockResolvedValue([
        { id: "t1", nombre: "UnoExpress", paisId: "pais-pa", pais: PANAMA, _count: { tarifas: 0 } },
      ]);
      tarifaGroupByMock.mockResolvedValue([{ transportistaId: "t1", _count: { _all: 2 } }]);

      const [resultado] = await obtenerTransportistas("instancia-1");

      expect(resultado.tienePaisBloqueado).toBe(true);
    });

    it("marca tienePaisBloqueado = false cuando no tiene ninguna tarifa", async () => {
      transportistaFindManyMock.mockResolvedValue([
        { id: "t1", nombre: "UnoExpress", paisId: "pais-pa", pais: PANAMA, _count: { tarifas: 0 } },
      ]);
      tarifaGroupByMock.mockResolvedValue([]);

      const [resultado] = await obtenerTransportistas("instancia-1");

      expect(resultado.tienePaisBloqueado).toBe(false);
    });
  });

  describe("obtenerTransportista", () => {
    it("devuelve el país asignado", async () => {
      transportistaFindFirstMock.mockResolvedValue({
        id: "t1", nombre: "UnoExpress", paisId: "pais-pa", pais: PANAMA,
        condiciones: null, servicios: [], _count: { tarifas: 0 },
      });
      tarifaCountMock.mockResolvedValue(0);

      const resultado = await obtenerTransportista("t1", "instancia-1");

      expect(resultado?.pais).toEqual(PANAMA);
    });

    it("tienePaisBloqueado = true cuando existe al menos una tarifa inactiva (no solo activas)", async () => {
      transportistaFindFirstMock.mockResolvedValue({
        id: "t1", nombre: "UnoExpress", paisId: "pais-pa", pais: PANAMA,
        condiciones: null, servicios: [], _count: { tarifas: 0 }, // zonasActivas = 0
      });
      tarifaCountMock.mockResolvedValue(1); // pero hay 1 tarifa inactiva

      const resultado = await obtenerTransportista("t1", "instancia-1");

      expect(resultado?.zonasActivas).toBe(0);
      expect(resultado?.tienePaisBloqueado).toBe(true);
    });

    it("devuelve null cuando el transportista no existe", async () => {
      transportistaFindFirstMock.mockResolvedValue(null);

      const resultado = await obtenerTransportista("inexistente", "instancia-1");

      expect(resultado).toBeNull();
      expect(tarifaCountMock).not.toHaveBeenCalled();
    });
  });
});

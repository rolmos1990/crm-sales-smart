import { describe, expect, it, vi, beforeEach } from "vitest";
import { calcularCamposNormalizados, ejecutarBackfill } from "./backfill-normalizar-ubicaciones";

describe("calcularCamposNormalizados (024 — backfill)", () => {
  it("une todos los niveles presentes con ' > ' y normaliza", () => {
    const resultado = calcularCamposNormalizados({
      provinciaEstado: "Chiriquí",
      distritoCiudad: "David",
      corregimiento: "San Mateo",
      sectorOCodigoPostal: null,
    });
    expect(resultado.nombreVisible).toBe("Chiriquí > David > San Mateo");
    expect(resultado.nombreNormalizado).toBe("chiriqui-david-san-mateo");
  });

  it("funciona con un único nivel (provincia)", () => {
    const resultado = calcularCamposNormalizados({
      provinciaEstado: "Panamá Oeste",
      distritoCiudad: null,
      corregimiento: null,
      sectorOCodigoPostal: null,
    });
    expect(resultado.nombreVisible).toBe("Panamá Oeste");
    expect(resultado.nombreNormalizado).toBe("panama-oeste");
  });

  it("ignora tildes, mayúsculas y espacios repetidos al normalizar", () => {
    const resultado = calcularCamposNormalizados({
      provinciaEstado: "CHIRIQUÍ   Grande",
      distritoCiudad: null,
      corregimiento: null,
      sectorOCodigoPostal: null,
    });
    expect(resultado.nombreNormalizado).toBe("chiriqui-grande");
  });

  it("produce cadena vacía cuando no hay ningún nivel (caso límite, no debería ocurrir en datos reales)", () => {
    const resultado = calcularCamposNormalizados({
      provinciaEstado: null,
      distritoCiudad: null,
      corregimiento: null,
      sectorOCodigoPostal: null,
    });
    expect(resultado.nombreVisible).toBe("");
    expect(resultado.nombreNormalizado).toBe("");
  });
});

describe("ejecutarBackfill (024 — backfill)", () => {
  const ubicacionFindManyMock = vi.fn();
  const ubicacionUpdateMock = vi.fn();

  const prismaMock = {
    zonaEntregaUbicacion: {
      findMany: (...a: unknown[]) => ubicacionFindManyMock(...a),
      update: (...a: unknown[]) => ubicacionUpdateMock(...a),
    },
  };

  beforeEach(() => {
    ubicacionFindManyMock.mockReset();
    ubicacionUpdateMock.mockReset();
  });

  it("no actualiza nada si no hay ubicaciones", async () => {
    ubicacionFindManyMock.mockResolvedValue([]);
    const resultado = await ejecutarBackfill(prismaMock);
    expect(ubicacionUpdateMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ actualizadas: 0 });
  });

  it("actualiza cada ubicación con sus campos calculados", async () => {
    ubicacionFindManyMock.mockResolvedValue([
      { id: "u1", provinciaEstado: "Chiriquí", distritoCiudad: "David", corregimiento: null, sectorOCodigoPostal: null },
      { id: "u2", provinciaEstado: "Panamá Oeste", distritoCiudad: null, corregimiento: null, sectorOCodigoPostal: null },
    ]);

    const resultado = await ejecutarBackfill(prismaMock);

    expect(ubicacionUpdateMock).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { nombreVisible: "Chiriquí > David", nombreNormalizado: "chiriqui-david" },
    });
    expect(ubicacionUpdateMock).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { nombreVisible: "Panamá Oeste", nombreNormalizado: "panama-oeste" },
    });
    expect(resultado).toEqual({ actualizadas: 2 });
  });
});

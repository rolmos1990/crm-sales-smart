import { describe, expect, it, vi, beforeEach } from "vitest";

const zonaUbicacionFindManyMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: { zonaEntregaUbicacion: { findMany: (...a: unknown[]) => zonaUbicacionFindManyMock(...a) } },
}));

const { resolverUbicacionPorNombre, describirUbicacion } = await import("./resolver-ubicacion-por-nombre");

const ubic = (p: {
  provinciaEstado?: string | null;
  distritoCiudad?: string | null;
  corregimiento?: string | null;
  sectorOCodigoPostal?: string | null;
  aliases?: Array<{ campo: string; valorNormalizado: string }>;
}) => ({
  provinciaEstado: p.provinciaEstado ?? null,
  distritoCiudad: p.distritoCiudad ?? null,
  corregimiento: p.corregimiento ?? null,
  sectorOCodigoPostal: p.sectorOCodigoPostal ?? null,
  aliases: p.aliases ?? [],
});

// El caso real: "Calidonia" es un corregimiento cargado como distritoCiudad
// de una zona cuya provincia es "Panamá Province". El cliente lo nombra solo,
// sin provincia, y todas las rutas de resolución exigían la provincia.
const CALIDONIA = ubic({ provinciaEstado: "Panamá Province", distritoCiudad: "Calidonia" });

beforeEach(() => {
  zonaUbicacionFindManyMock.mockReset().mockResolvedValue([CALIDONIA]);
});

describe("resolverUbicacionPorNombre — el caso que motivó esto", () => {
  it("resuelve un nombre que está cargado como ciudad, devolviendo también su provincia", async () => {
    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Calidonia" });

    expect(r).toEqual({
      estado: "UNICA",
      ubicacion: { estadoProvincia: "Panamá Province", distritoCiudad: "Calidonia", corregimiento: null, sectorOCodigoPostal: null, nivel: "CIUDAD" },
    });
  });

  it("no le importan tildes ni mayúsculas", async () => {
    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "  CALIDONIA  " });
    expect(r.estado).toBe("UNICA");
  });

  it("un nombre que no existe no se fuerza a nada", async () => {
    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Narnia" });
    expect(r).toEqual({ estado: "SIN_COINCIDENCIA" });
  });

  it("un nombre vacío no consulta la base", async () => {
    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "   " });
    expect(r).toEqual({ estado: "SIN_COINCIDENCIA" });
    expect(zonaUbicacionFindManyMock).not.toHaveBeenCalled();
  });
});

describe("resolverUbicacionPorNombre — ambigüedad", () => {
  it("el mismo nombre en dos provincias NO se adivina: queda ambiguo", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      ubic({ provinciaEstado: "Panamá Province", distritoCiudad: "San Francisco" }),
      ubic({ provinciaEstado: "Veraguas Province", distritoCiudad: "San Francisco" }),
    ]);

    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "San Francisco" });

    expect(r.estado).toBe("AMBIGUA");
    if (r.estado === "AMBIGUA") expect(r.candidatas).toHaveLength(2);
  });

  it("dos filas del MISMO destino (dos transportistas) no son ambigüedad", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([CALIDONIA, { ...CALIDONIA }]);

    expect((await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Calidonia" })).estado).toBe("UNICA");
  });
});

describe("resolverUbicacionPorNombre — prioridad de niveles", () => {
  it("gana el nivel más específico: si el nombre es un sector, ese es el destino", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      ubic({ provinciaEstado: "Panamá Province", distritoCiudad: "Costa del Este" }),
      ubic({ provinciaEstado: "Panamá Province", distritoCiudad: "Juan Díaz", sectorOCodigoPostal: "Costa del Este" }),
    ]);

    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Costa del Este" });

    expect(r.estado).toBe("UNICA");
    if (r.estado === "UNICA") {
      expect(r.ubicacion.nivel).toBe("SECTOR");
      expect(r.ubicacion.distritoCiudad).toBe("Juan Díaz");
    }
  });

  it("una provincia se reconoce como provincia", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([ubic({ provinciaEstado: "Coclé Province" })]);

    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Coclé Province" });

    expect(r.estado).toBe("UNICA");
    if (r.estado === "UNICA") expect(r.ubicacion.nivel).toBe("PROVINCIA");
  });
});

describe("resolverUbicacionPorNombre — alias (024)", () => {
  it("encuentra el destino por un alias cargado en ese nivel", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      ubic({
        provinciaEstado: "Panamá Province",
        distritoCiudad: "Costa del Este",
        aliases: [{ campo: "distritoCiudad", valorNormalizado: "costa-este" }],
      }),
    ]);

    const r = await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "Costa Este" });

    expect(r.estado).toBe("UNICA");
    if (r.estado === "UNICA") expect(r.ubicacion.distritoCiudad).toBe("Costa del Este");
  });

  it("un alias de otro nivel no cuenta para este", async () => {
    zonaUbicacionFindManyMock.mockResolvedValue([
      ubic({ provinciaEstado: "Panamá Province", distritoCiudad: "Juan Díaz", aliases: [{ campo: "provinciaEstado", valorNormalizado: "pty" }] }),
    ]);

    expect((await resolverUbicacionPorNombre({ instanciaId: "i1", nombre: "pty" })).estado).toBe("UNICA");
  });
});

describe("resolverUbicacionPorNombre — alcance de la consulta", () => {
  it("solo mira zonas activas de transportistas activos de la instancia", async () => {
    await resolverUbicacionPorNombre({ instanciaId: "inst-9", nombre: "Calidonia" });

    expect(zonaUbicacionFindManyMock.mock.calls[0][0].where).toEqual({
      zonaEntrega: { instanciaId: "inst-9", activa: true, transportista: { activo: true } },
    });
  });

  it("acota al transportista cuando se pide uno", async () => {
    await resolverUbicacionPorNombre({ instanciaId: "inst-9", nombre: "Calidonia", transportistaId: "t-1" });

    expect(zonaUbicacionFindManyMock.mock.calls[0][0].where.zonaEntrega.transportista).toEqual({ activo: true, id: "t-1" });
  });
});

describe("describirUbicacion", () => {
  it("arma una etiqueta legible saltando los niveles vacíos", () => {
    expect(describirUbicacion({ estadoProvincia: "Panamá Province", distritoCiudad: "Calidonia", corregimiento: null, sectorOCodigoPostal: null, nivel: "CIUDAD" }))
      .toBe("Panamá Province > Calidonia");
  });
});

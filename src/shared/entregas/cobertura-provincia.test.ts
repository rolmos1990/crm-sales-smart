import { describe, expect, it } from "vitest";
import { agruparCoberturaPorProvincia, type UbicacionConLugares } from "./cobertura-provincia";

// El catálogo de geografía guarda el nombre administrativo completo; las zonas
// guardan lo que escribió el usuario.
const ESTADOS = [
  { id: "ep-chiriqui", nombre: "Chiriquí Province" },
  { id: "ep-bocas", nombre: "Bocas del Toro Province" },
  { id: "ep-cocle", nombre: "Coclé Province" },
];

const ubicacion = (over: Partial<UbicacionConLugares> = {}): UbicacionConLugares => ({
  provinciaEstado: "Chiriquí",
  distritoCiudad: null,
  corregimiento: null,
  sectorOCodigoPostal: null,
  aliases: [],
  ...over,
});

const lugaresDe = (r: ReturnType<typeof agruparCoberturaPorProvincia>, id: string) =>
  r.find((c) => c.estadoProvinciaId === id)?.lugares ?? [];

describe("agruparCoberturaPorProvincia", () => {
  it('encontrar "Boquete" lleva a Chiriquí — el caso que originó la mejora', () => {
    const r = agruparCoberturaPorProvincia([ubicacion({ distritoCiudad: "Boquete" })], ESTADOS);

    expect(lugaresDe(r, "ep-chiriqui")).toContain("Boquete");
  });

  it('"Changuinola" lleva a Bocas del Toro', () => {
    const r = agruparCoberturaPorProvincia(
      [ubicacion({ provinciaEstado: "Bocas del Toro", distritoCiudad: "Changuinola" })],
      ESTADOS,
    );

    expect(lugaresDe(r, "ep-bocas")).toEqual(["Changuinola"]);
  });

  it('tolera el sufijo administrativo del catálogo ("Chiriquí" ≡ "Chiriquí Province")', () => {
    const r = agruparCoberturaPorProvincia([ubicacion({ distritoCiudad: "David" })], ESTADOS);
    expect(r.map((c) => c.estadoProvinciaId)).toEqual(["ep-chiriqui"]);
  });

  it("tolera tildes y mayúsculas al emparejar la provincia", () => {
    const r = agruparCoberturaPorProvincia(
      [ubicacion({ provinciaEstado: "COCLE", distritoCiudad: "Penonomé" })],
      ESTADOS,
    );
    expect(lugaresDe(r, "ep-cocle")).toEqual(["Penonomé"]);
  });

  it("junta distrito, corregimiento, sector y alias en la misma provincia", () => {
    const r = agruparCoberturaPorProvincia(
      [
        ubicacion({
          distritoCiudad: "David",
          corregimiento: "San Mateo",
          sectorOCodigoPostal: "0426",
          aliases: [{ valor: "David Centro" }],
        }),
      ],
      ESTADOS,
    );

    expect(lugaresDe(r, "ep-chiriqui")).toEqual(["0426", "David", "David Centro", "San Mateo"]);
  });

  it("acumula los lugares de varias ubicaciones de la misma provincia, sin repetir", () => {
    const r = agruparCoberturaPorProvincia(
      [
        ubicacion({ distritoCiudad: "Boquete" }),
        ubicacion({ distritoCiudad: "Volcán" }),
        ubicacion({ distritoCiudad: "Boquete" }),
      ],
      ESTADOS,
    );

    expect(lugaresDe(r, "ep-chiriqui")).toEqual(["Boquete", "Volcán"]);
  });

  it("separa las provincias entre sí", () => {
    const r = agruparCoberturaPorProvincia(
      [
        ubicacion({ distritoCiudad: "Boquete" }),
        ubicacion({ provinciaEstado: "Bocas del Toro", distritoCiudad: "Almirante" }),
      ],
      ESTADOS,
    );

    expect(lugaresDe(r, "ep-chiriqui")).toEqual(["Boquete"]);
    expect(lugaresDe(r, "ep-bocas")).toEqual(["Almirante"]);
  });

  it("una provincia que no está en el catálogo se ignora, no rompe el resto", () => {
    const r = agruparCoberturaPorProvincia(
      [
        ubicacion({ provinciaEstado: "Provincia Inventada", distritoCiudad: "X" }),
        ubicacion({ distritoCiudad: "Boquete" }),
      ],
      ESTADOS,
    );

    expect(r).toHaveLength(1);
    expect(lugaresDe(r, "ep-chiriqui")).toEqual(["Boquete"]);
  });

  it("una ubicación sin provincia (comodín) se ignora", () => {
    const r = agruparCoberturaPorProvincia([ubicacion({ provinciaEstado: null, distritoCiudad: "X" })], ESTADOS);
    expect(r).toEqual([]);
  });

  it("una provincia sin ningún lugar concreto queda con la lista vacía, no se inventa nada", () => {
    const r = agruparCoberturaPorProvincia([ubicacion()], ESTADOS);
    expect(lugaresDe(r, "ep-chiriqui")).toEqual([]);
  });

  it("ignora valores en blanco", () => {
    const r = agruparCoberturaPorProvincia(
      [ubicacion({ distritoCiudad: "   ", corregimiento: "", aliases: [{ valor: " " }] })],
      ESTADOS,
    );
    expect(lugaresDe(r, "ep-chiriqui")).toEqual([]);
  });

  it("ordena alfabéticamente en español — el subtítulo se lee de corrido", () => {
    const r = agruparCoberturaPorProvincia(
      [ubicacion({ distritoCiudad: "Volcán" }), ubicacion({ distritoCiudad: "Álamo" }), ubicacion({ distritoCiudad: "Boquete" })],
      ESTADOS,
    );
    expect(lugaresDe(r, "ep-chiriqui")).toEqual(["Álamo", "Boquete", "Volcán"]);
  });

  it("sin ubicaciones no devuelve provincias", () => {
    expect(agruparCoberturaPorProvincia([], ESTADOS)).toEqual([]);
  });
});

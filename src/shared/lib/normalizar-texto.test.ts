import { describe, expect, it } from "vitest";
import { normalizarTexto } from "./normalizar-texto";
import { generarSlug } from "./slug";
import { normalizarUbicacion } from "@/shared/entregas/normalizar-ubicacion";

describe("normalizarTexto", () => {
  it("convierte a minúsculas", () => {
    expect(normalizarTexto("LA CHORRERA")).toBe("la-chorrera");
  });

  it("elimina tildes", () => {
    expect(normalizarTexto("Chiriquí Grande")).toBe("chiriqui-grande");
    expect(normalizarTexto("Panamá")).toBe("panama");
  });

  it("colapsa espacios repetidos", () => {
    expect(normalizarTexto("Chiriqui   Grande")).toBe("chiriqui-grande");
  });

  it("elimina puntuación y guiones sueltos, quita espacios en los bordes", () => {
    expect(normalizarTexto("  David, San Mateo  ")).toBe("david-san-mateo");
    expect(normalizarTexto("Panamá-Oeste")).toBe("panama-oeste");
  });

  it("produce siempre el mismo resultado para variantes equivalentes (requerimiento-transportista.md)", () => {
    const esperado = "chiriqui-grande";
    expect(normalizarTexto("CHIRIQUÍ Grande")).toBe(esperado);
    expect(normalizarTexto("Chiriqui   Grande")).toBe(esperado);
    expect(normalizarTexto("chiriquí-grande")).toBe(esperado);
  });

  it("acepta un separador distinto", () => {
    expect(normalizarTexto("La Chorrera", " ")).toBe("la chorrera");
  });
});

describe("generarSlug (wrapper sobre normalizarTexto — comportamiento sin cambios)", () => {
  it("produce el mismo resultado que antes de la extracción", () => {
    expect(generarSlug("La Chorrera")).toBe("la-chorrera");
    expect(generarSlug("Chiriquí Grande")).toBe("chiriqui-grande");
  });
});

describe("normalizarUbicacion (entrypoint de dominio)", () => {
  it("normaliza igual que normalizarTexto con separador por defecto", () => {
    expect(normalizarUbicacion("La Chorrera")).toBe("la-chorrera");
    expect(normalizarUbicacion("  Chiriquí   Grande ")).toBe("chiriqui-grande");
  });
});

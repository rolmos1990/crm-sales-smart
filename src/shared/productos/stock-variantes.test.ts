import { describe, expect, it } from "vitest";
import { parLinea, validarVariantesLineas } from "./stock";

// 030-variantes-producto — la validación de variantes que usan pedidos Y
// cotizaciones (crear/editar) antes de escribir. Doble mínimo de Prisma.

const productos = [
  { id: "base", nombre: "Base Luminaria", tieneVariantes: true, instanciaId: "inst-1" },
  { id: "cojin", nombre: "Cojín", tieneVariantes: false, instanciaId: "inst-1" },
  { id: "ajeno", nombre: "Ajeno", tieneVariantes: true, instanciaId: "inst-2" },
];
const variantes = [
  { id: "amarilla", nombre: "Amarilla", activo: true, productoId: "base", instanciaId: "inst-1" },
  { id: "vieja", nombre: "Vieja", activo: false, productoId: "base", instanciaId: "inst-1" },
  { id: "de-otro", nombre: "Roja", activo: true, productoId: "otro", instanciaId: "inst-1" },
  { id: "de-otra-empresa", nombre: "Azul", activo: true, productoId: "ajeno", instanciaId: "inst-2" },
];

type Where = { id: { in: string[] }; instanciaId?: string; producto?: { instanciaId: string } };
const db = {
  producto: {
    findMany: ({ where }: { where: Where }) =>
      Promise.resolve(productos.filter((p) => where.id.in.includes(p.id) && p.instanciaId === where.instanciaId)),
  },
  productoVariante: {
    findMany: ({ where }: { where: Where }) =>
      Promise.resolve(variantes.filter((v) => where.id.in.includes(v.id) && v.instanciaId === where.producto?.instanciaId)),
  },
} as unknown as Parameters<typeof validarVariantesLineas>[2];

const validar = (lineas: { productoId: string; varianteId?: string }[], existentes?: Set<string>) =>
  validarVariantesLineas(lineas, { instanciaId: "inst-1", existentes }, db);

describe("validarVariantesLineas (030)", () => {
  it("un producto sin variantes pasa sin variante (flujo de siempre)", async () => {
    expect((await validar([{ productoId: "cojin" }])).error).toBeNull();
  });

  it("producto + variante válida pasa y devuelve el nombre para el snapshot", async () => {
    const r = await validar([{ productoId: "base", varianteId: "amarilla" }]);
    expect(r.error).toBeNull();
    expect(r.nombres.get("amarilla")).toBe("Amarilla");
  });

  it("un producto con variantes no se vende sin elegir variante", async () => {
    expect((await validar([{ productoId: "base" }])).error).toBe("Selecciona una variante de «Base Luminaria»");
  });

  it("rechaza una variante que pertenece a otro producto", async () => {
    expect((await validar([{ productoId: "base", varianteId: "de-otro" }])).error).toBe(
      "La variante seleccionada no pertenece a «Base Luminaria»",
    );
  });

  it("rechaza una variante de otra empresa (no se encuentra)", async () => {
    expect((await validar([{ productoId: "base", varianteId: "de-otra-empresa" }])).error).toBe(
      "La variante seleccionada no pertenece a «Base Luminaria»",
    );
  });

  it("una variante inactiva no está disponible para nuevas ventas", async () => {
    expect((await validar([{ productoId: "base", varianteId: "vieja" }])).error).toBe(
      "La variante «Vieja» de «Base Luminaria» no está activa",
    );
  });

  it("una línea ya guardada con una variante hoy inactiva se sigue aceptando (historial)", async () => {
    const linea = { productoId: "base", varianteId: "vieja" };
    const r = await validar([linea], new Set([parLinea(linea)]));
    expect(r.error).toBeNull();
  });

  it("una línea histórica sin variante de un producto que activó variantes después se sigue aceptando", async () => {
    const linea = { productoId: "base" };
    expect((await validar([linea], new Set([parLinea(linea)]))).error).toBeNull();
  });

  it("rechaza mandar una variante para un producto que no tiene variantes", async () => {
    expect((await validar([{ productoId: "cojin", varianteId: "amarilla" }])).error).toBe("«Cojín» no tiene variantes");
  });
});

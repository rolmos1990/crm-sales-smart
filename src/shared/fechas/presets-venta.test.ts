import { describe, expect, it } from "vitest";

import { PRESETS_RANGO_VENTA } from "./presets-rango";
import type { FechaYMD } from "./tipos";

// 038 — atajos del filtro de fecha de venta. Se calculan sobre el día de hoy
// EN LA ZONA DE NEGOCIO (el componente se lo pasa resuelto), nunca sobre la
// del navegador: estos valores terminan en un `where` de Prisma.

/** Miércoles 18 de noviembre de 2026. */
const HOY: FechaYMD = { anio: 2026, mes: 11, dia: 18 };

const preset = (etiqueta: string) => {
  const p = PRESETS_RANGO_VENTA.find((x) => x.etiqueta === etiqueta);
  if (!p) throw new Error(`No existe el atajo "${etiqueta}"`);
  return p.calcular(HOY);
};

describe("PRESETS_RANGO_VENTA", () => {
  it("ofrece exactamente los cinco atajos pedidos, en orden", () => {
    expect(PRESETS_RANGO_VENTA.map((p) => p.etiqueta)).toEqual([
      "Hoy",
      "Ayer",
      "Última semana",
      "Últimos 15 días",
      "Último mes",
    ]);
  });

  it("Hoy es un único día", () => {
    expect(preset("Hoy")).toEqual({ desde: HOY, hasta: HOY });
  });

  it("Ayer es un único día, el anterior", () => {
    const ayer = { anio: 2026, mes: 11, dia: 17 };
    expect(preset("Ayer")).toEqual({ desde: ayer, hasta: ayer });
  });

  // "Últimos N días" incluye hoy, así que el piso es hoy-(N-1). Un off-by-one
  // acá movería ventas de un período a otro sin que nadie lo note.
  it("Última semana son 7 días contando hoy", () => {
    expect(preset("Última semana")).toEqual({
      desde: { anio: 2026, mes: 11, dia: 12 },
      hasta: HOY,
    });
  });

  it("Últimos 15 días son 15 contando hoy", () => {
    expect(preset("Últimos 15 días")).toEqual({
      desde: { anio: 2026, mes: 11, dia: 4 },
      hasta: HOY,
    });
  });

  it("Último mes son 30 días contando hoy, y cruza el cambio de mes", () => {
    expect(preset("Último mes")).toEqual({
      desde: { anio: 2026, mes: 10, dia: 20 },
      hasta: HOY,
    });
  });

  it("ningún atajo deja un extremo abierto ni mira al futuro", () => {
    for (const p of PRESETS_RANGO_VENTA) {
      const { desde, hasta } = p.calcular(HOY);
      expect(desde, p.etiqueta).not.toBeNull();
      expect(hasta, p.etiqueta).toEqual(HOY === hasta ? HOY : hasta);
      expect(hasta!.anio * 10000 + hasta!.mes * 100 + hasta!.dia)
        .toBeLessThanOrEqual(HOY.anio * 10000 + HOY.mes * 100 + HOY.dia);
    }
  });
});

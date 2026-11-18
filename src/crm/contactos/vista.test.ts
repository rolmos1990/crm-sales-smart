import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db/prisma", () => ({ prisma: {} }));

import { FILTROS_VISTA_CONTACTOS_DEFECTO } from "./schema";
import { planificarTramos } from "./segmentacion/paginacion";
import { UMBRALES_SEGUIMIENTO_DEFECTO, calcularCortes } from "./segmentacion/cortes";
import { cumple } from "./segmentacion/evaluar-where.test-util";
import { construirWhereVista, hayFiltrosActivos } from "./vista";

// 041 — Orden por prioridad sin SQL crudo: con los conteos de los cuatro
// tramos se decide qué rebanada leer de cada uno (research D2).

describe("planificarTramos", () => {
  const conteos = { 1: 3, 2: 5, 3: 0, 4: 10 } as const;

  it("página dentro de un solo tramo", () => {
    expect(planificarTramos(conteos, 0, 2)).toEqual([{ tramo: 1, skip: 0, take: 2 }]);
  });

  it("página que cruza T1→T2 y salta un tramo vacío hasta T4", () => {
    expect(planificarTramos(conteos, 2, 8)).toEqual([
      { tramo: 1, skip: 2, take: 1 },
      { tramo: 2, skip: 0, take: 5 },
      { tramo: 4, skip: 0, take: 2 },
    ]);
  });

  it("última página incompleta", () => {
    expect(planificarTramos(conteos, 15, 5)).toEqual([{ tramo: 4, skip: 7, take: 3 }]);
  });

  it("fuera de rango no lee nada", () => {
    expect(planificarTramos(conteos, 18, 5)).toEqual([]);
  });

  it("recorrer todas las páginas no deja huecos ni duplicados", () => {
    const vistos: string[] = [];
    for (let skip = 0; skip < 18; skip += 4) {
      for (const r of planificarTramos(conteos, skip, 4)) {
        for (let i = 0; i < r.take; i++) vistos.push(`${r.tramo}:${r.skip + i}`);
      }
    }
    const esperado = [
      ...[0, 1, 2].map((i) => `1:${i}`),
      ...[0, 1, 2, 3, 4].map((i) => `2:${i}`),
      ...Array.from({ length: 10 }, (_, i) => `4:${i}`),
    ];
    expect(vistos).toEqual(esperado);
  });
});

describe("construirWhereVista", () => {
  const ZONA = "America/Panama";
  const AHORA = new Date("2026-11-18T15:00:00Z");
  const cortes = calcularCortes(ZONA, UMBRALES_SEGUIMIENTO_DEFECTO, AHORA);
  const contacto = (p: Record<string, unknown>) => ({
    instanciaId: "inst-1",
    nombre: "Ana",
    apellido: "Pérez",
    email: "ana@correo.com",
    telefonoPrincipal: "+507 6123-4567",
    telefonoSecundario: null,
    creadoEn: new Date("2026-01-01"),
    ultimaInteraccionEn: null,
    esperandoRespuestaDesde: null,
    nivelInteres: "SIN_EVALUAR",
    nivelInteresFijado: false,
    noContactarDesde: null,
    pedidos: [],
    oportunidades: [],
    cotizaciones: [],
    actividades: [],
    identificadoresCanal: [{ canal: "whatsapp_lite" }],
    ...p,
  });
  const where = (cambios: Partial<typeof FILTROS_VISTA_CONTACTOS_DEFECTO>) =>
    construirWhereVista("inst-1", ZONA, { ...FILTROS_VISTA_CONTACTOS_DEFECTO, ...cambios }, [], cortes) as Record<string, unknown>;

  it("nunca deja pasar otra instancia", () => {
    expect(cumple(where({}), contacto({ instanciaId: "otra" }))).toBe(false);
  });

  it("busca por fragmento de teléfono y de email", () => {
    expect(cumple(where({ busqueda: "6123" }), contacto({}))).toBe(true);
    expect(cumple(where({ busqueda: "@correo" }), contacto({}))).toBe(true);
    expect(cumple(where({ busqueda: "zzz" }), contacto({}))).toBe(false);
  });

  it("el filtro WhatsApp incluye las dos integraciones", () => {
    expect(cumple(where({ canal: "WHATSAPP" }), contacto({}))).toBe(true);
    expect(cumple(where({ canal: "EMAIL" }), contacto({}))).toBe(false);
  });

  it("Sin actividad filtra por última interacción nula", () => {
    expect(cumple(where({ ultimaActividad: "SIN_ACTIVIDAD" }), contacto({}))).toBe(true);
    expect(cumple(where({ ultimaActividad: "SIN_ACTIVIDAD" }), contacto({ ultimaInteraccionEn: AHORA }))).toBe(false);
  });

  it("preferencia No contactar", () => {
    expect(cumple(where({ preferencia: "NO_CONTACTAR" }), contacto({ noContactarDesde: AHORA }))).toBe(true);
    expect(cumple(where({ preferencia: "CONTACTABLE" }), contacto({ noContactarDesde: AHORA }))).toBe(false);
  });
});

describe("hayFiltrosActivos", () => {
  it("la vista por defecto no tiene filtros; el orden y la página no cuentan", () => {
    expect(hayFiltrosActivos(FILTROS_VISTA_CONTACTOS_DEFECTO)).toBe(false);
    expect(hayFiltrosActivos({ ...FILTROS_VISTA_CONTACTOS_DEFECTO, pagina: 3, orden: "NOMBRE" })).toBe(false);
    expect(hayFiltrosActivos({ ...FILTROS_VISTA_CONTACTOS_DEFECTO, segmento: "CLIENTES" })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  condicionActiva, condicionGanada, condicionPerdida, condicionEstado,
  construirWhere, construirWhereBase, DIAS_ACTIVIDAD_RECIENTE,
  type OportunidadesFiltros,
} from "./filtros-oportunidades";

const INSTANCIA = "inst_1";
const ZONA = "America/Lima";

describe("condiciones de estado (activa/ganada/perdida)", () => {
  it("condicionGanada acepta stage dinámico marcado esGanado, o etapa legacy GANADO sin stage", () => {
    const c = condicionGanada() as any;
    expect(c.OR).toEqual([
      { stage: { esGanado: true } },
      { AND: [{ stageId: null }, { etapa: "GANADO" }] },
    ]);
  });

  it("condicionPerdida es el espejo de condicionGanada con esPerdido/PERDIDO", () => {
    const c = condicionPerdida() as any;
    expect(c.OR).toEqual([
      { stage: { esPerdido: true } },
      { AND: [{ stageId: null }, { etapa: "PERDIDO" }] },
    ]);
  });

  it("condicionActiva excluye ganadas y perdidas por ambas vías (dinámica y legacy)", () => {
    const c = condicionActiva() as any;
    expect(c.NOT.OR).toEqual([
      { stage: { esGanado: true } },
      { stage: { esPerdido: true } },
      { AND: [{ stageId: null }, { etapa: { in: ["GANADO", "PERDIDO"] } }] },
    ]);
  });

  it("condicionEstado('todas') y sin estado no agregan ninguna condición", () => {
    expect(condicionEstado("todas")).toEqual({});
    expect(condicionEstado(undefined)).toEqual({});
  });

  it("condicionEstado despacha activas/ganadas/perdidas a su condición correspondiente", () => {
    expect(condicionEstado("activas")).toEqual(condicionActiva());
    expect(condicionEstado("ganadas")).toEqual(condicionGanada());
    expect(condicionEstado("perdidas")).toEqual(condicionPerdida());
  });
});

describe("construirWhereBase — filtros individuales", () => {
  it("siempre incluye instanciaId, incluso sin filtros", () => {
    expect(construirWhereBase(INSTANCIA, ZONA)).toEqual({ instanciaId: INSTANCIA });
  });

  it("busqueda arma OR sobre título, contacto (nombre/apellido) y empresa", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { busqueda: "Robson" }) as any;
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ titulo: { contains: "Robson", mode: "insensitive" } });
  });

  it("contactoIds/tagIds usan `some...in` sobre la relación", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, {
      contactoIds: ["c1"],
      tagIds: ["t1", "t2"],
    }) as any;
    expect(where.contactos).toEqual({ some: { contactoId: { in: ["c1"] } } });
    expect(where.tags).toEqual({ some: { tagId: { in: ["t1", "t2"] } } });
  });

  it("productoIds filtra por línea de producto en las cotizaciones de la oportunidad, no por Oportunidad.productos (relación muerta, nunca se escribe)", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { productoIds: ["p1", "p2"] }) as any;
    expect(where.productos).toBeUndefined();
    expect(where.cotizaciones).toEqual({
      some: { lineas: { some: { productoId: { in: ["p1", "p2"] } } } },
    });
  });

  it("productoIds + conCotizacion:true no se pisan — la condición de producto ya implica tener cotización", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { productoIds: ["p1"], conCotizacion: true }) as any;
    expect(where.cotizaciones).toEqual({
      some: { lineas: { some: { productoId: { in: ["p1"] } } } },
    });
  });

  it("etapaId tiene prioridad sobre etapaLegacy cuando ambos vienen (no debería pasar en la práctica)", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { etapaId: "stage_1", etapaLegacy: "PROSPECTO" }) as any;
    expect(where.stageId).toBe("stage_1");
    expect(where.etapa).toBeUndefined();
  });

  it("etapaLegacy se aplica cuando no hay etapaId", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { etapaLegacy: "PROPUESTA" }) as any;
    expect(where.etapa).toBe("PROPUESTA");
  });

  it("estado agrega la condición como AND explícito, sin pisar el OR de búsqueda", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { busqueda: "algo", estado: "ganadas" }) as any;
    expect(where.OR).toBeDefined();
    expect(where.AND).toEqual(condicionGanada());
  });

  it("rango de valor y probabilidad solo agregan los límites presentes", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { valorMin: 100, probabilidadMax: 80 }) as any;
    expect(where.valor).toEqual({ gte: 100 });
    expect(where.probabilidad).toEqual({ lte: 80 });
  });

  it("conCotizacion true/false usa some/none — undefined no agrega el filtro", () => {
    expect((construirWhereBase(INSTANCIA, ZONA, { conCotizacion: true }) as any).cotizaciones).toEqual({ some: {} });
    expect((construirWhereBase(INSTANCIA, ZONA, { conCotizacion: false }) as any).cotizaciones).toEqual({ none: {} });
    expect((construirWhereBase(INSTANCIA, ZONA, {}) as any).cotizaciones).toBeUndefined();
  });

  it("conActividadesPendientes filtra por al menos una actividad no completada", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { conActividadesPendientes: true }) as any;
    expect(where.actividades).toEqual({ some: { completada: false } });
  });

  it("sinActividadReciente usa la ventana de DIAS_ACTIVIDAD_RECIENTE en la zona horaria dada", () => {
    const where = construirWhereBase(INSTANCIA, ZONA, { sinActividadReciente: true }) as any;
    expect(where.actividades.none.fecha.gte).toBeInstanceOf(Date);
    // 14 días antes de "hoy" en esa zona — no se fija la fecha exacta acá
    // (no se inyectó `referencia`), solo que el filtro se arma con `none`.
    expect(DIAS_ACTIVIDAD_RECIENTE).toBe(14);
  });
});

describe("construirWhere — vencimiento (Oportunidad.fechaCierre)", () => {
  const filtrosBase: OportunidadesFiltros = {};

  it("sin vencimiento, es idéntico a construirWhereBase", () => {
    expect(construirWhere(INSTANCIA, ZONA, filtrosBase)).toEqual(construirWhereBase(INSTANCIA, ZONA, filtrosBase));
  });

  it("'sinfecha' filtra fechaCierre null", () => {
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "sinfecha" }) as any;
    expect(where.fechaCierre).toBeNull();
  });

  it("'vencidas' es estrictamente antes del inicio de hoy (zona de negocio)", () => {
    // Nota: sin inyectar `referencia`, rangoDiaEnZona usa la fecha real del
    // sistema — se verifica la FORMA del filtro, no el valor exacto.
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "vencidas" }) as any;
    expect(Object.keys(where.fechaCierre)).toEqual(["lt"]);
    expect(where.fechaCierre.lt).toBeInstanceOf(Date);
  });

  it("'hoy' es [inicio de hoy, inicio de mañana)", () => {
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "hoy" }) as any;
    expect(Object.keys(where.fechaCierre).sort()).toEqual(["gte", "lt"]);
    expect(where.fechaCierre.lt.getTime() - where.fechaCierre.gte.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("'7dias' cubre exactamente 7 días desde hoy", () => {
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "7dias" }) as any;
    const dias = (where.fechaCierre.lt.getTime() - where.fechaCierre.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(7);
  });

  it("'30dias' cubre exactamente 30 días desde hoy", () => {
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "30dias" }) as any;
    const dias = (where.fechaCierre.lt.getTime() - where.fechaCierre.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(30);
  });

  it("'personalizado' respeta el rango exacto dado (gte/lt exclusivo)", () => {
    const vencDesde = new Date("2026-08-01T05:00:00.000Z");
    const vencHasta = new Date("2026-08-15T05:00:00.000Z");
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "personalizado", vencDesde, vencHasta }) as any;
    expect(where.fechaCierre).toEqual({ gte: vencDesde, lt: vencHasta });
  });

  it("'personalizado' sin fechas no agrega restricción de fechaCierre", () => {
    const where = construirWhere(INSTANCIA, ZONA, { vencimiento: "personalizado" }) as any;
    expect(where.fechaCierre).toBeUndefined();
  });
});

describe("zona horaria — no se filtra por la hora del proceso que corre el código", () => {
  it("rangos de 'hoy' calculados en dos zonas horarias distintas pueden diferir", () => {
    const whereLima = construirWhere(INSTANCIA, "America/Lima", { vencimiento: "hoy" }, ) as any;
    const whereTokio = construirWhere(INSTANCIA, "Asia/Tokyo", { vencimiento: "hoy" }) as any;
    // No siempre van a diferir (depende de la hora real al correr el test),
    // pero ambos deben ser fechas válidas de 24h — la prueba de fondo es que
    // la función acepta la zona horaria como parámetro explícito en vez de
    // asumir la del proceso.
    expect(whereLima.fechaCierre.gte).toBeInstanceOf(Date);
    expect(whereTokio.fechaCierre.gte).toBeInstanceOf(Date);
  });
});

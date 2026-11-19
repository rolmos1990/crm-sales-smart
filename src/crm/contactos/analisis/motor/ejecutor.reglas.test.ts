import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatosContactoLote, ContactoReclamado } from "../types";
import { PLANTILLAS } from "../criterio/plantillas";

// 042 — Ejecutor en modo solo reglas. Se simulan la base (evaluaciones por
// contacto), la cola y la auditoría; las reglas y las decisiones son las reales.

type Evaluacion = { contactoId: string; instanciaId: string; versionEvaluada: bigint; origen: string; puntaje: number };

const evaluaciones = new Map<string, Evaluacion>();
const completados: Array<{ contactoId: string; versionReclamada: bigint }> = [];
const items: Array<{ contactoId: string; estado: string; motivo?: string | null }> = [];
const cierres: Array<Record<string, unknown>> = [];
const publicados: unknown[] = [];
let datosLote = new Map<string, DatosContactoLote>();
let fallarEscrituraDe: string | null = null;

const tx = {
  contactoEvaluacion: {
    updateMany: vi.fn(async ({ where, data }: { where: { contactoId: string; instanciaId: string; versionEvaluada: { lt: bigint } }; data: Partial<Evaluacion> }) => {
      const e = evaluaciones.get(where.contactoId);
      if (!e || e.instanciaId !== where.instanciaId || e.versionEvaluada >= where.versionEvaluada.lt) return { count: 0 };
      Object.assign(e, data);
      return { count: 1 };
    }),
    createMany: vi.fn(async ({ data }: { data: Evaluacion[] }) => {
      const d = data[0];
      if (d.contactoId === fallarEscrituraDe) throw Object.assign(new Error("FK"), { code: "P2003" });
      if (evaluaciones.has(d.contactoId)) return { count: 0 };
      evaluaciones.set(d.contactoId, { ...d });
      return { count: 1 };
    }),
  },
  contacto: { updateMany: vi.fn(async () => ({ count: 1 })) },
};

vi.mock("@/shared/db/prisma", () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
}));
vi.mock("@/shared/rabbitmq", () => ({
  publicadorEventos: { publicar: vi.fn(async (...a: unknown[]) => void publicados.push(a)) },
}));
vi.mock("@/crm/contactos/clasificacion", () => ({ actualizarInteres: vi.fn() }));
vi.mock("../cola", () => ({
  completarContacto: vi.fn(async (_db: unknown, p: { contactoId: string; versionReclamada: bigint }) => void completados.push(p)),
  devolverConBackoff: vi.fn(async () => {}),
}));
vi.mock("../datos-lote", () => ({ cargarDatosLote: vi.fn(async () => datosLote) }));
vi.mock("./contexto-cuenta", () => ({
  cargarContextoCuenta: vi.fn(async (instanciaId: string) => ({
    instanciaId,
    zonaNegocio: "America/Lima",
    idioma: "es",
    umbralesSeguimiento: { pendiente: 3, recuperar: 7, inactivo: 60 },
    etapas: [],
    criterio: { contenido: PLANTILLAS.GENERAL.contenido, versionId: null, numero: null, plantillaAplicada: "GENERAL" },
    analisisHabilitado: true,
    iaCuentaHabilitada: false,
    modoInteres: "SOLO_SUGERIR",
    mesesAntiguedadInicial: 12,
    tamanoLote: 20,
  })),
}));
vi.mock("./auditoria", async (original) => {
  const real = await original<typeof import("./auditoria")>();
  return {
    ...real,
    abrirEjecucion: vi.fn(async () => "ej-1"),
    cerrarEjecucion: vi.fn(async (_id: string, c: Record<string, unknown>) => void cierres.push(c)),
    registrarItems: vi.fn(async (_db: unknown, _i: string, _e: string, lista: typeof items) => void items.push(...lista)),
  };
});

const { procesarLote } = await import("./ejecutor");

const AHORA = new Date("2026-11-19T15:00:00Z");

function datos(contactoId: string, extra: Partial<DatosContactoLote> = {}): DatosContactoLote {
  return {
    contactoId,
    creadoEn: new Date("2026-01-01T00:00:00Z"),
    ultimaInteraccionEn: new Date("2026-11-18T00:00:00Z"),
    esperandoRespuesta: false,
    noContactar: false,
    nivelInteres: "SIN_EVALUAR",
    nivelInteresFijado: false,
    compras: 0,
    valorCompras: 0,
    ultimaCompraEn: null,
    cotizacionesActivas: 0,
    oportunidadesAbiertas: 0,
    tieneActividadVencida: false,
    tieneActividadVigente: false,
    proximaActividadEn: null,
    esCliente: false,
    esInteresado: false,
    seguimiento: "AL_DIA",
    ultimoMensajeEn: null,
    evaluacionPrevia: null,
    ...extra,
  };
}

const reclamado = (contactoId: string, version = BigInt(3)): ContactoReclamado => ({
  contactoId,
  versionReclamada: version,
  forzarIA: false,
  tipo: "INCREMENTAL",
  elegibleDesde: new Date("2026-11-19T14:55:00Z"),
});

beforeEach(() => {
  evaluaciones.clear();
  completados.length = 0;
  items.length = 0;
  cierres.length = 0;
  publicados.length = 0;
  fallarEscrituraDe = null;
  datosLote = new Map();
});

describe("procesarLote (solo reglas)", () => {
  it("un lote de 3 contactos queda evaluado por REGLA y la atención COMPLETADA", async () => {
    datosLote = new Map(["a", "b", "c"].map((id) => [id, datos(id, { compras: id === "a" ? 2 : 0, ultimaCompraEn: id === "a" ? new Date("2026-11-10T00:00:00Z") : null, esCliente: id === "a" })]));
    const r = await procesarLote({ instanciaId: "inst-1", prioridad: "P1", reclamados: ["a", "b", "c"].map((id) => reclamado(id)), leaseMs: 60_000, ahora: AHORA });

    expect(r).toMatchObject({ pedidos: 3, exitosos: 3, fallidos: 0, porReglas: 3, conIA: 0 });
    expect([...evaluaciones.values()].every((e) => e.origen === "REGLA")).toBe(true);
    expect(completados.map((c) => c.contactoId)).toEqual(["a", "b", "c"]);
    expect(cierres[0]).toMatchObject({ estado: "COMPLETADA", contactosExitosos: 3, contactosFallidos: 0 });
    expect(publicados).toHaveLength(3);
  });

  it("una versión vieja no pisa una evaluación más nueva", async () => {
    evaluaciones.set("a", { contactoId: "a", instanciaId: "inst-1", versionEvaluada: BigInt(9), origen: "IA", puntaje: 80 });
    datosLote = new Map([["a", datos("a", { evaluacionPrevia: { puntaje: 80, ajusteIA: 20, accionIA: "CONTACTAR_HOY", versionEvaluada: BigInt(9), intencion: "ALTA", senales: [], iaHasta: null, evaluadoIAEn: AHORA, noContactarResueltoEn: null, interesSugerido: null, interesSugeridoEstado: null } })]]);
    await procesarLote({ instanciaId: "inst-1", prioridad: "P1", reclamados: [reclamado("a", BigInt(5))], leaseMs: 60_000, ahora: AHORA });

    expect(evaluaciones.get("a")!.puntaje).toBe(80);
    expect(items[0]).toMatchObject({ contactoId: "a", estado: "DESCARTADO_VERSION" });
    expect(completados).toHaveLength(1); // la cola igual se cierra
    expect(publicados).toHaveLength(0);
  });

  it("un contacto que no está en los datos (otra cuenta o borrado) no se escribe", async () => {
    datosLote = new Map([["a", datos("a")]]);
    await procesarLote({ instanciaId: "inst-1", prioridad: "P1", reclamados: [reclamado("a"), reclamado("ajeno")], leaseMs: 60_000, ahora: AHORA });

    expect(evaluaciones.has("ajeno")).toBe(false);
    expect(items.find((i) => i.contactoId === "ajeno")).toMatchObject({ estado: "DESCARTADO_VERSION", motivo: "CONTACTO_ELIMINADO" });
  });

  it("un contacto borrado durante la escritura no frena al resto del lote (C3)", async () => {
    datosLote = new Map(["a", "b"].map((id) => [id, datos(id)]));
    fallarEscrituraDe = "a";
    const r = await procesarLote({ instanciaId: "inst-1", prioridad: "P1", reclamados: [reclamado("a"), reclamado("b")], leaseMs: 60_000, ahora: AHORA });

    expect(evaluaciones.has("b")).toBe(true);
    expect(items.find((i) => i.contactoId === "a")).toMatchObject({ estado: "DESCARTADO_VERSION", motivo: "CONTACTO_ELIMINADO" });
    expect(r.fallidos).toBe(0);
  });

  it("una reevaluación por reglas conserva lo que leyó la IA", async () => {
    evaluaciones.set("a", { contactoId: "a", instanciaId: "inst-1", versionEvaluada: BigInt(2), origen: "IA", puntaje: 70 });
    datosLote = new Map([["a", datos("a", { evaluacionPrevia: { puntaje: 70, ajusteIA: 25, accionIA: "ENVIAR_COTIZACION", versionEvaluada: BigInt(2), intencion: "ALTA", senales: ["Consultó precio"], iaHasta: AHORA, evaluadoIAEn: AHORA, noContactarResueltoEn: null, interesSugerido: null, interesSugeridoEstado: null } })]]);
    await procesarLote({ instanciaId: "inst-1", prioridad: "P1", reclamados: [reclamado("a", BigInt(3))], leaseMs: 60_000, ahora: AHORA });

    const data = tx.contactoEvaluacion.updateMany.mock.calls.at(-1)![0].data as Record<string, unknown>;
    expect(data.origen).toBe("IA");
    expect(data.accionSugerida).toBe("ENVIAR_COTIZACION");
    expect(data).not.toHaveProperty("senales");
    expect(data).not.toHaveProperty("intencion");
  });
});

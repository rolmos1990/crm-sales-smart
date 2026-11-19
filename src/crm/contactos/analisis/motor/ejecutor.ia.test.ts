import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactoReclamado, DatosContactoLote, EntradaLoteIA, ResultadoIAContacto, RespuestaLoteIA } from "../types";
import { PLANTILLAS } from "../criterio/plantillas";

// 042 — Ejecutor con IA (research D5, D8, D14) usando un ejecutor de IA
// simulado: resultados parciales, división de lotes, errores con consumo,
// sugerencias y compatibilidad con 012.

const escritas = new Map<string, Record<string, unknown>>();
const devueltos: string[][] = [];
const cierres: Array<Record<string, unknown>> = [];
const aperturas: Array<Record<string, unknown>> = [];
const actualizarInteres = vi.fn(async (..._a: unknown[]) => ({ ok: true, cambiado: true }));
const actualizarPreferenciaContacto = vi.fn();
const alEvaluarConIA = vi.fn(async (..._a: unknown[]) => {});
let datosLote = new Map<string, DatosContactoLote>();
let modoInteres: "SOLO_SUGERIR" | "APLICAR_AUTOMATICO" = "SOLO_SUGERIR";

const tx = {
  contactoEvaluacion: {
    updateMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown> & { contactoId: string }> }) => {
      escritas.set(data[0].contactoId, data[0]);
      return { count: 1 };
    }),
  },
  contacto: { updateMany: vi.fn(async () => ({ count: 1 })) },
};

vi.mock("@/shared/db/prisma", () => ({ prisma: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } }));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: vi.fn(async () => {}) } }));
vi.mock("@/crm/contactos/clasificacion", () => ({
  actualizarInteres: (...a: unknown[]) => actualizarInteres(...a),
  actualizarPreferenciaContacto: (...a: unknown[]) => actualizarPreferenciaContacto(...a),
}));
vi.mock("../cola", () => ({
  completarContacto: vi.fn(async () => {}),
  devolverConBackoff: vi.fn(async (p: { contactoIds: string[] }) => void (p.contactoIds.length && devueltos.push(p.contactoIds))),
}));
vi.mock("../datos-lote", () => ({ cargarDatosLote: vi.fn(async () => datosLote) }));
vi.mock("./contexto-cuenta", () => ({
  cargarContextoCuenta: vi.fn(async (instanciaId: string) => ({
    instanciaId,
    zonaNegocio: "America/Lima",
    idioma: "es",
    umbralesSeguimiento: { pendiente: 3, recuperar: 7, inactivo: 60 },
    etapas: [],
    criterio: { contenido: PLANTILLAS.GENERAL.contenido, versionId: "crit-v2", numero: 2, plantillaAplicada: null },
    analisisHabilitado: true,
    iaCuentaHabilitada: true,
    modoInteres,
    mesesAntiguedadInicial: 12,
    tamanoLote: 20,
  })),
}));
vi.mock("./auditoria", async (original) => {
  const real = await original<typeof import("./auditoria")>();
  return {
    ...real,
    abrirEjecucion: vi.fn(async (p: Record<string, unknown>) => {
      aperturas.push(p);
      return `ej-${aperturas.length}`;
    }),
    cerrarEjecucion: vi.fn(async (_id: string, c: Record<string, unknown>) => void cierres.push(c)),
    registrarItems: vi.fn(async () => {}),
  };
});

const { procesarLote } = await import("./ejecutor");

const AHORA = new Date("2026-11-19T15:00:00Z");

const datos = (contactoId: string, extra: Partial<DatosContactoLote> = {}): DatosContactoLote => ({
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
  ultimoMensajeEn: new Date("2026-11-18T00:00:00Z"),
  evaluacionPrevia: null,
  ...extra,
});

const reclamado = (contactoId: string): ContactoReclamado => ({
  contactoId,
  versionReclamada: BigInt(2),
  forzarIA: false,
  tipo: "INCREMENTAL",
  elegibleDesde: new Date("2026-11-19T14:59:00Z"),
});

const ia = (extra: Partial<ResultadoIAContacto> = {}): ResultadoIAContacto => ({
  intencion: "ALTA",
  intencionComercial: "LISTO_PARA_COMPRAR",
  urgencia: "ALTA",
  recuperacion: "NO_APLICA",
  ajustePuntaje: 25,
  senales: ["Consultó precio y fecha de entrega"],
  objeciones: [],
  motivos: [],
  accionSugerida: "ENVIAR_COTIZACION",
  sugerirNoContactar: false,
  motivoNoContactar: null,
  productosConsultados: [],
  presupuestoConocido: null,
  ocasionActual: null,
  fechaRequerida: null,
  ...extra,
});

function respuesta(resultados: Map<string, ResultadoIAContacto>, extra: Partial<RespuestaLoteIA> = {}): RespuestaLoteIA {
  return {
    resultados,
    invalidos: [],
    omitidos: [],
    loteInvalido: false,
    tokensEntrada: 1000,
    tokensSalida: 300,
    tokensCacheados: 0,
    costoEstimado: 0.002,
    usoIAId: "uso-1",
    proveedorIAId: "prov-1",
    proveedor: "DEEPSEEK",
    modelo: "deepseek-chat",
    promptVersion: "042.v1",
    ...extra,
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `k${i + 1}`);

async function correr(contactos: string[], ejecutorIA: (e: EntradaLoteIA) => Promise<RespuestaLoteIA>, disponible = true) {
  return procesarLote({
    instanciaId: "inst-1",
    prioridad: "P1",
    reclamados: contactos.map(reclamado),
    leaseMs: 60_000,
    ahora: AHORA,
    dependencias: {
      ejecutorIA,
      disponibilidadIA: async () => ({ disponible }),
      alEvaluarConIA,
    },
  });
}

beforeEach(() => {
  escritas.clear();
  devueltos.length = 0;
  cierres.length = 0;
  aperturas.length = 0;
  actualizarInteres.mockClear();
  actualizarPreferenciaContacto.mockClear();
  alEvaluarConIA.mockClear();
  modoInteres = "SOLO_SUGERIR";
  datosLote = new Map();
});

describe("procesarLote con IA", () => {
  it("17 de 20 válidos → atención PARCIAL y los 3 restantes vuelven a la cola (FR-017)", async () => {
    datosLote = new Map(ids(20).map((id) => [id, datos(id)]));
    const r = await correr(ids(20), async (e) =>
      respuesta(new Map(e.contactos.slice(0, 17).map((c) => [c.contactoId, ia()])), { omitidos: e.contactos.slice(17).map((c) => c.contactoId) }),
    );
    expect(r).toMatchObject({ exitosos: 17, fallidos: 3, conIA: 20 });
    expect(cierres.at(-1)).toMatchObject({ estado: "PARCIAL", contactosExitosos: 17, contactosFallidos: 3, tokensEntrada: 1000, usoIAId: "uso-1" });
    expect(devueltos.flat().sort()).toEqual(["k18", "k19", "k20"]);
    expect([...escritas.keys()]).toHaveLength(17);
  });

  it("un lote ininteligible se divide en mitades hasta llegar a uno (FR-018)", async () => {
    datosLote = new Map(ids(4).map((id) => [id, datos(id)]));
    const ejecutor = vi.fn(async () => respuesta(new Map(), { loteInvalido: true }));
    await correr(ids(4), ejecutor);
    expect(ejecutor).toHaveBeenCalledTimes(7); // 4 → 2+2 → 1+1+1+1
    expect(aperturas.filter((a) => a.modo === "IA")).toHaveLength(7);
    expect(aperturas.filter((a) => a.loteRaizId).every((a) => a.loteId === aperturas[0].loteId)).toBe(true);
    expect(devueltos.flat().sort()).toEqual(ids(4));
  });

  it("si el proveedor falla, la atención registra el consumo informado y todo vuelve con backoff (FR-040)", async () => {
    datosLote = new Map(ids(2).map((id) => [id, datos(id)]));
    await correr(ids(2), async () => {
      throw Object.assign(new Error("429 Too Many Requests"), { status: 429, consumo: { tokensEntrada: 900, tokensSalida: 10, usoIAId: "uso-x" } });
    });
    expect(cierres.at(-1)).toMatchObject({ estado: "FALLIDA", tokensEntrada: 900, tokensSalida: 10 });
    expect(devueltos.flat().sort()).toEqual(ids(2));
  });

  it("solo van a la IA los que tienen conversación; el resto se resuelve por reglas en el mismo turno", async () => {
    datosLote = new Map([["k1", datos("k1")], ["k2", datos("k2", { ultimoMensajeEn: null })]]);
    const ejecutor = vi.fn(async (e: EntradaLoteIA) => respuesta(new Map(e.contactos.map((c) => [c.contactoId, ia()]))));
    const r = await correr(["k1", "k2"], ejecutor);
    expect(ejecutor.mock.calls[0][0].contactos.map((c) => c.contactoId)).toEqual(["k1"]);
    expect(r).toMatchObject({ conIA: 1, porReglas: 1 });
    expect(escritas.get("k2")).toMatchObject({ origen: "REGLA" });
  });

  it("sin disponibilidad (presupuesto o límite) todo se resuelve por reglas", async () => {
    datosLote = new Map(ids(3).map((id) => [id, datos(id)]));
    const ejecutor = vi.fn();
    const r = await correr(ids(3), ejecutor, false);
    expect(ejecutor).not.toHaveBeenCalled();
    expect(r.porReglas).toBe(3);
  });

  it("SOLO_SUGERIR guarda la sugerencia y no cambia el interés", async () => {
    datosLote = new Map([["k1", datos("k1")]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia({ intencion: "MEDIA" })]])));
    expect(escritas.get("k1")).toMatchObject({ origen: "IA", interesSugerido: "MEDIO", interesSugeridoEstado: "PENDIENTE", criterioVersionId: "crit-v2" });
    expect(actualizarInteres).not.toHaveBeenCalled();
  });

  it("APLICAR_AUTOMATICO aplica el interés con origen IA después del commit", async () => {
    modoInteres = "APLICAR_AUTOMATICO";
    datosLote = new Map([["k1", datos("k1")]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia({ intencion: "MEDIA" })]])));
    expect(actualizarInteres).toHaveBeenCalledWith(expect.objectContaining({ contactoId: "k1", origen: "IA", accion: { tipo: "FIJAR", nivel: "MEDIO" } }));
  });

  it("con interés fijado a mano no se sugiere ni se aplica", async () => {
    modoInteres = "APLICAR_AUTOMATICO";
    datosLote = new Map([["k1", datos("k1", { nivelInteresFijado: true, nivelInteres: "BAJO" })]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia()]])));
    expect(actualizarInteres).not.toHaveBeenCalled();
    expect(escritas.get("k1")).not.toHaveProperty("interesSugerido");
  });

  it("'No contactar' nunca se escribe: queda como sugerencia (FR-016a, SC-016)", async () => {
    modoInteres = "APLICAR_AUTOMATICO";
    datosLote = new Map([["k1", datos("k1")]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia({ sugerirNoContactar: true, motivoNoContactar: "Pidió no recibir más mensajes" })]])));
    expect(actualizarPreferenciaContacto).not.toHaveBeenCalled();
    expect(escritas.get("k1")).toMatchObject({ noContactarSugerido: true, noContactarSugeridoEstado: "PENDIENTE" });
  });

  it("entrega la interpretación al perfil 012 (FR-022)", async () => {
    datosLote = new Map([["k1", datos("k1")]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia()]])));
    expect(alEvaluarConIA).toHaveBeenCalledWith("inst-1", "k1", expect.objectContaining({ intencionComercial: "LISTO_PARA_COMPRAR" }));
  });

  it("los hechos mandan sobre la acción de la IA (FR-021)", async () => {
    datosLote = new Map([["k1", datos("k1", { esperandoRespuesta: true, seguimiento: "PENDIENTE" })]]);
    await correr(["k1"], async (e) => respuesta(new Map([[e.contactos[0].contactoId, ia({ accionSugerida: "OFRECER_NOVEDADES" })]])));
    expect(escritas.get("k1")).toMatchObject({ accionSugerida: "RESPONDER", accionIA: "OFRECER_NOVEDADES" });
  });
});

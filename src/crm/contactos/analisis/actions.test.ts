import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — Acciones del panel: permisos, aislamiento por cuenta y resolución de
// sugerencias sin doble aplicación.

const permiso = vi.fn();
const marcarPendiente = vi.fn(async (..._a: unknown[]) => {});
const actualizarInteres = vi.fn(async (..._a: unknown[]) => ({ ok: true, cambiado: true }));
const actualizarPreferenciaContacto = vi.fn(async (..._a: unknown[]) => ({ ok: true, cambiado: true }));

const db = {
  contacto: { findFirst: vi.fn(), findMany: vi.fn() },
  configuracionIA: { findUnique: vi.fn() },
  configuracionAnalisisContactos: { findUnique: vi.fn() },
  proveedorIA: { count: vi.fn() },
  contactoEvaluacion: { findFirst: vi.fn(), updateMany: vi.fn() },
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/db/prisma", () => ({ prisma: db }));
vi.mock("@/shared/auth/permisos-server", () => ({ requirePermisoAction: (...a: unknown[]) => permiso(...a) }));
vi.mock("./cola", () => ({ marcarPendiente: (...a: unknown[]) => marcarPendiente(...a) }));
vi.mock("@/crm/contactos/vista", () => ({ construirWhereVista: vi.fn(() => ({ instanciaId: "inst-1", SEGMENTO: true })) }));
vi.mock("@/crm/contactos/queries", () => ({ obtenerUmbralesSeguimiento: vi.fn(async () => ({ pendiente: 3, recuperar: 7, inactivo: 60 })) }));
vi.mock("@/sales/flujo-venta/queries", () => ({ obtenerEtapasFlujoActivo: vi.fn(async () => []) }));
vi.mock("@/crm/contactos/clasificacion", () => ({
  actualizarInteres: (...a: unknown[]) => actualizarInteres(...a),
  actualizarPreferenciaContacto: (...a: unknown[]) => actualizarPreferenciaContacto(...a),
}));

const {
  analizarContactoAction,
  resolverSugerenciaInteresAction,
  resolverSugerenciaNoContactarAction,
  analizarSeleccionadosAction,
  analizarSegmentoAction,
} = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({ ok: true, sesion: { instanciaId: "inst-1", usuarioInstanciaId: "ui-1", zonaNegocio: "America/Lima" } });
  db.contacto.findFirst.mockResolvedValue({ id: "c-1" });
  db.configuracionIA.findUnique.mockResolvedValue({ habilitado: true });
  db.configuracionAnalisisContactos.findUnique.mockResolvedValue(null);
  db.proveedorIA.count.mockResolvedValue(1);
});

describe("analizarContactoAction", () => {
  it("marca el contacto como urgente, sin ventana y forzando IA", async () => {
    const r = await analizarContactoAction({ contactoId: "c-1" });
    expect(r).toEqual({ exito: true, datos: { encolado: true } });
    expect(marcarPendiente).toHaveBeenCalledWith({ instanciaId: "inst-1", contactoId: "c-1", prioridad: "P0", motivo: "MANUAL", inmediato: true, forzarIA: true });
  });

  it("sin permiso de modificar contactos se rechaza", async () => {
    permiso.mockResolvedValue({ ok: false, error: "Sin permiso" });
    expect(await analizarContactoAction({ contactoId: "c-1" })).toEqual({ exito: false, error: "Sin permiso" });
    expect(marcarPendiente).not.toHaveBeenCalled();
  });

  it("un contacto de otra cuenta responde no encontrado", async () => {
    db.contacto.findFirst.mockResolvedValue(null);
    expect(await analizarContactoAction({ contactoId: "ajeno" })).toMatchObject({ exito: false, error: "Contacto no encontrado" });
    expect(db.contacto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ajeno", instanciaId: "inst-1" } }));
  });

  it("sin IA disponible para la cuenta no se encola", async () => {
    db.configuracionAnalisisContactos.findUnique.mockResolvedValue({ habilitado: false });
    expect(await analizarContactoAction({ contactoId: "c-1" })).toMatchObject({ exito: false });
    expect(marcarPendiente).not.toHaveBeenCalled();
  });
});

describe("resolverSugerenciaInteresAction", () => {
  it("aceptar escribe el interés con origen MANUAL", async () => {
    db.contactoEvaluacion.findFirst.mockResolvedValue({ interesSugerido: "ALTO" });
    db.contactoEvaluacion.updateMany.mockResolvedValue({ count: 1 });
    expect(await resolverSugerenciaInteresAction({ contactoId: "c-1", decision: "ACEPTAR" })).toEqual({ exito: true, datos: undefined });
    expect(actualizarInteres).toHaveBeenCalledWith(expect.objectContaining({ origen: "MANUAL", accion: { tipo: "FIJAR", nivel: "ALTO" }, usuarioInstanciaId: "ui-1" }));
  });

  it("descartar no toca el interés", async () => {
    db.contactoEvaluacion.findFirst.mockResolvedValue({ interesSugerido: "ALTO" });
    db.contactoEvaluacion.updateMany.mockResolvedValue({ count: 1 });
    await resolverSugerenciaInteresAction({ contactoId: "c-1", decision: "DESCARTAR" });
    expect(actualizarInteres).not.toHaveBeenCalled();
  });

  it("un doble clic (la sugerencia ya se resolvió) no aplica dos veces", async () => {
    db.contactoEvaluacion.findFirst.mockResolvedValue({ interesSugerido: "ALTO" });
    db.contactoEvaluacion.updateMany.mockResolvedValue({ count: 0 });
    expect(await resolverSugerenciaInteresAction({ contactoId: "c-1", decision: "ACEPTAR" })).toMatchObject({ exito: false });
    expect(actualizarInteres).not.toHaveBeenCalled();
  });

  it("sin sugerencia pendiente responde que ya no está disponible", async () => {
    db.contactoEvaluacion.findFirst.mockResolvedValue(null);
    expect(await resolverSugerenciaInteresAction({ contactoId: "c-1", decision: "ACEPTAR" })).toMatchObject({ exito: false });
  });
});

describe("resolverSugerenciaNoContactarAction", () => {
  it("aceptar marca No contactar con origen MANUAL (nunca IA)", async () => {
    db.contactoEvaluacion.updateMany.mockResolvedValue({ count: 1 });
    await resolverSugerenciaNoContactarAction({ contactoId: "c-1", decision: "ACEPTAR" });
    expect(actualizarPreferenciaContacto).toHaveBeenCalledWith(expect.objectContaining({ noContactar: true, origen: "MANUAL" }));
  });

  it("descartar registra cuándo, para no volver a sugerirlo sin un rechazo nuevo", async () => {
    db.contactoEvaluacion.updateMany.mockResolvedValue({ count: 1 });
    await resolverSugerenciaNoContactarAction({ contactoId: "c-1", decision: "DESCARTAR" });
    const data = db.contactoEvaluacion.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ noContactarSugeridoEstado: "DESCARTADA" });
    expect(data.noContactarResueltoEn).toBeInstanceOf(Date);
    expect(actualizarPreferenciaContacto).not.toHaveBeenCalled();
  });
});

describe("analizarSeleccionadosAction (Historia 7)", () => {
  it("encola solo los contactos de la cuenta, P1 y forzando IA", async () => {
    db.contacto.findMany.mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);
    const r = await analizarSeleccionadosAction({ contactoIds: ["c-1", "c-2", "ajeno"] });
    expect(r).toEqual({ exito: true, datos: { encolados: 2 } });
    expect(db.contacto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["c-1", "c-2", "ajeno"] }, instanciaId: "inst-1" } }));
    expect(marcarPendiente).toHaveBeenCalledWith(expect.objectContaining({ contactoId: "c-1", prioridad: "P1", motivo: "SELECCION", forzarIA: true }));
    expect(marcarPendiente).toHaveBeenCalledTimes(2);
  });

  it("más de 100 se rechaza y sugiere el análisis por segmento", async () => {
    const r = await analizarSeleccionadosAction({ contactoIds: Array.from({ length: 101 }, (_, i) => `c-${i}`) });
    expect(r).toMatchObject({ exito: false });
    expect((r as { error: string }).error).toMatch(/segmento/);
    expect(marcarPendiente).not.toHaveBeenCalled();
  });
});

describe("analizarSegmentoAction (Historia 7)", () => {
  it("requiere permiso de administración de IA", async () => {
    permiso.mockImplementation(async (modulo: string) => (modulo === "ia" ? { ok: false, error: "Sin permiso" } : { ok: true, sesion: {} }));
    expect(await analizarSegmentoAction({ filtros: { segmento: "INTERESADOS" } })).toEqual({ exito: false, error: "Sin permiso" });
    expect(permiso).toHaveBeenCalledWith("ia", "modificar");
  });

  it("encola como histórico exactamente lo que filtra la lista", async () => {
    db.contacto.findMany.mockResolvedValueOnce([{ id: "c-1" }, { id: "c-2" }, { id: "c-3" }]);
    const r = await analizarSegmentoAction({ filtros: { segmento: "INTERESADOS" } });
    expect(r).toEqual({ exito: true, datos: { encolados: 3 } });
    expect(db.contacto.findMany.mock.calls[0][0].where).toEqual({ instanciaId: "inst-1", SEGMENTO: true });
    expect(marcarPendiente).toHaveBeenCalledWith(expect.objectContaining({ prioridad: "P2", motivo: "SEGMENTO" }));
  });
});

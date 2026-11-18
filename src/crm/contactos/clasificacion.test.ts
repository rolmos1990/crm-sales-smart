import { beforeEach, describe, expect, it, vi } from "vitest";

// 041 — Reglas de transición de interés y "No contactar". Se simula una fila
// de contacto en memoria; la transacción ejecuta el callback con el mismo
// cliente falso.

type Fila = {
  id: string;
  instanciaId: string;
  nivelInteres: string;
  nivelInteresFijado: boolean;
  noContactarDesde: Date | null;
};

let fila: Fila | null;
const historial: Array<Record<string, unknown>> = [];
const publicar = vi.fn();

const tx = {
  contacto: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; instanciaId: string } }) =>
      fila && fila.id === where.id && fila.instanciaId === where.instanciaId ? { ...fila } : null,
    ),
    update: vi.fn(async ({ data }: { data: Partial<Fila> }) => {
      Object.assign(fila!, data);
      return fila;
    }),
  },
  contactoClasificacionHistorial: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      historial.push(data);
      return data;
    }),
  },
};

vi.mock("@/shared/db/prisma", () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
}));
vi.mock("@/shared/rabbitmq", () => ({ publicadorEventos: { publicar: (...a: unknown[]) => publicar(...a) } }));

const { actualizarInteres, actualizarPreferenciaContacto } = await import("./clasificacion");

const base = { instanciaId: "inst-1", contactoId: "c-1", usuarioInstanciaId: "ui-1" };

beforeEach(() => {
  fila = { id: "c-1", instanciaId: "inst-1", nivelInteres: "SIN_EVALUAR", nivelInteresFijado: false, noContactarDesde: null };
  historial.length = 0;
  vi.clearAllMocks();
});

describe("actualizarInteres", () => {
  it("fijar a mano escribe contacto e historial y publica el evento", async () => {
    const r = await actualizarInteres({ ...base, accion: { tipo: "FIJAR", nivel: "ALTO" }, origen: "MANUAL" });
    expect(r).toEqual({ ok: true, cambiado: true });
    expect(fila).toMatchObject({ nivelInteres: "ALTO", nivelInteresFijado: true, nivelInteresOrigen: "MANUAL" });
    expect(historial).toEqual([expect.objectContaining({ dimension: "INTERES", valorAnterior: "SIN_EVALUAR", valorNuevo: "ALTO", fijado: true })]);
    expect(publicar).toHaveBeenCalledWith(
      "CONTACTO_INTERES_ACTUALIZADO",
      "inst-1",
      expect.objectContaining({ nivelAnterior: "SIN_EVALUAR", nivelNuevo: "ALTO", fijado: true }),
    );
  });

  it("liberar vuelve a Sin evaluar sin fijar", async () => {
    fila!.nivelInteres = "BAJO";
    fila!.nivelInteresFijado = true;
    await actualizarInteres({ ...base, accion: { tipo: "LIBERAR" }, origen: "MANUAL" });
    expect(fila).toMatchObject({ nivelInteres: "SIN_EVALUAR", nivelInteresFijado: false });
  });

  it("el mismo valor no escribe nada", async () => {
    fila!.nivelInteres = "ALTO";
    fila!.nivelInteresFijado = true;
    const r = await actualizarInteres({ ...base, accion: { tipo: "FIJAR", nivel: "ALTO" }, origen: "MANUAL" });
    expect(r).toEqual({ ok: true, cambiado: false });
    expect(tx.contacto.update).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
  });

  it("un proceso automático no pisa un valor fijado a mano", async () => {
    fila!.nivelInteres = "BAJO";
    fila!.nivelInteresFijado = true;
    const r = await actualizarInteres({ ...base, accion: { tipo: "FIJAR", nivel: "ALTO" }, origen: "IA", usuarioInstanciaId: null });
    expect(r).toMatchObject({ ok: false, codigo: "FIJADO" });
    expect(fila!.nivelInteres).toBe("BAJO");
  });

  it("un proceso automático sí escribe un valor no fijado, sin fijarlo", async () => {
    await actualizarInteres({ ...base, accion: { tipo: "FIJAR", nivel: "MEDIO" }, origen: "IA", usuarioInstanciaId: null });
    expect(fila).toMatchObject({ nivelInteres: "MEDIO", nivelInteresFijado: false });
  });

  it("contacto de otra instancia: no encontrado", async () => {
    const r = await actualizarInteres({ ...base, instanciaId: "otra", accion: { tipo: "FIJAR", nivel: "ALTO" }, origen: "MANUAL" });
    expect(r).toMatchObject({ ok: false, codigo: "NO_ENCONTRADO" });
  });
});

describe("actualizarPreferenciaContacto", () => {
  it("marcar No contactar registra quién y cuándo", async () => {
    const r = await actualizarPreferenciaContacto({ ...base, noContactar: true, origen: "MANUAL" });
    expect(r).toEqual({ ok: true, cambiado: true });
    expect(fila!.noContactarDesde).toBeInstanceOf(Date);
    expect(historial[0]).toMatchObject({ dimension: "PREFERENCIA_CONTACTO", valorAnterior: "CONTACTABLE", valorNuevo: "NO_CONTACTAR" });
  });

  it("un proceso automático no puede volver a habilitar el contacto", async () => {
    fila!.noContactarDesde = new Date();
    const r = await actualizarPreferenciaContacto({ ...base, noContactar: false, origen: "IA", usuarioInstanciaId: null });
    expect(r).toMatchObject({ ok: false, codigo: "PROHIBIDO" });
    expect(fila!.noContactarDesde).not.toBeNull();
  });

  it("una persona sí puede volver a habilitarlo", async () => {
    fila!.noContactarDesde = new Date();
    const r = await actualizarPreferenciaContacto({ ...base, noContactar: false, origen: "MANUAL" });
    expect(r).toEqual({ ok: true, cambiado: true });
    expect(fila!.noContactarDesde).toBeNull();
  });
});

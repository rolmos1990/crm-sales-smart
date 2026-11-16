import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePermisoActionMock = vi.fn();
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));

const conversacionFindFirst = vi.fn();
const identificadorFindFirst = vi.fn();
const contactoFindFirst = vi.fn();
const contactoUpdate = vi.fn();

// Dentro de la transacción
const txIdentificadorUpdate = vi.fn();
const txConversacionUpdate = vi.fn();
const txContactoUpdate = vi.fn();
const txContactoDelete = vi.fn();
const txOportunidadUpdateMany = vi.fn();
const txOportunidadContactoUpdateMany = vi.fn();

let transaccionFalla = false;

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    conversacion: { findFirst: (...a: unknown[]) => conversacionFindFirst(...a) },
    contactoIdentificadorCanal: { findFirst: (...a: unknown[]) => identificadorFindFirst(...a) },
    contacto: {
      findFirst: (...a: unknown[]) => contactoFindFirst(...a),
      update: (...a: unknown[]) => contactoUpdate(...a),
    },
    $transaction: async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        contactoIdentificadorCanal: { update: txIdentificadorUpdate },
        conversacion: { update: txConversacionUpdate },
        contacto: {
          update: txContactoUpdate,
          delete: (...a: unknown[]) => {
            txContactoDelete(...a);
            return Promise.resolve({});
          },
        },
        oportunidad: { updateMany: txOportunidadUpdateMany },
        oportunidadContacto: { updateMany: txOportunidadContactoUpdateMany },
      };
      await cb(tx);
      // Una transacción que falla no debe dejar nada aplicado: el rollback lo
      // hace PostgreSQL, acá se simula el throw para verificar que el llamador
      // no sigue adelante como si hubiera salido bien.
      if (transaccionFalla) throw new Error("fallo a mitad de la transacción");
    },
  },
}));

const acciones = await import("./actions");

const PENDIENTE = { id: "conv-1", contactoId: "cont-prov", instanciaId: "inst-1" };
const IDENTIFICADOR = { id: "ident-1", identificador: "juan@cliente.com" };

beforeEach(() => {
  vi.clearAllMocks();
  transaccionFalla = false;
  requirePermisoActionMock.mockResolvedValue({
    ok: true,
    sesion: { instanciaId: "inst-1", usuarioId: "u-1" },
  });
  conversacionFindFirst.mockResolvedValue(PENDIENTE);
  identificadorFindFirst.mockResolvedValue(IDENTIFICADOR);
  txIdentificadorUpdate.mockResolvedValue({});
  txConversacionUpdate.mockResolvedValue({});
  txContactoUpdate.mockResolvedValue({});
  txOportunidadUpdateMany.mockResolvedValue({});
  txOportunidadContactoUpdateMany.mockResolvedValue({});
  contactoUpdate.mockResolvedValue({});
});

describe("aprobar creando un contacto nuevo", () => {
  it("deja las tres banderas consistentes en una sola transacción", async () => {
    const r = await acciones.aprobarRemitenteConContactoNuevo({
      conversacionId: "conv-1",
      nombre: "Juan",
      apellido: "Pérez",
    });

    expect(r).toEqual({ ok: true, data: { contactoId: "cont-prov" } });

    // 1. La fuente de verdad: la dirección queda aprobada.
    expect(txIdentificadorUpdate.mock.calls[0][0].data).toMatchObject({ aprobadoPorId: "u-1" });
    expect(txIdentificadorUpdate.mock.calls[0][0].data.aprobadoEn).toBeInstanceOf(Date);

    // 2. La conversación se desbloquea.
    expect(txConversacionUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { bloqueadaPorAprobacion: false },
    });

    // 3. La oportunidad deja de estar pendiente.
    expect(txOportunidadUpdateMany.mock.calls[0][0].data).toEqual({ aprobacionPendiente: false });

    // El contacto provisional se activa con los datos cargados.
    expect(txContactoUpdate.mock.calls[0][0].data).toMatchObject({
      activo: true,
      nombre: "Juan",
      apellido: "Pérez",
    });
    expect(txContactoDelete).not.toHaveBeenCalled();
  });

  it("exige un nombre", async () => {
    const r = await acciones.aprobarRemitenteConContactoNuevo({
      conversacionId: "conv-1",
      nombre: "   ",
    });

    expect(r.ok).toBe(false);
    expect(txIdentificadorUpdate).not.toHaveBeenCalled();
  });

  it("un fallo a mitad de camino no deja la aprobación a medias", async () => {
    transaccionFalla = true;

    await expect(
      acciones.aprobarRemitenteConContactoNuevo({ conversacionId: "conv-1", nombre: "Juan" }),
    ).rejects.toThrow();
  });
});

describe("aprobar asociando a un contacto existente", () => {
  beforeEach(() => {
    contactoFindFirst.mockResolvedValue({ id: "cont-real", email: null });
  });

  it("reasigna conversación, identificador y oportunidades, y borra el provisional", async () => {
    const r = await acciones.aprobarRemitenteConContactoExistente({
      conversacionId: "conv-1",
      contactoId: "cont-real",
    });

    expect(r).toEqual({ ok: true, data: { contactoId: "cont-real" } });

    expect(txIdentificadorUpdate.mock.calls[0][0].data).toMatchObject({ contactoId: "cont-real" });
    expect(txConversacionUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { contactoId: "cont-real", bloqueadaPorAprobacion: false },
    });
    expect(txOportunidadContactoUpdateMany.mock.calls[0][0].data).toEqual({ contactoId: "cont-real" });
    expect(txContactoDelete).toHaveBeenCalledWith({ where: { id: "cont-prov" } });
  });

  it("completa el correo en la ficha del contacto si no lo tenía", async () => {
    await acciones.aprobarRemitenteConContactoExistente({
      conversacionId: "conv-1",
      contactoId: "cont-real",
    });

    expect(contactoUpdate).toHaveBeenCalledWith({
      where: { id: "cont-real" },
      data: { email: "juan@cliente.com" },
    });
  });

  it("no pisa el correo del contacto si ya tenía uno", async () => {
    contactoFindFirst.mockResolvedValue({ id: "cont-real", email: "otro@cliente.com" });

    await acciones.aprobarRemitenteConContactoExistente({
      conversacionId: "conv-1",
      contactoId: "cont-real",
    });

    expect(contactoUpdate).not.toHaveBeenCalled();
  });

  it("rechaza un contacto de otra instancia", async () => {
    contactoFindFirst.mockResolvedValue(null);

    const r = await acciones.aprobarRemitenteConContactoExistente({
      conversacionId: "conv-1",
      contactoId: "cont-ajeno",
    });

    expect(r.ok).toBe(false);
    expect(txIdentificadorUpdate).not.toHaveBeenCalled();
  });
});

describe("autorización y alcance", () => {
  it("sin permiso no aprueba nada", async () => {
    requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });

    const r = await acciones.aprobarRemitenteConContactoNuevo({
      conversacionId: "conv-1",
      nombre: "Juan",
    });

    expect(r.ok).toBe(false);
    expect(txIdentificadorUpdate).not.toHaveBeenCalled();
  });

  it("una conversación que no está pendiente no se puede 'aprobar'", async () => {
    conversacionFindFirst.mockResolvedValue(null);

    const r = await acciones.aprobarRemitenteConContactoNuevo({
      conversacionId: "conv-1",
      nombre: "Juan",
    });

    expect(r).toEqual({ ok: false, error: "Esta conversación no está pendiente de aprobación" });
  });

  it("busca la conversación acotada a la instancia y al estado pendiente", async () => {
    await acciones.aprobarRemitenteConContactoNuevo({ conversacionId: "conv-1", nombre: "Juan" });

    expect(conversacionFindFirst.mock.calls[0][0].where).toEqual({
      id: "conv-1",
      instanciaId: "inst-1",
      bloqueadaPorAprobacion: true,
    });
  });
});

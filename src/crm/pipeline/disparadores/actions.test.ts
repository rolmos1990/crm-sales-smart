import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePermisoActionMock = vi.fn();
vi.mock("@/shared/auth/permisos-server", () => ({
  requirePermisoAction: (...a: unknown[]) => requirePermisoActionMock(...a),
}));
vi.mock("@/shared/auth/sesion", () => ({ requireSesion: vi.fn() }));

const disparadorFindFirstMock = vi.fn();
const disparadorUpdateMock = vi.fn();
const disparadorCreateMock = vi.fn();
const disparadorCountMock = vi.fn();
const stageFindFirstMock = vi.fn();
const transactionMock = vi.fn();
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    disparador: {
      findFirst: (...a: unknown[]) => disparadorFindFirstMock(...a),
      update: (...a: unknown[]) => disparadorUpdateMock(...a),
      create: (...a: unknown[]) => disparadorCreateMock(...a),
      count: (...a: unknown[]) => disparadorCountMock(...a),
    },
    pipelineStage: { findFirst: (...a: unknown[]) => stageFindFirstMock(...a) },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

const { crearDisparador, actualizarDisparador, toggleDisparador, eliminarDisparador, reordenarDisparadores } =
  await import("./actions");

const datosValidos = {
  nombre: "Crear tarea",
  activo: true,
  tipo: "CREAR_TAREA",
  config: { titulo: "Llamar al cliente" },
};

describe("acciones de disparadores — permisos y aislamiento por instancia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermisoActionMock.mockResolvedValue({ ok: true, sesion: { instanciaId: "instancia-1" } });
  });

  it("sin permiso: ninguna acción escribe", async () => {
    requirePermisoActionMock.mockResolvedValue({ ok: false, error: "Sin permiso" });

    const resultados = await Promise.all([
      crearDisparador("pipe-1", "stage-1", datosValidos),
      actualizarDisparador("d-1", datosValidos),
      toggleDisparador("d-1", false),
      eliminarDisparador("d-1"),
      reordenarDisparadores("stage-1", ["d-1"]),
    ]);

    for (const r of resultados) expect(r).toEqual({ exito: false, error: "Sin permiso" });
    expect(disparadorCreateMock).not.toHaveBeenCalled();
    expect(disparadorUpdateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(requirePermisoActionMock).toHaveBeenCalledWith("pipeline", "modificar");
  });

  it("disparador de otra instancia: no se modifica", async () => {
    disparadorFindFirstMock.mockResolvedValue(null);

    expect(await toggleDisparador("d-ajeno", false)).toEqual({ exito: false, error: "Disparador no encontrado" });
    expect(await eliminarDisparador("d-ajeno")).toEqual({ exito: false, error: "Disparador no encontrado" });
    expect(await actualizarDisparador("d-ajeno", datosValidos)).toEqual({
      exito: false,
      error: "Disparador no encontrado",
    });
    expect(disparadorUpdateMock).not.toHaveBeenCalled();
  });

  it("crear en una etapa de otra instancia: no crea", async () => {
    stageFindFirstMock.mockResolvedValue(null);

    expect(await crearDisparador("pipe-ajeno", "stage-ajeno", datosValidos)).toEqual({
      exito: false,
      error: "Etapa no encontrada",
    });
    expect(disparadorCreateMock).not.toHaveBeenCalled();
  });

  it("reordenar con algún id ajeno: no reordena", async () => {
    disparadorCountMock.mockResolvedValue(1);

    expect(await reordenarDisparadores("stage-1", ["d-1", "d-ajeno"])).toEqual({
      exito: false,
      error: "Disparador no encontrado",
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("disparador propio con permiso: se actualiza como siempre", async () => {
    disparadorFindFirstMock.mockResolvedValue({ id: "d-1" });
    disparadorUpdateMock.mockResolvedValue({});

    expect(await toggleDisparador("d-1", false)).toEqual({ exito: true });
    expect(disparadorUpdateMock).toHaveBeenCalledWith({ where: { id: "d-1" }, data: { activo: false } });
  });
});
